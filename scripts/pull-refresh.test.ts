import assert from 'node:assert/strict';
import test from 'node:test';
import { PULL_MAX, PULL_THRESHOLD, PullGesture } from '../src/ui/pull-refresh';
import { createRankingCache } from '../src/ui/ranking-cache';

/** Finger travel that yields a given pull, given the gesture's resistance. */
const travelFor = (pull: number) => pull * 2;

test('a pull arms only from the top of the list and only while not refreshing', () => {
  const gesture = new PullGesture();
  gesture.start(100, false);
  assert.equal(gesture.move(100 + travelFor(PULL_MAX)), null, 'a scrolled list keeps its native scroll');
  assert.equal(gesture.end(), false);

  gesture.start(100, true);
  gesture.move(100 + travelFor(PULL_MAX));
  assert.equal(gesture.end(), true);
  gesture.refreshing = true;
  gesture.start(100, true);
  assert.equal(gesture.move(100 + travelFor(PULL_MAX)), null, 'a second pull during a refresh is ignored');
  assert.equal(gesture.end(), false);
});

test('moving up leaves the scroll alone; pulling down resists and stops at the maximum', () => {
  const gesture = new PullGesture();
  gesture.start(200, true);
  assert.equal(gesture.move(150), null);
  assert.deepEqual(gesture.move(200 + travelFor(20)), { pull: 20, progress: 20 / PULL_THRESHOLD });
  assert.deepEqual(gesture.move(200 + travelFor(PULL_MAX) + 400), { pull: PULL_MAX, progress: 1 });
});

test('a release refreshes only at or beyond the threshold, and only once per pull', () => {
  const gesture = new PullGesture();
  gesture.start(0, true);
  gesture.move(travelFor(PULL_THRESHOLD - 1));
  assert.equal(gesture.end(), false);

  gesture.start(0, true);
  gesture.move(travelFor(PULL_THRESHOLD));
  assert.equal(gesture.end(), true);
  assert.equal(gesture.end(), false, 'a second release without a new pull does nothing');
});

test('pulling back above the start after crossing the threshold cancels the refresh', () => {
  const gesture = new PullGesture();
  gesture.start(0, true);
  gesture.move(travelFor(PULL_MAX));
  gesture.move(-10);
  assert.equal(gesture.end(), false);
});

test('the ranking cache reuses a fresh list unless forced; a failure keeps the last good list and rejects only when forced', async () => {
  const lists = [['a'], ['b']];
  let calls = 0;
  let fail = false;
  const load = createRankingCache(async () => {
    if (fail) throw new Error('offline');
    return lists[calls++]!;
  }, 60_000);

  assert.deepEqual(await load({ now: 0 }), ['a']);
  assert.deepEqual(await load({ now: 59_999 }), ['a'], 'a fresh list is reused');
  assert.deepEqual(await load({ now: 1, force: true }), ['b'], 'force bypasses the fresh list');
  fail = true;
  await assert.rejects(load({ now: 2, force: true }), /offline/, 'a forced refresh reports its failure');
  assert.deepEqual(await load({ now: 2 }), ['b'], 'the failed refresh keeps the last good list');
  assert.deepEqual(await load({ now: 70_000 }), ['b'], 'an unforced failure keeps the last good list silently');
  assert.equal(calls, 2);
});
