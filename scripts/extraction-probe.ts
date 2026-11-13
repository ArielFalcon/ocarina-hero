/**
 * Probes the audio extraction on one recording fragment against a known melody.
 *
 * Usage: npx tsx scripts/extraction-probe.ts <audio> (--song <catalogue-id> | --reference <melody.json>)
 *   [--locate] [--transposition <semitones>] [--json <out.json>]
 * The melody ({ tempoBpm, melody: [{ midi, startBeat, durationBeats }] }, or a bundled catalogue song) is placed on
 * the recording by the offset, constant tempo scale and transposition that put the most Basic Pitch note and onset
 * posterior under its notes. The fit uses the model, not the decoder, so it exposes decoding defects; a melody the
 * model does not hear gives a weak fit instead, and its scores then mean nothing.
 * Default: scores the first fifteen seconds and prints both note lists side by side with the cause of each error,
 * then the runner-up placements. A fourth or a fifth away shares most harmonics and can fit almost as well, so among
 * such near ties the placement whose decoded notes agree most is used and the choice is printed.
 * --transposition fixes the semitones from the melody to the recording instead.
 * --locate: scans up to 120 seconds and prints where the phrase most likely starts, to choose the fragment.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as ort from 'onnxruntime-web';
import { createBasicPitchModel } from '../src/audio/basic-pitch-model';
import audioLimits from '../src/core/audio-limits.json';
import { BASIC_PITCH_HOP_SECONDS as HOP, BASIC_PITCH_RATE, basicPitchFrames, decodeFrames, resample, type BasicPitchFrames } from '../src/core/basic-pitch';
import { MIDI_HIGH, MIDI_LOW } from '../src/core/melody-decoder';
import type { MelodyNote } from '../src/core/project';
import { CURATED_SONGS } from '../src/core/songs/catalogue';
import { RATE, decode } from './instrument-dataset';
import { alignReference, scoreNotes, type Alignment, type TimedNote } from './melody-metrics';

const STATES = MIDI_HIGH - MIDI_LOW + 1;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const name = (midi: number) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

const args = process.argv.slice(2);
const option = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const flag = (text: string) => { const i = args.indexOf(text); if (i >= 0) args.splice(i, 1); return i >= 0; };
const song = option('--song');
const referenceFile = option('--reference');
const jsonPath = option('--json');
const locate = flag('--locate');
const transposition = option('--transposition');
const audio = args[0];
if (!audio || (!song && !referenceFile)) throw new Error('Usage: extraction-probe.ts <audio> (--song <catalogue-id> | --reference <melody.json>) [--locate] [--transposition <semitones>] [--json <out.json>]');

function loadMelody(): TimedNote[] {
  const source: { tempoBpm: number; melody: readonly MelodyNote[] } | undefined = referenceFile
    ? JSON.parse(readFileSync(referenceFile, 'utf8'))
    : CURATED_SONGS.find(entry => entry.id === song || entry.id === `catalogue-${song}`);
  if (!source?.melody?.length) throw new Error(`No melody found for ${song ?? referenceFile}`);
  const beat = 60 / source.tempoBpm;
  const first = Math.min(...source.melody.map(note => note.startBeat));
  return source.melody.map(note => ({ start: (note.startBeat - first) * beat, duration: note.durationBeats * beat, midi: note.midi }))
    .sort((a, b) => a.start - b.start);
}

interface Fit extends Alignment { readonly score: number }

/** Scores every placement of the melody on the posteriors and returns the best ones, at least `apart` seconds apart. */
function fit(frames: BasicPitchFrames, melody: readonly TimedNote[], search: { offsets: number[]; scales: number[]; shifts: number[] }, keep: number, apart: number): Fit[] {
  const count = frames.notes.frames;
  const sums = new Float64Array((count + 1) * STATES);
  const attack = new Float32Array(count * STATES);
  for (let s = 0; s < STATES; s++) {
    for (let j = 0; j < count; j++) {
      sums[(j + 1) * STATES + s] = sums[j * STATES + s]! + frames.notes.values[j * STATES + s]!;
      let strongest = 0;
      for (let f = Math.max(0, j - 2); f <= Math.min(count - 1, j + 2); f++) strongest = Math.max(strongest, frames.onsets.values[f * STATES + s]!);
      attack[j * STATES + s] = strongest;
    }
  }
  const found: Fit[] = [];
  for (const shift of search.shifts) {
    const rows = melody.map(note => note.midi + shift - MIDI_LOW);
    if (rows.some(row => row < 0 || row >= STATES)) continue;
    for (const scale of search.scales) {
      for (const offset of search.offsets) {
        let held = 0, heldFrames = 0, attacks = 0, used = 0;
        for (let i = 0; i < melody.length; i++) {
          const from = Math.round((offset + melody[i]!.start * scale) / HOP);
          if (from < 0 || from >= count) continue;
          const to = Math.min(count, Math.max(from + 1, Math.round((offset + (melody[i]!.start + melody[i]!.duration) * scale) / HOP)));
          held += sums[to * STATES + rows[i]!]! - sums[from * STATES + rows[i]!]!;
          heldFrames += to - from;
          attacks += attack[from * STATES + rows[i]!]!;
          used++;
        }
        if (used < Math.min(5, melody.length)) continue;
        // A placement that leaves most of the melody outside the recording is a weaker one.
        found.push({ offset, scale, shift, score: (held / heldFrames + 0.5 * attacks / used) * Math.sqrt(used / melody.length) });
      }
    }
  }
  found.sort((a, b) => b.score - a.score);
  const best: Fit[] = [];
  for (const candidate of found) {
    if (best.length >= keep) break;
    if (best.every(other => Math.abs(other.offset - candidate.offset) >= apart)) best.push(candidate);
  }
  return best;
}

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step + 1e-9) + 1 }, (_, i) => from + i * step);
const shifts = transposition === undefined ? range(-24, 24, 1) : [-24, -12, 0, 12, 24].map(octave => Number(transposition) + octave);

