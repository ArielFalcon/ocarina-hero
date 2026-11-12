import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { groupPitchTrack } from '../src/core/pitch-track';

test('groups fractional pitch with time-based evidence and preserves gaps and short candidates', () => {
  for (const hop of [256 / 22050, 256 / 44100]) {
    const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
    const values = Array.from({ length: 100 }, (_, i) => i < 30 ? 69.45 + (i % 2) * 0.12 : i < 60 ? 70.5 : i < 65 ? 0 : 72.2);
    const frames = values.map((v, i) => ({ timeSeconds: i * hop, frequencyHz: v ? hz(v) : 0 }));
    const events = groupPitchTrack(frames, hop, frames.at(-1)!.timeSeconds, { lookbackSeconds: 6 * 256 / 22050, lookaheadSeconds: 3 * 256 / 22050, minChangeSeconds: 3 * 256 / 22050 });
    assert.equal(events.length, 3);
    assert.ok([69, 70].includes(events[0]!.midi));
    assert.deepEqual(events.slice(1).map(e => e.midi), [71, 72]);
    for (const event of events) {
      assert.ok(event.durationSeconds > 0);
      assert.ok(Math.abs(event.representativeHz - hz(event.fractionalMidi)) < 1e-9);
    }
    assert.ok(events[1]!.startSeconds >= events[0]!.startSeconds + events[0]!.durationSeconds - 1e-10);
    assert.ok(events[2]!.startSeconds + events[2]!.durationSeconds <= frames.at(-1)!.timeSeconds + 1e-10);
  }
});

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const settings = { lookbackSeconds: 6 * 256 / 22050, lookaheadSeconds: 3 * 256 / 22050, minChangeSeconds: 3 * 256 / 22050 };
function contour(hop: number, duration: number, pitchAt: (time: number) => number | null) {
  return Array.from({ length: Math.floor(duration / hop) + 1 }, (_, i) => {
    const timeSeconds = i * hop, pitch = pitchAt(timeSeconds);
    return { timeSeconds, frequencyHz: pitch === null ? 0 : frequency(pitch) };
  });
}
test('stable detuning and boundary-crossing vibrato do not create note changes', () => {
  const hop = 256 / 44100;
  for (const pitchAt of [() => 69.31, () => 69.45, (t: number) => 69.45 + 0.2 * Math.sin(2 * Math.PI * 5 * t)]) {
    const events = groupPitchTrack(contour(hop, 1, pitchAt), hop, 1, settings);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.midi, 69);
    assert.ok(events[0]!.fractionalMidi > 69.29 && events[0]!.fractionalMidi < 69.5);
    assert.equal(events[0]!.startSeconds, 0);
    assert.equal(events[0]!.startSeconds + events[0]!.durationSeconds, 1);
  }
});
test('a sustained semitone change splits at both physical hop clocks', () => {
  for (const hop of [256 / 44100, 256 / 22050]) {
    const events = groupPitchTrack(contour(hop, 1.2, t => t < 0.2 || t >= 1.1 ? null : t < 0.65 ? 69 : 70), hop, 1.2, settings);
    assert.deepEqual(events.map(e => e.midi), [69, 70]);
    assert.ok(Math.abs(events[0]!.startSeconds - 0.2) <= hop);
    assert.ok(Math.abs(events[1]!.startSeconds - 0.65) <= 0.025);
    assert.ok(Math.abs(events[1]!.startSeconds + events[1]!.durationSeconds - 1.1) <= hop);
  }
});
test('retains 30 and 80 ms voiced islands separated by unvoiced gaps', () => {
  const hop = 256 / 44100;
  const frames = contour(hop, 1, t => t >= 0.2 && t < 0.28 ? 69 : t >= 0.45 && t < 0.48 ? 72 : t >= 0.7 && t < 0.78 ? 76 : null);
  const events = groupPitchTrack(frames, hop, 1, settings);
  assert.deepEqual(events.map(e => e.midi), [69, 72, 76]);
  assert.deepEqual(events.map(e => e.insufficientSupport), [false, true, false]);
  for (const [i, start] of [0.2, 0.45, 0.7].entries()) assert.ok(Math.abs(events[i]!.startSeconds - start) <= hop);
  assert.deepEqual(groupPitchTrack(contour(hop, 1, () => null), hop, 1, settings), []);
});
