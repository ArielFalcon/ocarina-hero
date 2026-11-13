/**
 * Every recording with a usable reference for the Isolated instrument benchmark.
 *
 * - corpus: the first fifteen seconds of each corpus clip (plus extra entries) against its curated melody,
 *   placed by out/melody-benchmark/alignment.json (unvalidated arrangements, with accompaniment);
 * - phoenix: MedleyDB Phoenix_ScotchMorris flute and violin stems and the mix, in fifteen-second windows,
 *   against notes grouped from the annotated f0;
 * - reference: the 1998 isolated ocarina lullaby and the accompanied 2026 excerpt (out/transcription-benchmark);
 * - delivery: the first fifteen seconds of each synthesized ocarina preview (out/catalogue/delivery) against the
 *   arrangement it was rendered from, so notes and times are exact;
 * - synthetic: oscillator fixtures with exact events;
 * - control: silence, noise and clicks, which must produce no notes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Note } from '../src/core/ir';
import { frequencyOf } from '../src/core/pitches';
import { buildSchedule } from '../src/core/schedule';
import { ensureExternalMedia } from './media-directory';
import { alignReference, type Alignment, type TimedNote } from './melody-metrics';

export const RATE = 44100;
export interface BenchmarkItem {
  readonly id: string;
  readonly group: 'corpus' | 'phoenix' | 'reference' | 'delivery' | 'synthetic' | 'control';
  readonly samples: Float32Array;
  /** Reference notes, or undefined for controls that must stay silent. */
  readonly reference?: readonly TimedNote[];
  /** Estimates outside this span are ignored (the reference covers only part of the clip). */
  readonly span?: readonly [number, number];
}

function decode(file: string, start = 0, seconds = 15): Float32Array {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(start), '-t', String(seconds), '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 27 });
  return new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
}

function corpus(media: string): BenchmarkItem[] {
  const clips = join(media, 'corpus/original-clips');
  const alignments: Record<string, Alignment & { clip?: string; annotation?: string }> = JSON.parse(readFileSync(join(media, 'melody-benchmark/alignment.json'), 'utf8'));
  return Object.keys(alignments).sort().flatMap(id => {
    const entry = alignments[id]!;
    const annotation = entry.annotation ? join(media, entry.annotation) : join(clips, id, 'annotations/source-selection.json');
    const clip = entry.clip ? join(media, entry.clip) : join(clips, id, 'clip.wav');
    if (!existsSync(annotation) || !existsSync(clip)) return [];
    const source = JSON.parse(readFileSync(annotation, 'utf8')) as { tempoBpm: number; melody: { midi: number; startBeat: number; durationBeats: number }[] };
    const beat = 60 / source.tempoBpm;
    const samples = decode(clip);
    const reference = alignReference(source.melody.map(n => ({ start: n.startBeat * beat, duration: n.durationBeats * beat, midi: n.midi })), entry, samples.length / RATE);
    return [{ id: `corpus/${id}`, group: 'corpus' as const, samples, reference }];
  });
}

/** Groups annotated f0 (time, Hz; voiced frames only) into notes of constant rounded MIDI lasting at least 60 ms. */
export function notesFromF0(rows: readonly (readonly [number, number])[], start: number, seconds: number): TimedNote[] {
  const grid = 0.01;
  const frames = Math.round(seconds / grid);
  const midi = new Int32Array(frames).fill(-1);
  const spacing = rows.length > 1 ? rows[1]![0] - rows[0]![0] : grid;
  let k = 0;
  for (let i = 0; i < frames; i++) {
    const t = start + i * grid;
    while (k < rows.length - 1 && rows[k + 1]![0] <= t) k++;
    const near = [rows[k], rows[k + 1]].filter(r => r && Math.abs(r[0] - t) <= spacing * 0.6 && r[1] > 0)
      .sort((a, b) => Math.abs(a![0] - t) - Math.abs(b![0] - t))[0];
    if (near) midi[i] = Math.round(69 + 12 * Math.log2(near[1] / 440));
  }
  const notes: TimedNote[] = [];
  let first = 0;
  for (let i = 1; i <= frames; i++) {
    if (i < frames && midi[i] === midi[first]) continue;
    if (midi[first]! >= 0 && (i - first) * grid >= 0.06) notes.push({ start: first * grid, duration: (i - first) * grid, midi: midi[first]! });
    first = i;
  }
  return notes;
}