/** Coarse search over the whole recording, then a fine search around each coarse candidate. */
function place(frames: BasicPitchFrames, melody: readonly TimedNote[], seconds: number, keep: number): Fit[] {
  const coarse = fit(frames, melody, { offsets: range(-1, seconds - 2, 0.05), scales: range(0.8, 1.25, 0.02), shifts }, keep, 1);
  return coarse.map(candidate => fit(frames, melody, {
    offsets: range(candidate.offset - 0.06, candidate.offset + 0.06, 0.01), scales: range(candidate.scale - 0.02, candidate.scale + 0.02, 0.0025),
    shifts: [candidate.shift],
  }, 1, 0)[0]!).sort((a, b) => b.score - a.score);
}

/**
 * Median lead or lag of the estimate's onsets over the melody notes of the same pitch class within 150 ms.
 * A constant timing offset is a property of the placement, not an extraction error.
 */
function onsetBias(reference: readonly TimedNote[], estimate: readonly TimedNote[]): number {
  const deltas = reference.flatMap(note => {
    const near = estimate.filter(candidate => (candidate.midi - note.midi) % 12 === 0 && Math.abs(candidate.start - note.start) <= 0.15)
      .sort((x, y) => Math.abs(x.start - note.start) - Math.abs(y.start - note.start))[0];
    return near ? [near.start - note.start] : [];
  }).sort((x, y) => x - y);
  return deltas.length >= 5 ? deltas[Math.floor(deltas.length / 2)]! : 0;
}

const melody = loadMelody();
const limit = locate ? 120 : audioLimits.maxDurationSeconds;
const samples = decode(audio, 0, limit);
const seconds = samples.length / RATE;
const model = await createBasicPitchModel(ort, new Uint8Array(readFileSync('public/models/basic-pitch-nmp.onnx')));
const frames = await basicPitchFrames(model, resample(samples, RATE, BASIC_PITCH_RATE));
const phrase = melody.at(-1)!.start + melody.at(-1)!.duration;

