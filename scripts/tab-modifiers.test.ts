import assert from 'node:assert/strict';
import test from 'node:test';
import { N64_CONTROLS } from '../src/core/control-schemes';
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
  assert.deepEqual([-2, -1, 0, 1, 2].map(bend => schemeBendLabel(bend, N64_CONTROLS)), [
    'Stick down', 'Z', '', 'R', 'Stick up',
  ]);
  assert.deepEqual((['L', 'R', 'A', 'Y', 'X'] as const).map(button => noteInstruction(button, 0, N64_CONTROLS)), [
    'A', 'C-Down', 'C-Right', 'C-Left', 'C-Up',
  ]);
  assert.equal(noteInstruction('R', 1, N64_CONTROLS), 'C-Down + R');
  assert.equal(noteInstruction('R', 1), 'R + D-pad up');
});

test('a control scheme names the same tab under every grouping', () => {
  const notes = [
    { pitch: 'D4' as const, startBeat: 0, durationBeats: 1 },
    { pitch: 'F4' as const, startBeat: 1, durationBeats: 1, bend: 1 },
    { pitch: 'A4' as const, startBeat: 2, durationBeats: 1, bend: -2 },
    { pitch: 'B4' as const, startBeat: 5, durationBeats: 1, bend: -1 },
    { pitch: 'D5' as const, startBeat: 6, durationBeats: 2, bend: 2 },
  ];
  assert.equal(toTabText(notes, 4), 'L R + D-pad up A + Stick down | Y + D-pad down X + Stick up');
  assert.equal(toTabText(notes, 4, 120, { scheme: N64_CONTROLS, noteSeparator: ', ' }), 'A, C-Down + R, C-Right + Stick down | C-Left + Z, C-Up + Stick up');
});
