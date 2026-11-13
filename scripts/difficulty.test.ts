import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMOS } from '../src/core/demo';
import type { Note } from '../src/core/ir';
import { difficultyOf, rateDifficulty } from '../src/core/difficulty';
import { createSongbookEntries, filterSongbook } from '../src/ui/songbook';

const entries = createSongbookEntries(DEMOS);
const level = (id: string) => entries.find((entry) => entry.id === id)!.difficulty.level;
const run = (count: number, gapBeats: number, bend = (_: number) => 0): Note[] =>
  Array.from({ length: count }, (_, index) => ({ pitch: 'A4', bend: bend(index), startBeat: index * gapBeats, durationBeats: gapBeats }));

test('reference songs land on the expected tiers', () => {
  assert.equal(level('v1'), 'easy');
  assert.equal(level('twinkle'), 'easy');
  assert.ok(['hard', 'expert'].includes(level('catalogue-gimme-gimme-gimme')));
  assert.equal(level('catalogue-sandstorm'), 'expert');
});

test('faster tempo and bend changes both raise the score', () => {
  const plain = rateDifficulty(run(16, 1), 120).score;
  assert.ok(rateDifficulty(run(16, 1), 240).score > plain);
  assert.ok(rateDifficulty(run(16, 1, (index) => (index % 2 ? 1 : 0)), 120).score > rateDifficulty(run(16, 1, () => 1), 120).score);
  assert.ok(rateDifficulty(run(16, 1, () => 1), 120).score > plain);
});

test('tiers use fixed thresholds on both sides of each boundary', () => {
  assert.equal(difficultyOf(3.49), 'easy');
  assert.equal(difficultyOf(3.5), 'medium');
  assert.equal(difficultyOf(5.49), 'medium');
  assert.equal(difficultyOf(5.5), 'hard');
  assert.equal(difficultyOf(7.49), 'hard');
  assert.equal(difficultyOf(7.5), 'expert');
});

test('an empty or single-note song is easy', () => {
  assert.equal(rateDifficulty([], 120).level, 'easy');
  assert.equal(rateDifficulty(run(1, 1), 300).level, 'easy');
});

test('the difficulty filter keeps only the chosen tier and intersects other filters', () => {
  const easyPop = filterSongbook(entries, { category: 'Pop', difficulty: 'easy' });
  assert.ok(easyPop.some((entry) => entry.id === 'v1'));
  assert.ok(easyPop.every((entry) => entry.difficulty.level === 'easy' && entry.categories.includes('Pop')));
  assert.ok(!easyPop.some((entry) => entry.id === 'catalogue-gimme-gimme-gimme'));
  assert.equal(filterSongbook(entries, {}).length, entries.length);
});
