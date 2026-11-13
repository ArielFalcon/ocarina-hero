import assert from 'node:assert/strict';
import test from 'node:test';
import { bendLabel, noteInstruction, schemeBendLabel, toTabText } from '../src/core/tab';

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

test('the N64 control scheme names the original buttons and modifiers', () => {
  assert.deepEqual([-2, -1, 0, 1, 2].map(bend => schemeBendLabel(bend, 'n64')), [
    'Stick down', 'Z', '', 'R', 'Stick up',
  ]);
  assert.deepEqual((['L', 'R', 'A', 'Y', 'X'] as const).map(button => noteInstruction(button, 0, 'n64')), [
    'A', 'C-Down', 'C-Right', 'C-Left', 'C-Up',
  ]);
  assert.equal(noteInstruction('R', 1, 'n64'), 'C-Down + R');
  assert.equal(noteInstruction('R', 1), 'R + D-pad up');
});
