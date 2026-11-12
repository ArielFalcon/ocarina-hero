import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { frequencyOf, PITCHES, pitchById } from '../src/core/pitches';
import { detectPitch } from '../src/core/pitch-detect';

/**
 * Reverse test corpus.
 *
 * `build` transcribes the reference videos and stores note sequences.
 * `check` re-transcribes and compares by interval, which ignores the key and
 * the octave, so a change in the extractor shows up as a score.
 */
const SR = 44100;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface Entry {
  readonly id: string;
  readonly title: string;
  readonly audio: string;
  readonly verified: boolean;
}

const ENTRIES: readonly Entry[] = [
  { id: 'v1', title: 'In the End', audio: 'out/v1.wav', verified: true },
  { id: 'v2', title: 'Never Gonna Give You Up', audio: 'out/v2.wav', verified: false },
  { id: 'v3', title: 'Axel F', audio: 'out/v3.wav', verified: false },
  { id: 'v4', title: 'Littleroot Town', audio: 'out/v4.wav', verified: false },
];

interface Transcribed {
  readonly note: string;
  readonly midi: number;
  readonly start: number;
  readonly duration: number;
}

interface CorpusFile {
  readonly title: string;
  readonly verified: boolean;
  readonly source: string;
  readonly notes: readonly string[];
  readonly intervals: readonly number[];
}

const command = process.argv[2] ?? 'check';

if (command === 'build') {
  mkdirSync('odd/corpus', { recursive: true });
  mkdirSync('src/core/songs', { recursive: true });
  const demos: {
    id: string;
    title: string;
    tempoBpm: number;
    notes: { midi: number; startBeat: number; durationBeats: number }[];
  }[] = [];

  for (const entry of ENTRIES) {
    const notes = transcribe(entry.audio);
    const compressed = compress(notes);
    const file: CorpusFile = {
      title: entry.title,
      verified: entry.verified,
      source: entry.audio,
      notes: compressed.map((note) => note.note),
      intervals: intervalsOf(compressed),
    };
    writeFileSync(`odd/corpus/${entry.id}.json`, `${JSON.stringify(file, null, 2)}\n`);

    // One beat per second keeps the performance's original timing.
    demos.push({
      id: entry.id,
      title: entry.title,
      tempoBpm: 60,
      notes: notes.map((note) => ({
        midi: note.midi,
        startBeat: Number(note.start.toFixed(3)),
        durationBeats: Number(note.duration.toFixed(3)),
      })),
    });

    console.log(`${entry.id}  ${entry.title}: ${compressed.length} notes`);
  }

  writeFileSync('src/core/songs/from-videos.json', `${JSON.stringify(demos, null, 2)}\n`);
  console.log('wrote src/core/songs/from-videos.json');
  process.exit(0);
}

let total = 0;
for (const entry of ENTRIES) {
  const raw = readFileSync(`odd/corpus/${entry.id}.json`, 'utf8');
  const expected = JSON.parse(raw) as CorpusFile;
  const actual = intervalsOf(compress(transcribe(entry.audio)));
  const score = similarity(actual, expected.intervals);
  total += score;

  console.log(
    `${entry.id}  ${entry.title}${expected.verified ? '' : ' (unverified)'}  ${(score * 100).toFixed(0)}%`,
  );
  console.log(`      expected ${expected.intervals.join(' ')}`);
  console.log(`      actual   ${actual.join(' ')}`);
}

console.log(`\nmean ${(total / ENTRIES.length * 100).toFixed(0)}%`);

function transcribe(file: string): Transcribed[] {
  mkdirSync('out', { recursive: true });
  const raw = 'out/corpus.f32';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', raw]);
  const buffer = readFileSync(raw);
  const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

  const frame = 1024;
  const hop = 256;
  const envelope: number[] = [];
  for (let i = 0; i + frame < samples.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < frame; j += 1) sum += (samples[i + j] ?? 0) ** 2;
    envelope.push(Math.sqrt(sum / frame));
  }

  const max = Math.max(...envelope);
  const minOn = max * 0.12;
  const minOff = max * 0.05;
  const frameSeconds = hop / SR;
  const onsets: number[] = [];

  for (let i = 2; i < envelope.length; i += 1) {
    const current = envelope[i] ?? 0;
    const previous = envelope[i - 1] ?? 0;
    if (current < minOn || current - previous < max * 0.06) continue;
    const last = onsets[onsets.length - 1];
    if (last !== undefined && (i - last) * frameSeconds < 0.08) continue;
    onsets.push(i);
  }

  const notes: Transcribed[] = [];

  for (let index = 0; index < onsets.length; index += 1) {
    const startFrame = onsets[index] ?? 0;
    const nextFrame = onsets[index + 1] ?? envelope.length;

    let endFrame = startFrame;
    for (let i = startFrame; i < nextFrame; i += 1) {
      if ((envelope[i] ?? 0) < minOff) break;
      endFrame = i;
    }

    const start = startFrame * frameSeconds;
    const duration = Math.max((endFrame - startFrame + 1) * frameSeconds - 0.02, 0.03);
    const from = Math.floor((start + duration * 0.25) * SR);
    const to = Math.min(samples.length, Math.floor((start + duration * 0.75) * SR));
    const { hz, confidence } = detectPitch(samples.subarray(from, to), SR);

    if (hz < 150 || hz > 1400 || confidence < 0.8) continue;

    // Constrain to what the instrument can physically produce: five buttons
    // and two semitones of bend. Without this, gameplay audio makes the
    // detector jump octaves that the ocarina cannot play.
    const nearest = nearestReachable(hz);
    if (!nearest) continue;

    notes.push({ note: noteName(nearest), midi: nearest, start, duration });
  }

  return notes;
}

interface Reachable {
  readonly midi: number;
  readonly hz: number;
}

function reachableList(): readonly Reachable[] {
  const items: Reachable[] = [];
  for (const pitch of PITCHES) {
    const midiBase = pitchById(pitch.id).midi + 12;
    for (let bend = -2; bend <= 2; bend += 1) {
      items.push({ midi: midiBase + bend, hz: frequencyOf(pitch.id, bend) });
    }
  }
  return items;
}

function nearestReachable(hz: number): number | null {
  let best: Reachable | null = null;
  let bestCents = Number.POSITIVE_INFINITY;

  for (const item of reachableList()) {
    const cents = Math.abs(1200 * Math.log2(hz / item.hz));
    if (cents < bestCents) {
      bestCents = cents;
      best = item;
    }
  }

  return best && bestCents <= 60 ? best.midi : null;
}

function noteName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function compress(notes: readonly Transcribed[]): Transcribed[] {
  const out: Transcribed[] = [];
  for (const note of notes) {
    const last = out[out.length - 1];
    if (last && last.midi === note.midi) continue;
    out.push(note);
  }
  return out;
}

function intervalsOf(notes: readonly Transcribed[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < notes.length; i += 1) {
    out.push((notes[i]?.midi ?? 0) - (notes[i - 1]?.midi ?? 0));
  }
  return out;
}

function similarity(a: readonly number[], b: readonly number[]): number {
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length, 1);
}

function levenshtein(a: readonly number[], b: readonly number[]): number {
  const previous = new Array<number>(b.length + 1).fill(0);
  const current = new Array<number>(b.length + 1).fill(0);

  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j] ?? 0;
  }

  return previous[b.length] ?? 0;
}