if (locate) {
  // Only the part of the phrase that fits one analysis fragment is searched for.
  const head = melody.filter(note => note.start < audioLimits.maxDurationSeconds - 1);
  console.log(`${audio}: ${seconds.toFixed(1)} s scanned; the phrase lasts ${phrase.toFixed(1)} s at its source tempo (${melody.length} notes, ${head.length} searched)`);
  for (const candidate of place(frames, head, seconds, 5)) {
    console.log(`fit ${candidate.score.toFixed(3)}  phrase starts at ${candidate.offset.toFixed(2)} s and lasts ${(phrase * candidate.scale).toFixed(1)} s  tempo scale ${candidate.scale.toFixed(3)}  transposition ${candidate.shift}`);
  }
} else {
  const placements = place(frames, melody, seconds, 3);
  const best = placements[0];
  if (!best) throw new Error('The melody could not be placed on the recording');
  const estimate: TimedNote[] = decodeFrames(frames, seconds).notes.map(note => ({ start: note.startBeat, duration: note.durationBeats, midi: note.midi }));
  const evaluate = (placed: Fit) => {
    const alignment = { ...placed, offset: placed.offset + onsetBias(alignReference(melody, placed, seconds), estimate) };
    const reference = alignReference(melody, alignment, seconds).filter(note => note.start >= -0.05);
    return { alignment, reference, scores: scoreNotes(reference, estimate, seconds) };
  };
  const relatedKeys = transposition === undefined ? [-7, -5, 5, 7].flatMap(interval => fit(frames, melody, {
    offsets: range(best.offset - 0.3, best.offset + 0.3, 0.01), scales: range(best.scale - 0.04, best.scale + 0.04, 0.0025), shifts: [best.shift + interval],
  }, 1, 0)).filter(other => other.score >= 0.9 * best.score) : [];
  const chosen = [best, ...relatedKeys].map(evaluate).sort((a, b) => b.scores.f1 - a.scores.f1)[0]!;
  const { alignment, reference, scores } = chosen;
  const shifted = estimate.map(note => ({ ...note, midi: note.midi + 12 * scores.octave }));
  const posterior = (grid: BasicPitchFrames['notes'], midi: number, from: number, to: number) => {
    const state = midi - 12 * scores.octave - MIDI_LOW;
    if (state < 0 || state >= STATES) return 0;
    const first = Math.max(0, Math.round(from / HOP)), last = Math.min(grid.frames, Math.max(first + 1, Math.round(to / HOP)));
    let sum = 0;
    for (let j = first; j < last; j++) sum += grid.values[j * STATES + state]!;
    return sum / (last - first);
  };
  const matched = new Map<number, number>();
  const taken = new Set<number>();
  reference.forEach((note, r) => {
    let best = -1;
    shifted.forEach((candidate, e) => {
      if (taken.has(e) || candidate.midi !== note.midi || Math.abs(candidate.start - note.start) > 0.1) return;
      if (best < 0 || Math.abs(candidate.start - note.start) < Math.abs(shifted[best]!.start - note.start)) best = e;
    });
    if (best >= 0) { matched.set(r, best); taken.add(best); }
  });
  const sounding = (notes: readonly TimedNote[], time: number) => notes.find(note => time >= note.start && time < note.start + note.duration);
  const counts: Record<string, number> = {};
  const tally = (label: string) => { counts[label] = (counts[label] ?? 0) + 1; return label; };
  const rows: { time: number; text: string }[] = [];
  reference.forEach((note, r) => {
    const support = posterior(frames.notes, note.midi, note.start, note.start + note.duration);
    let label = 'matched';
    if (!matched.has(r)) {
      const over = sounding(shifted, note.start + 0.02);
      if (over && over.midi === note.midi && note.start - over.start > 0.1) label = tally('missed: merged into the held note');
      else if (support < 0.2) label = tally('missed: model does not hear it');
      else if (over && (over.midi - note.midi) % 12 === 0) label = tally('missed: decoded an octave away');
      else if (over) label = tally('missed: decoder followed another pitch');
      else label = tally('missed: decoded as silence');
    }
    rows.push({ time: note.start, text: `REF ${note.start.toFixed(2).padStart(6)} ${note.duration.toFixed(2)} ${name(note.midi).padEnd(4)} posterior ${support.toFixed(2)}  ${label}` });
  });
  shifted.forEach((note, e) => {
    let label = 'ok';
    if (!taken.has(e)) {
      const over = sounding(reference, note.start + note.duration / 2);
      if (!over) label = tally('extra: in a rest of the melody');
      else if (over.midi === note.midi) label = tally('extra: same pitch as the melody (split or mistimed)');
      else if ((over.midi - note.midi) % 12 === 0) label = tally('extra: octave of the melody');
      else label = tally(note.midi < over.midi ? 'extra: below the melody' : 'extra: above the melody');
    }
    const onset = posterior(frames.onsets, note.midi, note.start - 2 * HOP, note.start + 3 * HOP);
    rows.push({ time: note.start + 1e-6, text: `    est ${note.start.toFixed(2).padStart(6)} ${note.duration.toFixed(2)} ${name(note.midi).padEnd(4)} posterior ${posterior(frames.notes, note.midi, note.start, note.start + note.duration).toFixed(2)} onset ${onset.toFixed(2)}  ${label}` });
  });
  for (const row of rows.sort((a, b) => a.time - b.time)) console.log(row.text);
  const covered = reference.length ? (reference.at(-1)!.start + reference.at(-1)!.duration - reference[0]!.start) : 0;
  console.log(`\nfit ${alignment.score.toFixed(3)}  offset ${alignment.offset.toFixed(2)} s  tempo scale ${alignment.scale.toFixed(3)}  transposition ${alignment.shift}  octave of the estimate ${scores.octave}`);
  console.log(`reference ${reference.length} of ${melody.length} notes over ${covered.toFixed(1)} s  estimate ${estimate.length} notes`);
  console.log(`F1 ${scores.f1.toFixed(2)}  precision ${scores.precision.toFixed(2)}  recall ${scores.recall.toFixed(2)}  frame pitch accuracy ${scores.pitchAccuracy.toFixed(2)}`);
  for (const [label, total] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`${String(total).padStart(3)}  ${label}`);
  if (alignment.shift !== best.shift) console.log(`transposition ${best.shift} fits slightly better (${best.score.toFixed(3)}) but the decoded notes agree with ${alignment.shift}: F1 ${evaluate(best).scores.f1.toFixed(2)} against ${scores.f1.toFixed(2)}`);
  for (const other of placements.slice(1)) console.log(`runner-up placement: fit ${other.score.toFixed(3)}  offset ${other.offset.toFixed(2)} s  tempo scale ${other.scale.toFixed(3)}  transposition ${other.shift}`);
  if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify({ audio, song: song ?? referenceFile, seconds, alignment, scores, counts, reference, estimate }, null, 1)}\n`);
}
