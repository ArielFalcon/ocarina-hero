import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BASIC_PITCH_MODEL_SHA256 } from '../src/audio/basic-pitch-model';
import {
  BASIC_PITCH_HOP_SECONDS as HOP, BASIC_PITCH_WINDOW_FRAMES, BASIC_PITCH_WINDOW_SAMPLES, basicPitchFrames, decodeFrames, resample,
} from '../src/core/basic-pitch';
import {
  DEFAULT_DECODER, MIDI_HIGH, MIDI_LOW, decodeMelody, emptyGrid, enforceMinimum, findPeaks, minimumNoteSeconds, type PitchGrid,
} from '../src/core/melody-decoder';

const STATES = MIDI_HIGH - MIDI_LOW + 1;
const frames = (seconds: number) => Math.round(seconds / HOP);

/** Posterior grid with (midi, first, last, value) islands on a zero background. */
function grid(length: number, islands: [number, number, number, number][], floor = 0): PitchGrid {
  const g = emptyGrid(length);
  g.values.fill(floor);
  for (const [midi, first, last, value] of islands) for (let j = first; j < last; j++) g.values[j * STATES + midi - MIDI_LOW] = value;
  return g;
}
const notesOf = (notes: PitchGrid, onsets = emptyGrid(notes.frames), parameters = DEFAULT_DECODER) =>
  decodeMelody(notes, onsets, HOP, parameters).map(n => [n.midi, n.startFrame, n.endFrame]);

test('a one-frame excursion inside a sustained note is absorbed', () => {
  const g = grid(200, [[72, 20, 180, 0.8], [79, 100, 101, 0.95]]);
  g.values[100 * STATES + 72 - MIDI_LOW] = 0.05;
  assert.deepEqual(notesOf(g), [[72, 20, 180]]);
});

test('an isolated blip shorter than the minimum is dropped while a longer note is kept', () => {
  const blip = frames(0.03), note = frames(0.2);
  assert.deepEqual(notesOf(grid(200, [[70, 20, 20 + blip, 0.9], [74, 100, 100 + note, 0.9]])), [[74, 100, 100 + note]]);
});

test('a sustained pitch change starts the next note at its boundary', () => {
  const change = 60 + frames(0.2);
  const got = notesOf(grid(200, [[72, 60, change, 0.8], [76, change, 160, 0.8]]));
  assert.deepEqual(got.map(n => n[0]), [72, 76]);
  assert.ok(Math.abs(got[0]![2]! - change) <= 1);
});

test('silence and a weak posterior floor stay unvoiced: posteriors are absolute, never normalized per clip', () => {
  assert.deepEqual(notesOf(grid(150, [])), []);
  const floor = grid(300, [], 0.1); // below the voicing threshold; per-clip normalization would raise it to certainty
  floor.values[150 * STATES + 60 - MIDI_LOW] = 0.8; // one loud click frame
  assert.deepEqual(notesOf(floor), []);
});

test('a short run is absorbed by the longer touching neighbour, else unvoiced', () => {
  const path = Int32Array.from([...Array(30).fill(10), ...Array(3).fill(20), ...Array(12).fill(14), ...Array(10).fill(-1), ...Array(3).fill(5), ...Array(10).fill(-1)]);
  const out = Array.from(enforceMinimum(path, 5));
  assert.deepEqual(out.slice(0, 33), Array(33).fill(10));
  assert.deepEqual(out.slice(33, 45), Array(12).fill(14));
  assert.deepEqual(out.slice(45), Array(23).fill(-1));
});

test('the minimum note duration follows the onset rate within its bounds', () => {
  const length = frames(4);
  const notes = grid(length, [[72, 0, length, 0.9]]);
  const onsets = (rate: number) => {
    const g = emptyGrid(length);
    for (let t = 0; t < 4; t += 1 / rate) g.values[Math.floor(t / HOP) * STATES + 72 - MIDI_LOW] = 0.9;
    return g;
  };
  assert.ok(Math.abs(minimumNoteSeconds(onsets(10), notes, HOP) - 0.05) < 0.01);
  assert.equal(minimumNoteSeconds(onsets(3), notes, HOP), DEFAULT_DECODER.minNoteSeconds);
  assert.equal(minimumNoteSeconds(onsets(40), notes, HOP), DEFAULT_DECODER.minNoteFloorSeconds);
  assert.equal(minimumNoteSeconds(emptyGrid(length), emptyGrid(length), HOP), DEFAULT_DECODER.minNoteSeconds);
});

