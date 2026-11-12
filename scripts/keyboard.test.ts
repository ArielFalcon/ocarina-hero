import assert from 'node:assert/strict';
import test from 'node:test';
import { actionForCode, assignKey, DEFAULT_BINDINGS, readBindings } from '../src/ui/keyboard';

test('rebinding changes physical-key lookup and rejects conflicting or reserved keys without mutation', () => {
  const original = { ...DEFAULT_BINDINGS };
  const mapped = assignKey(original, 'L', 'KeyZ')!;
  assert.equal(actionForCode(mapped, 'KeyZ'), 'L');
  assert.equal(actionForCode(mapped, 'KeyQ'), undefined);
  const modifier = assignKey(mapped, 'stick-up', 'Digit8')!;
  assert.equal(actionForCode(modifier, 'Digit8'), 'stick-up');
  assert.equal(actionForCode(modifier, 'ArrowUp'), undefined);
  assert.equal(assignKey(modifier, 'R', 'KeyZ'), null);
  assert.equal(assignKey(modifier, 'R', 'Escape'), null);
  assert.equal(assignKey(modifier, 'R', 'MetaLeft'), null);
  assert.equal(original.L, 'KeyQ');
});

test('stored mappings must be complete, valid and unique before replacing defaults', () => {
  const valid = { ...DEFAULT_BINDINGS, L: 'KeyZ', 'dpad-down': 'Digit7' };
  assert.deepEqual(readBindings(valid), valid);
  for (const invalid of [null, { L: 'KeyZ' }, { ...valid, R: 'KeyZ' }, { ...valid, X: 'Tab' }]) {
    assert.deepEqual(readBindings(invalid), DEFAULT_BINDINGS);
  }
});
