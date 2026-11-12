import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { analyzeModelPitchTrack, parseModelPitchTrack } from '../src/core/melody-analysis';

const track = { schemaVersion: 1, engine: { id: 'melodic-segnet', revision: 'rev', checkpointSha256: 'a'.repeat(64) }, sampleRate: 44100, durationSeconds: 1, hopSeconds: 0.01, frames: [{ timeSeconds: 0.1, frequencyHz: 440, modelScore: 0.2 }, { timeSeconds: 0.11, frequencyHz: 0, modelScore: 0.1 }, { timeSeconds: 0.12, frequencyHz: 660, modelScore: 0.8 }] };
test('retains short source candidates and timing in notes', () => {
  const result = analyzeModelPitchTrack(parseModelPitchTrack(track));
  assert.equal(result.notes.length, 2);
  assert.equal(result.events[0]!.insufficientSupport, true);
  assert.deepEqual(result.notes.map(n => n.midi), [69, 76]);
  for (let i = 0; i < result.events.length; i++) {
    assert.equal(result.notes[i]!.startBeat, result.events[i]!.startSeconds);
    assert.equal(result.notes[i]!.durationBeats, result.events[i]!.durationSeconds);
  }
  assert.match(result.warnings[0]!, /2 candidates/);
  assert.deepEqual(result.contour, track.frames);
});
test('rejects invalid frame clocks, scores and provenance', () => {
  for (const bad of [{ ...track, engine: { ...track.engine, checkpointSha256: 'bad' } }, { ...track, engine: { ...track.engine, basicPitchSha256: 'bad' } }, { ...track, engine: { ...track.engine, decoder: '' } }, { ...track, frames: [{ timeSeconds: 2, frequencyHz: 440, modelScore: 1 }] }, { ...track, frames: [{ timeSeconds: 0, frequencyHz: -1, modelScore: 2 }] }]) assert.throws(() => parseModelPitchTrack(bad));
});

test('rejects impossible clocks and malformed frame arrays before analysis', () => {
  const invalid: unknown[] = [
    { ...track, schemaVersion: 2 }, { ...track, sampleRate: 22050 },
    { ...track, hopSeconds: 1e-12 }, { ...track, durationSeconds: 15 + 1 / 44100 },
    { ...track, frames: Array.from({ length: 441002 }, () => null) },
    { ...track, frames: {} }, { ...track, frames: [null] },
    { ...track, frames: [{ timeSeconds: -0.01, frequencyHz: 440, modelScore: 0 }] },
    { ...track, frames: [track.frames[0], track.frames[0]] },
    { ...track, frames: [{ timeSeconds: 0, frequencyHz: Infinity, modelScore: 0 }] },
    { ...track, frames: [{ timeSeconds: 0, frequencyHz: 440, modelScore: NaN }] },
    { ...track, hopSeconds: 0.5, frames: Array.from({ length: 4 }, (_, i) => ({ timeSeconds: i / 4, frequencyHz: 440, modelScore: 1 })) },
  ];
  for (const value of invalid) assert.throws(() => parseModelPitchTrack(value));
  assert.doesNotThrow(() => parseModelPitchTrack({ ...track, frames: [{ timeSeconds: 0, frequencyHz: 0, modelScore: 0 }] }));
  assert.doesNotThrow(() => parseModelPitchTrack(track));
});

test('rejects overlapping frame clocks and frequencies outside audio bounds', () => {
  const frames = [
    { timeSeconds: 0.1, frequencyHz: 440, modelScore: 0.5 },
    { timeSeconds: 0.100001, frequencyHz: 0, modelScore: 0.5 },
    { timeSeconds: 0.100002, frequencyHz: 660, modelScore: 0.5 },
  ];
  assert.throws(() => parseModelPitchTrack({ ...track, frames }));
  for (const frequencyHz of [Number.MIN_VALUE, Number.MAX_VALUE]) {
    assert.throws(() => parseModelPitchTrack({ ...track, frames: [{ ...track.frames[0], frequencyHz }] }));
  }
  assert.throws(() => parseModelPitchTrack({ ...track, hopSeconds: 1 / 44100 }));
});

test('accepts fifteen seconds and rejects one additional sample', () => {
  assert.doesNotThrow(() => parseModelPitchTrack({ ...track, durationSeconds: 15 }));
  assert.throws(() => parseModelPitchTrack({ ...track, durationSeconds: 15 + 1 / 44100 }));
});
