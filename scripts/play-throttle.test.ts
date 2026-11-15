import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayThrottle } from '../src/ui/play-throttle';

test('a repeat of the same song and action inside the window is dropped, and passes after it', () => {
  const allow = createPlayThrottle(1000);
  assert.equal(allow('zelda', 'quick-play', 0), true);
  assert.equal(allow('zelda', 'quick-play', 999), false, 'inside the window');
  assert.equal(allow('zelda', 'quick-play', 1000), true, 'window elapsed');
});

test('a different song or action is counted separately', () => {
  const allow = createPlayThrottle(1000);
  assert.equal(allow('zelda', 'quick-play', 0), true);
  assert.equal(allow('mario', 'quick-play', 1), true);
  assert.equal(allow('zelda', 'open', 2), true);
});

test('a dropped repeat does not extend the window', () => {
  const allow = createPlayThrottle(1000);
  allow('zelda', 'open', 0);
  allow('zelda', 'open', 900);
  assert.equal(allow('zelda', 'open', 1000), true);
});
