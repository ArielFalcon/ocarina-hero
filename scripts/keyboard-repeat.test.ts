import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Controls } from '../src/ui/input';
import { DEFAULT_BINDINGS, handleKeyDown } from '../src/ui/keyboard';

test('plain arrows cancel initial and repeated keydown while activating the bend once', () => {
  const bends: number[] = [];
  const controls = new Controls(() => {}, () => {}, (value) => bends.push(value));
  let prevented = 0;
  const event = { code: 'ArrowUp', repeat: false, ctrlKey: false, metaKey: false, altKey: false, preventDefault: () => { prevented++; } };
  assert.equal(handleKeyDown(event, controls, { ...DEFAULT_BINDINGS }), true);
  assert.equal(handleKeyDown({ ...event, repeat: true }, controls, { ...DEFAULT_BINDINGS }), true);
  assert.equal(prevented, 2);
  assert.deepEqual(bends, [2]);
  controls.reset();
  assert.equal(handleKeyDown({ ...event, repeat: true }, controls, { ...DEFAULT_BINDINGS }), true);
  assert.deepEqual(bends, [2, 0]);
  assert.equal(handleKeyDown({ ...event, ctrlKey: true }, controls, { ...DEFAULT_BINDINGS }), false);
  assert.equal(handleKeyDown({ ...event, code: 'KeyZ' }, controls, { ...DEFAULT_BINDINGS }), false);
  assert.equal(prevented, 3);
});