function phoenix(media: string): BenchmarkItem[] {
  const base = join(media, 'extractor-improvement-research/annotated-fixtures');
  const audio = join(base, 'MedleyDB_sample/Audio/Phoenix_ScotchMorris');
  const sources = [
    { name: 'flute', file: join(audio, 'Phoenix_ScotchMorris_STEMS/Phoenix_ScotchMorris_STEM_02.wav'), f0: 'Phoenix_ScotchMorris_STEM_02.csv' },
    { name: 'violin', file: join(audio, 'Phoenix_ScotchMorris_STEMS/Phoenix_ScotchMorris_STEM_03.wav'), f0: 'Phoenix_ScotchMorris_STEM_03.csv' },
    { name: 'mix', file: join(audio, 'Phoenix_ScotchMorris_MIX.wav'), f0: 'Phoenix_ScotchMorris_MELODY1.csv' },
  ];
  return sources.flatMap(source => {
    if (!existsSync(source.file)) return [];
    const rows = readFileSync(join(base, source.f0), 'utf8').trim().split('\n')
      .map(line => line.split(',').slice(0, 2).map(Number) as [number, number]).filter(r => r[1] > 0);
    return [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 162].flatMap(start => {
      const reference = notesFromF0(rows, start, 15);
      if (reference.reduce((sum, n) => sum + n.duration, 0) < 0.5) return [];
      return [{ id: `phoenix/${source.name}-${start}`, group: 'phoenix' as const, samples: decode(source.file, start), reference }];
    });
  });
}

function references(root: string): BenchmarkItem[] {
  const lullaby = [83, 86, 81, 83, 86, 81, 83, 86, 93, 91, 86];
  const at = (starts: number[], ends: number[]) => lullaby.map((midi, i) => ({ start: starts[i]!, duration: ends[i]! - starts[i]!, midi }));
  const fixtures = [
    { id: 'reference/1998-ocarina', file: 'out/lullaby-reference-analysis/1998-reference/reference.wav',
      reference: at([0.32, 1.2, 1.69, 2.94, 3.77, 4.26, 5.55, 6.37, 6.75, 7.55, 7.97], [1.2, 1.69, 2.94, 3.77, 4.26, 5.55, 6.37, 6.75, 7.55, 7.97, 11.05]) },
    { id: 'reference/2026-accompanied', file: 'out/references/2026-11-11/04-lullaby.wav', span: [5.0, 14.7] as const,
      reference: at([5.2, 6.05, 6.48, 7.82, 8.68, 9.22, 10.43, 11.25, 11.65, 12.46, 12.88], [6.05, 6.48, 7.82, 8.68, 9.22, 10.43, 11.25, 11.65, 12.46, 12.88, 14.5]) },
  ];
  return fixtures.filter(f => existsSync(join(root, f.file)))
    .map(f => ({ id: f.id, group: 'reference' as const, samples: decode(join(root, f.file)), reference: f.reference, ...(f.span ? { span: f.span } : {}) }));
}

function delivery(media: string): BenchmarkItem[] {
  const base = join(media, 'catalogue/delivery');
  if (!existsSync(base)) return [];
  return readdirSync(base).sort().flatMap(name => {
    const audio = join(base, name, 'ocarina.wav');
    const arrangement = join(base, name, 'arrangement.json');
    if (!existsSync(audio) || !existsSync(arrangement)) return [];
    const source = JSON.parse(readFileSync(arrangement, 'utf8')) as { tempoBpm: number; fixedNotes: Note[] };
    const samples = decode(audio);
    const seconds = samples.length / RATE;
    const reference = buildSchedule(source.fixedNotes, source.tempoBpm).filter(note => note.startTime < seconds - 0.05).map(note => ({
      start: note.startTime, duration: Math.min(note.duration, seconds - note.startTime),
      midi: Math.round(69 + 12 * Math.log2(frequencyOf(note.pitch, note.bend) / 440)) }));
    return [{ id: `delivery/${name}`, group: 'delivery' as const, samples, reference }];
  });
}

