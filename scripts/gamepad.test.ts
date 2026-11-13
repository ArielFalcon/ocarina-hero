import assert from 'node:assert/strict';
import test from 'node:test';
import { GamepadInput, type PadSnapshot } from '../src/ui/gamepad';
import { buttonLabel, schemeBendLabel } from '../src/core/tab';
import type { ControllerButton } from '../src/core/pitches';

function fixture() {
  const calls: string[] = [];
  const input = new GamepadInput({
    noteDown: (source, button) => { calls.push(`down ${button} ${source}`); },
    noteUp: source => { calls.push(`up ${source}`); },
    bendDown: (source, value) => { calls.push(`bend ${value} ${source}`); },
    bendUp: source => { calls.push(`unbend ${source}`); },
  });
  return { calls, input };
}

function pad(pressed: readonly number[] = [], axes: readonly number[] = [0, 0, 0, 0], mapping = 'standard'): PadSnapshot {
  return { index: 0, mapping, axes, buttons: Array.from({ length: 17 }, (_, index) => ({ pressed: pressed.includes(index) })) };
}

test('face and shoulder buttons play their note once per press, by position', () => {
  const { calls, input } = fixture();
  for (const [index, button] of [[4, 'L'], [5, 'R'], [1, 'A'], [2, 'Y'], [3, 'X']] as const) {
    calls.length = 0;
    input.update([pad([index])]);
    input.update([pad([index])]);
    input.update([pad()]);
    assert.deepEqual(calls.map(call => call.split(' ').slice(0, 2).join(' ')), [`down ${button}`, 'up pad:0:note:' + button]);
  }
  calls.length = 0;
  input.update([pad([0])]);
  assert.deepEqual(calls, []);
});

test('the D-pad bends a semitone and a stick past its dead zone bends a tone, up being positive', () => {
  const { calls, input } = fixture();
  const bends = () => calls.splice(0).map(call => call.split(' ').slice(0, 2).join(' '));
  input.update([pad([12])]);
  assert.deepEqual(bends(), ['bend 1']);
  input.update([pad([13])]);
  assert.deepEqual(bends().sort(), ['bend -1', 'unbend pad:0:bend:button-12']);
  input.update([pad([], [0, -0.49, 0, 0.49])]);
  assert.deepEqual(bends(), ['unbend pad:0:bend:button-13']);
  input.update([pad([], [0, -0.5, 0, 0])]);
  assert.deepEqual(bends(), ['bend 2']);
  input.update([pad([], [0, 0, 0, 0.9])]);
  assert.deepEqual(bends().sort(), ['bend -2', 'unbend pad:0:bend:axis-1-up']);
});

test('a bend pressed together with a note is applied before the note sounds', () => {
  const { calls, input } = fixture();
  input.update([pad([1, 12])]);
  assert.deepEqual(calls.map(call => call.split(' ')[0]), ['bend', 'down']);
});

test('only standard layouts are used, and a pad that disappears releases what it held', () => {
  const { calls, input } = fixture();
  assert.equal(input.update([pad([4], [0, 0, 0, 0], '')]), false);
  assert.deepEqual(calls, []);
  assert.equal(input.update([null, pad([4, 12])]), true);
  calls.length = 0;
  assert.equal(input.update([null]), false);
  assert.deepEqual(calls.map(call => call.split(' ')[0]).sort(), ['unbend', 'up']);
});

test('under the N64 scheme the A button and the right stick play the notes the theme names A and C', () => {
  const { calls, input } = fixture();
  const played = (snapshot: PadSnapshot) => {
    calls.length = 0;
    input.update([snapshot], 'n64');
    input.update([pad()], 'n64');
    return calls.filter(call => call.startsWith('down')).map(call => buttonLabel(call.split(' ')[1] as ControllerButton, 'n64'));
  };
  assert.deepEqual(played(pad([0])), ['A']);
  assert.deepEqual(played(pad([1])), ['A']);
  assert.deepEqual(played(pad([], [0, 0, 0, -1])), ['C-Up']);
  assert.deepEqual(played(pad([], [0, 0, 0, 1])), ['C-Down']);
  assert.deepEqual(played(pad([], [0, 0, -1, 0])), ['C-Left']);
  assert.deepEqual(played(pad([], [0, 0, 1, 0])), ['C-Right']);
  assert.deepEqual(played(pad([], [0, 0, 0.9, -0.6])), ['C-Right']);
  assert.deepEqual(played(pad([], [0, 0, 0.49, 0.49])), []);
  assert.deepEqual(played(pad([2, 3, 12, 13])), []);
});

test('under the N64 scheme R and Z bend a semitone and only the left stick bends a tone', () => {
  const { calls, input } = fixture();
  const bent = (snapshot: PadSnapshot) => {
    calls.length = 0;
    input.update([snapshot], 'n64');
    input.update([pad()], 'n64');
    return calls.filter(call => call.startsWith('bend')).map(call => schemeBendLabel(Number(call.split(' ')[1]), 'n64'));
  };
  assert.deepEqual(bent(pad([5])), ['R']);
  assert.deepEqual(bent(pad([7])), ['R']);
  assert.deepEqual(bent(pad([4])), ['Z']);
  assert.deepEqual(bent(pad([6])), ['Z']);
  assert.deepEqual(bent(pad([], [0, -1, 0, 0])), ['Stick up']);
  assert.deepEqual(bent(pad([], [0, 1, 0, 0])), ['Stick down']);
  assert.deepEqual(bent(pad([], [0, 0, 0, -1])), []);
});

test('changing the scheme releases what the previous one held', () => {
  const { calls, input } = fixture();
  input.update([pad([4])]);
  calls.length = 0;
  input.update([pad([4])], 'n64');
  assert.deepEqual(calls.map(call => call.split(' ')[0]), ['up', 'bend']);
});
