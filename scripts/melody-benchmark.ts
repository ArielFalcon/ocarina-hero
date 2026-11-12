/**
 * Main melody benchmark over the recording corpus.
 *
 * Runs the production local inference and analysis on the first fifteen seconds of every corpus clip,
 * compares notes with the curated source melody placed by `out/melody-benchmark/alignment.json`,
 * and compares the projected TABs. References are unvalidated arrangements: use scores to compare
 * pipeline versions, not as absolute accuracy.
 *
 * Usage: npx tsx scripts/melody-benchmark.ts [--json out/melody-benchmark/<name>.json] [--inference <script.py>] [clip ...]
 * `--inference` runs another inference script with the same arguments, e.g. a saved earlier version.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import audioLimits from '../src/core/audio-limits.json';
import { analyzeModelPitchTrack, parseModelPitchTrack } from '../src/core/melody-analysis';
import { prepareMelody } from '../src/core/prepare';
import type { MelodyNote } from '../src/core/project';
import { runModel } from '../server/melody';
import { ensureExternalMedia } from './media-directory';
import { frequencyOf } from '../src/core/pitches';
import { alignReference, scoreAdapted, scoreNotes, type Alignment, type TimedNote } from './melody-metrics';

const media = ensureExternalMedia();
const clips = join(media, 'corpus/original-clips');
const alignments: Record<string, Alignment & { clip?: string; annotation?: string }> = JSON.parse(readFileSync(join(media, 'melody-benchmark/alignment.json'), 'utf8'));
const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? args.splice(jsonIndex, 2)[1] : undefined;
const inferenceIndex = args.indexOf('--inference');
const inference = inferenceIndex >= 0 ? args.splice(inferenceIndex, 2)[1] : undefined;
const spawnInference = ((command: string, argv: readonly string[], options: object) =>
  spawn(command, inference ? [inference, ...argv.slice(1)] : argv, options)) as typeof spawn;
const ids = args.length ? args : Object.keys(alignments).sort();

/** Sounding pitch of the projected TAB, as the player would hear it. */
function adapted(melody: readonly MelodyNote[]): TimedNote[] {
  return prepareMelody({ melody, preserveTiming: true }, { simplify: false, maxBend: 2 }).notes.map((note) => ({
    start: note.startBeat, duration: note.durationBeats, midi: Math.round(69 + 12 * Math.log2(frequencyOf(note.pitch, note.bend ?? 0) / 440)) }));
}
const asMelody = (notes: readonly TimedNote[]): MelodyNote[] => notes.map((n) => ({ midi: n.midi, startBeat: n.start, durationBeats: n.duration }));

const rows: Record<string, Record<string, number>> = {};
const work = mkdtempSync(join(tmpdir(), 'melody-benchmark-'));
try {
  for (const id of ids) {
    const entry = alignments[id];
    if (!entry) continue;
    // Extra references outside the corpus name their media-relative clip and annotation.
    const annotation = entry.annotation ? join(media, entry.annotation) : join(clips, id, 'annotations/source-selection.json');
    const clip = entry.clip ? join(media, entry.clip) : join(clips, id, 'clip.wav');
    if (!existsSync(annotation)) continue;
    const source = JSON.parse(readFileSync(annotation, 'utf8')) as { tempoBpm: number; melody: MelodyNote[] };
    const beat = 60 / source.tempoBpm;
    const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', clip, '-t', String(audioLimits.maxDurationSeconds),
      '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 64 * 1024 * 1024 });
    const input = join(work, `${id}.f32`);
    writeFileSync(input, pcm);
    const result = await runModel(input, 44100, spawnInference).result;
    if (result.stdout === undefined) throw new Error(`${id}: ${result.error ?? 'oversized output'}`);
    const analysis = analyzeModelPitchTrack(parseModelPitchTrack(JSON.parse(result.stdout)));
    const seconds = analysis.durationSeconds;
    const reference = alignReference(source.melody.map((n) => ({ start: n.startBeat * beat, duration: n.durationBeats * beat, midi: n.midi })), entry, seconds);
    const estimate: TimedNote[] = analysis.notes.map((n) => ({ start: n.startBeat, duration: n.durationBeats, midi: n.midi }));
    const scores = scoreNotes(reference, estimate, seconds);
    // tabF1: adapted estimate vs adapted reference. adaptationLoss: how much of the reference itself survives adaptation.
    const adaptedReference = adapted(asMelody(reference));
    const tabF1 = scoreAdapted(adaptedReference, adapted(analysis.notes));
    const adaptationFidelity = scoreAdapted(reference, adaptedReference);
    rows[id] = { ...scores, tabF1, adaptationFidelity, reference: reference.length, estimate: estimate.length };
    console.log(`${id.padEnd(18)} F1 ${scores.f1.toFixed(2)}  P ${scores.precision.toFixed(2)}  R ${scores.recall.toFixed(2)}  pitch ${scores.pitchAccuracy.toFixed(2)}  seq ${scores.sequence.toFixed(2)}  TAB ${tabF1.toFixed(2)}  refTAB ${adaptationFidelity.toFixed(2)}  notes ${estimate.length}/${reference.length}`);
  }
} finally { rmSync(work, { recursive: true, force: true }); }
const keys = ['f1', 'precision', 'recall', 'pitchAccuracy', 'sequence', 'tabF1', 'adaptationFidelity'] as const;
const values = Object.values(rows);
const mean = Object.fromEntries(keys.map((k) => [k, values.reduce((sum, row) => sum + row[k]!, 0) / Math.max(1, values.length)]));
console.log(`MEAN (${values.length} clips) ` + keys.map((k) => `${k} ${mean[k]!.toFixed(3)}`).join('  '));
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ mean, clips: rows }, null, 1));
