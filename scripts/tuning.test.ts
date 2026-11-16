import assert from 'node:assert/strict';
import test from 'node:test';
import { PITCHES, SWITCH2_TUNING, frequencyOf, type TuningProfile } from '../src/core/pitches';

const BENDS = [-2, -1, 0, 1, 2];

test('the Switch 2 tuning plays every pitch and bend at its measured frequency', () => {
  // Medians of the 25 Switch 2 gameplay holds, bends -2..2.
  const measured = [
    531.58, 559.71, 595.79, 632.46, 667.29,
    624.28, 662.1, 700.23, 738.03, 786.07,
    796.14, 842.49, 894.56, 944.96, 1002.16,
    895.25, 944.99, 1001.21, 1059.33, 1124.68,
    1064.93, 1109.39, 1190.8, 1270.22, 1333.86,
  ];
  const cents = PITCHES.flatMap(pitch => BENDS.map(bend => frequencyOf(pitch.id, bend))).map((hz, i) => 1200 * Math.log2(hz / measured[i]!));
  assert.deepEqual(cents.map(c => Math.abs(c) < 0.1), measured.map(() => true), cents.map(c => c.toFixed(2)).join(' '));
  assert.equal(frequencyOf('D5', 1, SWITCH2_TUNING), frequencyOf('D5', 1));
});

test('a tuning profile moves only the notes and bends it corrects', () => {
  const flat: TuningProfile = { noteCents: { D4: 0, F4: 0, A4: 0, B4: 0, D5: 0 }, bendCents: { D5: { 1: 100 } } };
  assert.equal(frequencyOf('A4', 0, flat), 880);
  assert.equal(frequencyOf('D5', 1, flat), frequencyOf('D5', 2, flat));
  assert.equal(frequencyOf('D5', -1, flat), frequencyOf('D5', -1, { ...flat, bendCents: {} }));
});
