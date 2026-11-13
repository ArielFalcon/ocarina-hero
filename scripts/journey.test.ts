import assert from 'node:assert/strict';
import test from 'node:test';
import { isEmptyJourney, journey, JOURNEY_SAVED_LIMIT } from '../src/ui/journey';

const song = (id: string, level = 'easy') => ({ id, difficulty: { level } });
const entries = [song('a'), song('b'), song('c'), song('d', 'hard'), song('e'), song('f'), song('g'), song('h')];
const opened = (openedAt: number, completed = false, bestCombo = 0) => ({ completed, bestCombo, openedAt });

test('a first visit is empty: nothing to resume, suggest or list', () => {
  const result = journey(entries, {}, new Set());
  assert.equal(result.resume, null);
  assert.equal(result.next, null);
  assert.deepEqual([result.completed, result.total, result.savedCount], [0, entries.length, 0]);
  assert.equal(isEmptyJourney(result), true);
});

test('resume picks the latest opened known song and suggests the next uncompleted one of its tier', () => {
  const progress = {
    a: opened(10, true, 7),
    b: opened(30, false, 4),
    c: opened(0, true),
    gone: opened(99),
  };
  const result = journey(entries, progress, new Set());
  assert.equal(result.resume?.entry.id, 'b');
  assert.equal(result.resume?.progress.bestCombo, 4);
  assert.equal(result.next?.id, 'e', 'skips completed c and the hard d');
  assert.equal(result.completed, 2, 'the unknown song is not counted');
  assert.equal(isEmptyJourney(result), false);
});

test('saved songs keep catalogue order, stop at the limit and report the full count', () => {
  const ids = new Set(['h', 'a', 'g', 'f', 'e', 'c', 'missing']);
  const result = journey(entries, {}, ids);
  assert.deepEqual(result.saved.map(entry => entry.id), ['a', 'c', 'e', 'f', 'g'].slice(0, JOURNEY_SAVED_LIMIT));
  assert.equal(result.savedCount, 6);
  assert.equal(isEmptyJourney(result), false, 'saved songs alone fill the panel');
});
