import assert from 'node:assert/strict';
import test from 'node:test';
import { applyHeadroom } from './audio-headroom';

test('offline export attenuates an overlapping peak uniformly and preserves quiet renders', () => {
  const samples = Float32Array.from([0, 0.5, -2, 1]);
  applyHeadroom(samples);
  assert.ok(Math.abs(samples[2]! + 0.95) < 1e-7);
  assert.ok(Math.abs(samples[1]! - 0.2375) < 1e-7);
  assert.ok(Math.abs(samples[3]! - 0.475) < 1e-7);
  const quiet = Float32Array.from([0.1, -0.3, 0]);
  const before = quiet.slice();
  applyHeadroom(quiet);
  assert.deepEqual(quiet, before);
});
