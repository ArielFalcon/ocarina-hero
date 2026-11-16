import assert from 'node:assert/strict';
import test from 'node:test';
import { PITCHES, SWITCH2_TUNING, frequencyOf, type TuningProfile } from '../src/core/pitches';

const BENDS = [-2, -1, 0, 1, 2];

test('the Switch 2 tuning keeps the calibrated frequency of every pitch and bend', () => {
  const hz = PITCHES.flatMap(pitch => BENDS.map(bend => Number(frequencyOf(pitch.id, bend).toFixed(6))));
  assert.deepEqual(hz, [
    530.522314, 562.068813, 595.491163, 630.900911, 668.416231,
    623.808191, 660.901756, 700.20102, 741.837139, 785.949071,
    796.488496, 843.850166, 894.028108, 947.189786, 1003.512622,
    892.067089, 945.112158, 1001.311452, 1060.852529, 1123.934103,
    1060.688895, 1111.495085, 1190.58303, 1271.620549, 1336.384266,
  ]);
  assert.equal(frequencyOf('D5', 1, SWITCH2_TUNING), frequencyOf('D5', 1));
});

test('a tuning profile moves only the notes and bends it corrects', () => {
  const flat: TuningProfile = { noteCents: { D4: 0, F4: 0, A4: 0, B4: 0, D5: 0 }, bendCents: { D5: { 1: 100 } } };
  assert.equal(frequencyOf('A4', 0, flat), 880);
  assert.equal(frequencyOf('D5', 1, flat), frequencyOf('D5', 2, flat));
  assert.equal(frequencyOf('D5', -1, flat), frequencyOf('D5', -1, { ...flat, bendCents: {} }));
});
