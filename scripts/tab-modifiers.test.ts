import assert from 'node:assert/strict';
import test from 'node:test';
import { bendLabel, toTabText } from '../src/core/tab';

test('tab instructions identify the physical control for both modifier directions', () => {
  assert.deepEqual([-2, -1, 0, 1, 2].map(bendLabel), [
    'Stick down', 'D-pad down', '', 'D-pad up', 'Stick up',
  ]);
  const notes = [-2, -1, 0, 1, 2].map((bend, index) => ({
    pitch: 'F4' as const, bend, startBeat: index, durationBeats: 1,
  }));
  assert.equal(toTabText(notes, 8),
    'R + Stick down R + D-pad down R R + D-pad up R + Stick up');
});