/** Deterministic linear congruential noise in -1..1. */
function noise(length: number, seed = 12345): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) { seed = (1664525 * seed + 1013904223) >>> 0; out[i] = seed / 4294967296 * 2 - 1; }
  return out;
}

function synth(events: { midi: number; start: number; end: number }[], amplitude = 0.5, vibrato = 0, noiseLevel = 0): Float32Array {
  const samples = new Float32Array(Math.ceil((events.at(-1)!.end + 0.25) * RATE));
  const n = noise(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const t = i / RATE;
    const e = events.find(x => t >= x.start && t < x.end);
    samples[i] = n[i]! * noiseLevel;
    if (!e) continue;
    const u = t - e.start;
    const envelope = Math.min(1, u / 0.005, (e.end - t) / 0.005);
    samples[i]! += amplitude * envelope * Math.sin(2 * Math.PI * 440 * 2 ** ((e.midi - 69) / 12) * u + vibrato * Math.sin(2 * Math.PI * 5 * u));
  }
  return samples;
}

function synthetic(): BenchmarkItem[] {
  const fixtures: [string, { midi: number; start: number; end: number }[], number?, number?, number?][] = [
    ['low', [{ midi: 36, start: 0.2, end: 0.7 }, { midi: 43, start: 0.8, end: 1.3 }, { midi: 48, start: 1.4, end: 1.9 }, { midi: 52, start: 2, end: 2.5 }]],
    ['repeat-50ms', [{ midi: 69, start: 0.2, end: 0.55 }, { midi: 69, start: 0.6, end: 0.95 }, { midi: 72, start: 1.1, end: 1.45 }, { midi: 74, start: 1.6, end: 1.95 }]],
    ['fast-80ms', [{ midi: 69, start: 0.2, end: 0.28 }, { midi: 72, start: 0.28, end: 0.36 }, { midi: 76, start: 0.36, end: 0.44 }, { midi: 74, start: 0.44, end: 0.52 }, { midi: 71, start: 0.52, end: 0.6 }]],
    ['two-notes', [{ midi: 69, start: 0.2, end: 0.6 }, { midi: 72, start: 0.75, end: 1.15 }]],
    ['quiet-vibrato-noise', [{ midi: 69, start: 0.2, end: 0.6 }, { midi: 72, start: 0.75, end: 1.15 }, { midi: 76, start: 1.3, end: 1.7 }, { midi: 74, start: 1.85, end: 2.25 }], 0.04, 0.3, 0.002],
  ];
  return fixtures.map(([name, events, amplitude, vibrato, level]) => ({
    id: `synthetic/${name}`, group: 'synthetic' as const, samples: synth(events, amplitude, vibrato, level),
    reference: events.map(e => ({ start: e.start, duration: e.end - e.start, midi: e.midi })),
  }));
}

function controls(): BenchmarkItem[] {
  const length = 5 * RATE;
  const white = noise(length).map(x => x * 0.3);
  const high = new Float32Array(length);
  for (let i = 1; i < length; i++) high[i] = (white[i]! - white[i - 1]!) * 0.5;
  const clicks = new Float32Array(length);
  for (let i = 0; i < length; i += Math.round(0.5 * RATE)) clicks[i] = 0.9;
  return [['silence', new Float32Array(length)], ['white-noise', white], ['high-noise', high], ['clicks', clicks]]
    .map(([name, samples]) => ({ id: `control/${name as string}`, group: 'control' as const, samples: samples as Float32Array }));
}

export function loadBenchmarkItems(root: string): BenchmarkItem[] {
  const media = ensureExternalMedia();
  return [...corpus(media), ...phoenix(media), ...references(root), ...delivery(media), ...synthetic(), ...controls()];
}
