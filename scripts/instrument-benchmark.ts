/**
 * Isolated instrument benchmark over every recording with a reference (see scripts/instrument-dataset.ts).
 *
 * Engines: `basic-pitch` (current Isolated instrument engine), `periodicity` (the earlier detector, now the
 * fallback) and `main-melody` (the local server model; slow, requires npm run setup:melody).
 * Note F1 uses exact pitch after one global octave and onsets within ±100 ms; TAB F1 compares the projected
 * TABs by sounding pitch. Controls report the number of notes, which must be zero.
 *
 * Usage: npx tsx scripts/instrument-benchmark.ts [--engines basic-pitch,periodicity,main-melody]
 *   [--json out/instrument-benchmark/<name>.json] [--cache <dir>] [id-prefix ...]
 * `--cache` stores Basic Pitch posteriors so decoder changes can be re-scored without inference.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as ort from 'onnxruntime-web';
import { createBasicPitchModel } from '../src/audio/basic-pitch-model';
import { BASIC_PITCH_RATE, basicPitchFrames, decodeFrames, resample, type BasicPitchFrames } from '../src/core/basic-pitch';
import { analyzeModelPitchTrack, parseModelPitchTrack } from '../src/core/melody-analysis';
import { emptyGrid } from '../src/core/melody-decoder';
import { frequencyOf } from '../src/core/pitches';
import { prepareMelody } from '../src/core/prepare';
import type { MelodyNote } from '../src/core/project';
import { transcribeAudio } from '../src/core/transcribe';
import { runModel } from '../server/melody';
import { RATE, loadBenchmarkItems, type BenchmarkItem } from './instrument-dataset';
import { scoreAdapted, scoreNotes, type TimedNote } from './melody-metrics';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const jsonPath = option('--json');
const cache = option('--cache');
const engines = (option('--engines') ?? 'basic-pitch,periodicity').split(',');
const prefixes = args;

type Engine = (item: BenchmarkItem) => Promise<readonly MelodyNote[]>;

function saveFrames(file: string, frames: BasicPitchFrames): void {
  const header = new Float64Array([frames.times.length]);
  writeFileSync(file, Buffer.concat([header, frames.times, frames.notes.values, frames.onsets.values].map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength))));
}
function loadFrames(file: string): BasicPitchFrames {
  const bytes = readFileSync(file);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const count = new Float64Array(buffer, 0, 1)[0]!;
  const times = new Float64Array(buffer, 8, count);
  const notes = emptyGrid(count);
  const size = notes.values.length;
  notes.values.set(new Float32Array(buffer, 8 + 8 * count, size));
  const onsets = emptyGrid(count);
  onsets.values.set(new Float32Array(buffer, 8 + 8 * count + 4 * size, size));
  return { times, notes, onsets };
}

/** Basic Pitch posteriors for an item, from the cache when available. */
async function framesFor(item: BenchmarkItem, model: Parameters<typeof basicPitchFrames>[0], cacheDir?: string): Promise<BasicPitchFrames> {
  const file = cacheDir ? join(cacheDir, `${item.id.replace(/\//g, '__')}.bin`) : undefined;
  if (file && existsSync(file)) return loadFrames(file);
  const frames = await basicPitchFrames(model, resample(item.samples, RATE, BASIC_PITCH_RATE));
  if (file) { mkdirSync(dirname(file), { recursive: true }); saveFrames(file, frames); }
  return frames;
}

const bytes = new Uint8Array(readFileSync('public/models/basic-pitch-nmp.onnx'));
const model = engines.includes('basic-pitch') ? await createBasicPitchModel(ort, bytes) : undefined;
const work = mkdtempSync(join(tmpdir(), 'instrument-benchmark-'));
const run: Record<string, Engine> = {
  'basic-pitch': async item => decodeFrames(await framesFor(item, model!, cache), item.samples.length / RATE).notes,
  periodicity: async item => transcribeAudio(item.samples, RATE)?.notes ?? [],
  'main-melody': async item => {
    const input = join(work, 'clip.f32');
    writeFileSync(input, Buffer.from(item.samples.buffer, item.samples.byteOffset, item.samples.byteLength));
    const result = await runModel(input, RATE).result;
    if (result.stdout === undefined) throw new Error(`${item.id}: ${result.error ?? 'oversized output'}`);
    return analyzeModelPitchTrack(parseModelPitchTrack(JSON.parse(result.stdout))).notes;
  },
};

