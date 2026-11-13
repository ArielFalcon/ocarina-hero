import assert from 'node:assert/strict';
import test from 'node:test';
import { GamepadInput, type PadSnapshot } from '../src/ui/gamepad';

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
  assert.deepEqual(bends().sort(), ['bend -1', 'unbend pad:0:bend:dpad-up']);
  input.update([pad([], [0, -0.49, 0, 0.49])]);
  assert.deepEqual(bends(), ['unbend pad:0:bend:dpad-down']);
  input.update([pad([], [0, -0.5, 0, 0])]);
  assert.deepEqual(bends(), ['bend 2']);
  input.update([pad([], [0, 0, 0, 0.9])]);
  assert.deepEqual(bends().sort(), ['bend -2', 'unbend pad:0:bend:left-stick-up']);
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