test('peaks closer than the spacing keep the taller one', () => {
  assert.deepEqual(findPeaks(Float64Array.from([0, 0.6, 0, 0.9, 0, 0, 0, 0, 0.7, 0]), 0.5, 3), [3, 8]);
  assert.deepEqual(findPeaks(Float64Array.from([0, 0.6, 0, 0.4, 0]), 0.5, 1), [1]);
});

test('a strong onset of the held pitch splits a repeat only when splitting is enabled', () => {
  const length = 120;
  const notes = grid(length, [[69, 10, 110, 0.9]]);
  const onsets = grid(length, [[69, 10, 11, 0.9], [69, 60, 61, 0.9]]);
  assert.deepEqual(notesOf(notes, onsets, { ...DEFAULT_DECODER, repeatOnsetThreshold: 2 }), [[69, 10, 110]]);
  assert.deepEqual(notesOf(notes, onsets, { ...DEFAULT_DECODER, repeatOnsetThreshold: 0.5 }), [[69, 10, 60], [69, 60, 110]]);
});

test('Basic Pitch windows stitch in order without overlap duplicates and map piano keys to MIDI rows', async () => {
  const calls: Float32Array[] = [];
  const model = async (window: Float32Array) => {
    calls.push(window);
    const notes = new Float32Array(BASIC_PITCH_WINDOW_FRAMES * 88);
    // Key 48 is MIDI 69: its value encodes (window, frame).
    for (let j = 0; j < BASIC_PITCH_WINDOW_FRAMES; j++) notes[j * 88 + 48] = (calls.length - 1) * 1000 + j;
    return { notes, onsets: new Float32Array(notes.length) };
  };
  const audio = new Float32Array(22050 * 5);
  const out = await basicPitchFrames(model, audio);
  assert.equal(out.notes.frames, Math.floor(audio.length * 86 / 22050));
  assert.ok(calls.every(w => w.length === BASIC_PITCH_WINDOW_SAMPLES));
  const row = (j: number) => out.notes.values[j * STATES + 69 - MIDI_LOW];
  assert.equal(row(0), 15);
  assert.equal(row(141), 156);
  assert.equal(row(142), 1015);
  assert.equal(out.notes.values[STATES + 70 - MIDI_LOW], 0);
  const offset = HOP * (BASIC_PITCH_WINDOW_FRAMES - BASIC_PITCH_WINDOW_SAMPLES / 256) + 0.0018;
  assert.ok(Math.abs(out.times[BASIC_PITCH_WINDOW_FRAMES]! - (BASIC_PITCH_WINDOW_FRAMES * HOP - offset)) < 1e-12);
});

test('decoded notes are placed on the Basic Pitch clock in seconds', () => {
  const length = 300;
  const times = Float64Array.from({ length }, (_, i) => i * HOP);
  const out = decodeFrames({ times, notes: grid(length, [[72, 50, 150, 0.9]]), onsets: emptyGrid(length) }, length * HOP);
  assert.equal(out.notes.length, 1);
  assert.equal(out.notes[0]!.midi, 72);
  assert.ok(Math.abs(out.notes[0]!.startBeat - 50 * HOP) < 1e-9);
  assert.ok(Math.abs(out.notes[0]!.durationBeats - 100 * HOP) < 1e-9);
  assert.ok(Math.abs(out.voicedFrameFraction - 100 / length) < 1e-9);
});

test('resampling keeps an in-band tone and removes one above the new Nyquist frequency', () => {
  const tone = (hz: number) => Float32Array.from({ length: 44100 }, (_, i) => Math.sin(2 * Math.PI * hz * i / 44100));
  const rms = (x: Float32Array) => Math.sqrt(x.slice(1000, -1000).reduce((s, v) => s + v * v, 0) / (x.length - 2000));
  const kept = resample(tone(1000), 44100, 22050);
  assert.equal(kept.length, 22050);
  assert.ok(Math.abs(rms(kept) - Math.SQRT1_2) < 0.01);
  // Zero crossings confirm the frequency survives: 1000 Hz → 2000 crossings per second.
  let crossings = 0;
  for (let i = 1; i < kept.length; i++) if ((kept[i - 1]! < 0) !== (kept[i]! < 0)) crossings++;
  assert.ok(Math.abs(crossings - 2000) <= 2);
  assert.ok(rms(resample(tone(15000), 44100, 22050)) < 0.01);
  assert.equal(resample(tone(1000), 48000, 22050).length, Math.floor(44100 * 22050 / 48000));
});

test('the bundled model matches the recorded provenance digest', () => {
  assert.equal(createHash('sha256').update(readFileSync('public/models/basic-pitch-nmp.onnx')).digest('hex'), BASIC_PITCH_MODEL_SHA256);
});
