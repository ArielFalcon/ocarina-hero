import test from 'node:test';
import assert from 'node:assert/strict';
import { projectMelody } from '../src/core/project';
import { frequencyOf, getTuning, setTuning } from '../src/core/pitches';

const melody = (pitches: number[], durations: number[]) => pitches.map((midi, i) => ({ midi, startBeat: i, durationBeats: durations[i] ?? 1 }));
const sounding = (note: ReturnType<typeof projectMelody>['notes'][number]) => 69 + 12 * Math.log2(frequencyOf(note.pitch, note.bend) / 440);

test('brief outliers preserve the playable register and source timing', () => {
  for (const offset of [-12, 0, 12]) for (const outlier of [60, 108]) for (const maxBend of [0, 1, 2]) {
    const clean = melody([72, 77, 79, 81, 86, 81, 79, 77].map(n => n + offset), Array(8).fill(1));
    const source = [...clean, { midi: outlier + offset, startBeat: 8, durationBeats: 0.01 }];
    const before = structuredClone(source);
    const result = projectMelody(source, { maxBend });
    assert.equal(result.transpositionSemitones, projectMelody(clean, { maxBend }).transpositionSemitones);
    assert.deepEqual(source, before);
    assert.deepEqual(result.notes.map(n => [n.startBeat, n.durationBeats]), source.map(n => [n.startBeat, n.durationBeats]));
    for (let i = 0; i < source.length; i++) {
      const target = source[i]!.midi + result.transpositionSemitones;
      const states = ['D4', 'F4', 'A4', 'B4', 'D5'] as const;
      const reachable = states.some(pitch => Array.from({ length: 2 * maxBend + 1 }, (_, b) => 69 + 12 * Math.log2(frequencyOf(pitch, b - maxBend) / 440)).some(m => Math.abs(m - target) <= 0.5));
      if (reachable) assert.ok(Math.abs(sounding(result.notes[i]!) - target) <= 0.5);
    }
  }
});

test('fragmentation and time scaling do not change duration coverage ties', () => {
  const a = melody([60, 72, 90], [0.3, 0.3, 0.3]);
  const b = melody([60, 60, 72, 90], [0.1, 0.2, 0.3, 0.3]);
  assert.equal(projectMelody(a).transpositionSemitones, projectMelody(b).transpositionSemitones);
  assert.equal(projectMelody(b).transpositionSemitones, projectMelody(b.map(n => ({...n, durationBeats: n.durationBeats * 1000}))).transpositionSemitones);
});

test('roundoff in equal coverage does not outrank placement preference', () => {
  const source = melody([90, 89, 76, 83, 96, 86, 85], [0.2, 1, 0.2, 1, 0.2, 1, 0.2]);
  assert.equal(projectMelody(source).transpositionSemitones, -2);
});

test('a playable note remains in register after unreachable notes', () => {
  const source = melody([89, 67, 61, 87, 73], [0.01, 2, 1, 0.01, 0.01]);
  const result = projectMelody(source);
  assert.equal(result.transpositionSemitones, 12);
  assert.ok(Math.abs(sounding(result.notes[4]!) - 85) <= 0.5);
});

test('empty and all-zero duration inputs remain valid', () => {
  assert.deepEqual(projectMelody([]).notes, []);
  const source = melody([72, 77, 79], [0, 0, 0]);
  assert.equal(projectMelody(source).transpositionSemitones, projectMelody(melody([72, 77, 79], [1, 1, 1])).transpositionSemitones);
});


test('lower weighted median includes exact half before centering the search', () => {
  const source = melody([106, 112, 74, 54], [1, 2, 1, 2]);
  assert.equal(projectMelody(source, { maxBend: 0 }).transpositionSemitones, 20);
});

test('search includes both endpoints around the median-centered octave', () => {
  const lower = melody([70, 64, 48, 92, 88, 60, 76, 80], [1, 2, 1, 2, 1, 2, 1, 2]);
  const upper = melody([92, 52, 94, 72, 48], [2, 1, 2, 1, 2]);
  assert.equal(projectMelody(lower, { maxBend: 0 }).transpositionSemitones, -6);
  assert.equal(projectMelody(upper, { maxBend: 0 }).transpositionSemitones, 29);
});

test('calibrated half-semitone boundary changes coverage and playable state', () => {
  const previous = getTuning();
  try {
    setTuning(-20);
    const calibrated = 69 + 12 * Math.log2(frequencyOf('D4') / 440);
    const source = (distance: number) => melody([76, 87, calibrated + distance, 74, 77], [1, 1, 0.01, 1, 1]);
    const inside = projectMelody(source(0.499), { maxBend: 0 });
    const outside = projectMelody(source(0.501), { maxBend: 0 });
    assert.equal(inside.transpositionSemitones, 0);
    assert.ok(Math.abs(sounding(inside.notes[2]!) - calibrated) < 0.000001);
    assert.equal(outside.transpositionSemitones, 7);
  } finally {
    setTuning(previous);
  }
});

test('playable octave leap stays in register and unreachable notes are approximated', () => {
  const source = melody([72, 84, 72], [1, 1, 1]);
  const result = projectMelody(source, { maxBend: 0 });
  assert.equal(result.transpositionSemitones, 2);
  assert.ok(Math.abs(sounding(result.notes[1]!) - sounding(result.notes[0]!) - 12) < 0.02);
  const unreachable = projectMelody(melody([72, 93, 72], [1, 1, 1]), { maxBend: 0 });
  assert.equal(unreachable.transpositionSemitones, 2);
  assert.ok(Number.isFinite(sounding(unreachable.notes[1]!)));
  assert.ok(Math.abs(sounding(unreachable.notes[1]!) - 95) > 0.5);
});

test('original two-note fragmentation preserves the coverage tie', () => {
  const original = melody([72, 80], [0.3, 0.3]);
  const fragmented = melody([72, 72, 80], [0.1, 0.2, 0.3]);
  assert.equal(projectMelody(original, { maxBend: 0 }).transpositionSemitones, 1);
  assert.equal(projectMelody(fragmented, { maxBend: 0 }).transpositionSemitones, 1);
});
