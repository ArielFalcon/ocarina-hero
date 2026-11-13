import assert from 'node:assert/strict';
import test from 'node:test';
import { completedIds, lastOpened, markOpened, markPractice, readProgress } from '../src/ui/progress';
import { GAME_SONG_IDS, gameSongs, nextSong } from '../src/ui/featured';

test('stored progress keeps well-formed songs and drops everything else', () => {
  const stored = {
    ode: { completed: true, bestCombo: 12, openedAt: 50 },
    broken: { completed: 'yes', bestCombo: 3, openedAt: 1 },
    negative: { completed: false, bestCombo: -1, openedAt: 1 },
    text: 'nope',
  };
  assert.deepEqual(readProgress(stored), { ode: { completed: true, bestCombo: 12, openedAt: 50 } });
  assert.deepEqual(readProgress(null), {});
  assert.deepEqual(readProgress([1, 2]), {});
});

test('a finished song stays completed and the best combo never drops', () => {
  const first = markPractice({}, 'ode', { finished: true, bestCombo: 9 });
  assert.deepEqual(first.ode, { completed: true, bestCombo: 9, openedAt: 0 });
  const later = markPractice(first, 'ode', { finished: false, bestCombo: 14 });
  assert.deepEqual(later.ode, { completed: true, bestCombo: 14, openedAt: 0 });
  assert.equal(markPractice(later, 'ode', { finished: false, bestCombo: 3 }), later);
});

test('opening a song records when without touching its practice record', () => {
  const practiced = markPractice({}, 'ode', { finished: true, bestCombo: 7 });
  assert.deepEqual(markOpened(practiced, 'ode', 900).ode, { completed: true, bestCombo: 7, openedAt: 900 });
});

test('the song to continue is the latest opened one that still exists', () => {
  let progress = markOpened({}, 'ode', 100);
  progress = markOpened(progress, 'twinkle', 300);
  progress = markOpened(progress, 'removed-song', 500);
  progress = markPractice(progress, 'never-opened', { finished: true, bestCombo: 2 });
  assert.equal(lastOpened(progress, new Set(['ode', 'twinkle', 'never-opened'])), 'twinkle');
  assert.equal(lastOpened({}, new Set(['ode'])), null);
  assert.deepEqual([...completedIds(progress)], ['never-opened']);
});

const entry = (id: string, level = 'easy') => ({ id, difficulty: { level } });

test('in-game songs follow the order the game teaches them and skip missing ones', () => {
  const [first, second, third] = GAME_SONG_IDS;
  const shelf = gameSongs([entry(third!), entry('ode'), entry(first!)]);
  assert.deepEqual(shelf.map(song => song.id), [first, third]);
  assert.notEqual(second, undefined);
});

test('the next song stays in the collection, skips completed songs and wraps around', () => {
  const [first, second, third] = GAME_SONG_IDS as readonly [string, string, string, ...string[]];
  const entries = [entry('a', 'easy'), entry(third, 'medium'), entry('b', 'hard'), entry(second, 'medium'), entry('c', 'easy'), entry(first, 'medium'), entry('d', 'easy')];
  assert.equal(nextSong(entries, first, new Set([second]))?.id, third);
  assert.equal(nextSong(entries, third, new Set())?.id, first);
  assert.equal(nextSong(entries, 'c', new Set(['d']))?.id, 'a');
  assert.equal(nextSong(entries, 'b', new Set()), null);
  assert.equal(nextSong(entries, 'a', new Set(['c', 'd'])), null);
});
