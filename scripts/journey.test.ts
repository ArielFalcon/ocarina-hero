import assert from 'node:assert/strict';
import test from 'node:test';
import { journey, playsLabel, POPULAR_SHOWN } from '../src/ui/journey';

const entries = Array.from({ length: 26 }, (_, index) => ({ id: String.fromCharCode(97 + index) }));
const opened = (openedAt: number, completed = false, bestCombo = 0) => ({ completed, bestCombo, openedAt });
const ranked = (ids: string[]) => ids.map((id, index) => ({ id, plays: index }));

test('resume picks the latest opened song still in the catalogue', () => {
  const result = journey(entries, { a: opened(10), b: opened(30, false, 4), c: opened(0, true), gone: opened(99) }, []);
  assert.equal(result.resume?.entry.id, 'b');
  assert.equal(result.resume?.progress.bestCombo, 4);
  assert.equal(journey(entries, {}, []).resume, null);
});

test('popular keeps the server order and plays, skips unknown and repeated ids and stops at twenty', () => {
  const ids = ['z', 'removed', 'a', 'z', ...'bcdefghijklmnopqrstuvwxy'.split('')];
  const result = journey(entries, {}, ranked(ids));
  assert.equal(result.popular.length, POPULAR_SHOWN);
  assert.deepEqual(result.popular.slice(0, 3).map(item => [item.entry.id, item.plays]), [['z', 0], ['a', 2], ['b', 4]]);
});

test('play counts show only above one hundred, in compact form', () => {
  assert.equal(playsLabel(100), null);
  assert.equal(playsLabel(101), '101 plays');
  assert.equal(playsLabel(1234), '1.2K plays');
});