/** Sounding pitch of the projected TAB. */
function adapted(melody: readonly MelodyNote[]): TimedNote[] {
  return prepareMelody({ melody, preserveTiming: true }, { simplify: false, maxBend: 2 }).notes.map(note => ({
    start: note.startBeat, duration: note.durationBeats, midi: Math.round(69 + 12 * Math.log2(frequencyOf(note.pitch, note.bend ?? 0) / 440)) }));
}
const timed = (notes: readonly MelodyNote[]): TimedNote[] => notes.map(n => ({ start: n.startBeat, duration: n.durationBeats, midi: n.midi }));
const asMelody = (notes: readonly TimedNote[]): MelodyNote[] => notes.map(n => ({ midi: n.midi, startBeat: n.start, durationBeats: n.duration }));

type Row = { f1?: number; precision?: number; recall?: number; tabF1?: number; notes: number; seconds: number };
const rows: Record<string, Record<string, Row>> = {};
try {
  const items = loadBenchmarkItems(process.cwd()).filter(item => !prefixes.length || prefixes.some(p => item.id.startsWith(p)));
  for (const item of items) {
    rows[item.id] = {};
    const line: string[] = [item.id.padEnd(30)];
    for (const engine of engines) {
      const started = performance.now();
      let notes = await run[engine]!(item);
      const seconds = (performance.now() - started) / 1000;
      if (item.span) notes = notes.filter(n => n.startBeat >= item.span![0] && n.startBeat < item.span![1]);
      const row: Row = { notes: notes.length, seconds };
      if (item.reference) {
        const scores = scoreNotes(item.reference, timed(notes), item.samples.length / RATE);
        Object.assign(row, { f1: scores.f1, precision: scores.precision, recall: scores.recall,
          tabF1: notes.length ? scoreAdapted(adapted(asMelody(item.reference)), adapted(notes)) : 0 });
        line.push(`${engine} F1 ${scores.f1.toFixed(2)} TAB ${row.tabF1!.toFixed(2)} (${notes.length}/${item.reference.length})`);
      } else line.push(`${engine} notes ${notes.length}`);
      rows[item.id]![engine] = row;
    }
    console.log(line.join('  '));
  }
} finally { rmSync(work, { recursive: true, force: true }); }

const summary: Record<string, Record<string, Record<string, number>>> = {};
for (const group of ['corpus', 'phoenix/flute', 'phoenix/violin', 'phoenix/mix', 'reference', 'synthetic', 'control']) {
  const ids = Object.keys(rows).filter(id => id.startsWith(group));
  if (!ids.length) continue;
  summary[group] = {};
  for (const engine of engines) {
    const values = ids.map(id => rows[id]![engine]!);
    const mean = (key: keyof Row) => values.reduce((sum, row) => sum + (row[key] ?? 0), 0) / values.length;
    summary[group]![engine] = group === 'control'
      ? { clips: ids.length, notes: values.reduce((sum, row) => sum + row.notes, 0) }
      : { clips: ids.length, f1: mean('f1'), precision: mean('precision'), recall: mean('recall'), tabF1: mean('tabF1'), seconds: mean('seconds') };
  }
}
for (const [group, byEngine] of Object.entries(summary)) {
  console.log(`${group.padEnd(16)} ` + Object.entries(byEngine).map(([engine, s]) =>
    `${engine}: ${Object.entries(s).map(([k, v]) => `${k} ${Number.isInteger(v) ? v : v.toFixed(3)}`).join(' ')}`).join('  |  '));
}
if (jsonPath) { mkdirSync(dirname(jsonPath), { recursive: true }); writeFileSync(jsonPath, JSON.stringify({ engines, summary, clips: rows }, null, 1)); }
