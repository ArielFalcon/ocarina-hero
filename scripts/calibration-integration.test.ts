import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrate } from '../src/core/calibration';
import { detectPitch } from '../src/core/pitch-detect';
import { pitchById, setTuning } from '../src/core/pitches';
import { OcarinaEngine } from '../src/audio/engine';
import { projectMelody } from '../src/core/project';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function tone(hz: number): Float32Array {
  return Float32Array.from(
    { length: 24000 },
    (_, i) => Math.sin((2 * Math.PI * hz * i) / 24000),
  );
}

afterEach(() => {
  setTuning(0);
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

test('high notes calibrate repeatedly without losing the previous tuning', () => {
  for (const hz of [1010, 1200.88]) {
    setTuning(0);
    const first = calibrate(tone(hz), 24000);
    assert.ok(first, `no result for ${hz}`);
    assert.ok(first.tuningCents > 12 && first.tuningCents < 18);
    setTuning(first.tuningCents);
    const second = calibrate(tone(hz), 24000);
    assert.ok(second);
    assert.ok(Math.abs(second.tuningCents - first.tuningCents) < 1);
  }
});

test('pitch detection resolves the highest bent register without losing lower notes', () => {
  for (const hz of [595.49, 1336]) {
    const result = detectPitch(tone(hz).subarray(0, 1024), 24000);
    assert.ok(Math.abs(result.hz - hz) < 3);
    assert.ok(result.confidence > 0.9);
  }
});

test('calibration frame selection does not move with the prior fine tuning', () => {
  const samples = new Float32Array(48000);
  samples.set(tone(1010));
  samples.set(tone(1036.62), 24000);
  const first = calibrate(samples, 24000);
  assert.ok(first);
  setTuning(15);
  const second = calibrate(samples, 24000);
  assert.ok(second);
  assert.equal(second.frames, first.frames);
  assert.ok(Math.abs(second.tuningCents - first.tuningCents) < 0.001);
});

test('live bend changes and returns preserve the calibrated sounding register', () => {
  setTuning(9);
  for (const [id, base, up, down] of [
    ['D5', 1196.79, 1278.25, 1117.30],
    ['A4', 898.69, 952.13, 848.25],
  ] as const) {
    const engine = new OcarinaEngine() as any;
    const values: number[] = [];
    const param = () => ({
      value: 0,
      cancelScheduledValues() {},
      setValueAtTime(value: number) { values.push(value); },
      linearRampToValueAtTime(value: number) { values.push(value); },
    });
    const ctx = { currentTime: 0 };
    engine.ensure = () => ({ ctx, master: {} });
    engine.createVoice = (_ctx: unknown, _master: unknown, hz: number) => {
      values.push(hz);
      return {
        ctx,
        fundamental: { frequency: param() },
        overtone: { frequency: param() },
        third: { frequency: param() },
      };
    };
    engine.noteOn(pitchById(id));
    engine.setBend(1);
    engine.setBend(-1);
    engine.setBend(0);
    assert.ok(Math.abs(values[0]! - base) < 3);
    assert.ok(Math.abs(values[1]! - up) < 1);
    assert.ok(Math.abs(values[4]! - down) < 1);
    assert.ok(Math.abs(values[7]! - base) < 1);
  }
});

test('projection can choose a better tuned alternative at the same nominal pitch', () => {
  const melody = [{ midi: 76, startBeat: 0, durationBeats: 1 }];
  for (const [tuning, pitch, bend] of [[-20, 'D4', 2], [0, 'F4', -1]] as const) {
    setTuning(tuning);
    const result = projectMelody(melody, { maxBend: 2 });
    assert.equal(result.transpositionSemitones, 0);
    assert.deepEqual([result.notes[0]?.pitch, result.notes[0]?.bend], [pitch, bend]);
  }
});

test('scheduled bent notes start at their calibrated targets', async () => {
  const engine = new OcarinaEngine() as any;
  const calls: number[] = [];
  engine.ensure = () => ({ ctx: { currentTime: 0, state: 'running' }, master: {} });
  engine.createVoice = (_ctx: unknown, _master: unknown, hz: number) => { calls.push(hz); return {}; };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 1, clearInterval() {} } });
  await engine.play({ title: '', tempoBpm: 120, notes: [
    { pitch: 'D5', bend: 1, startBeat: 0, durationBeats: 1 },
    { pitch: 'A4', bend: -1, startBeat: 2, durationBeats: 1 },
  ] });
  assert.ok(Math.abs(calls[0]! - 1271.3) < 1);
  assert.ok(Math.abs(calls[1]! - 843.85) < 1);
});
