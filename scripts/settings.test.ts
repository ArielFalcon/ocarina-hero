import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreferenceStore, DEFAULT_PREFERENCES, readPreferences, type Preferences } from '../src/ui/preferences';
import { readStored, writeStored } from '../src/ui/storage';
import { parseSavedExport, savedExport } from '../src/ui/local-data';

test('stored preferences keep each valid field and fall back per field', () => {
  assert.deepEqual(readPreferences(null), DEFAULT_PREFERENCES);
  assert.deepEqual(readPreferences({ bends: false, simplify: 'yes', rate: '0.75', effects: false, haptics: 1 }), {
    ...DEFAULT_PREFERENCES, bends: false, rate: '0.75', effects: false,
  });
  assert.equal(readPreferences({ rate: '2' }).rate, DEFAULT_PREFERENCES.rate);
  assert.equal(readPreferences({ link: false }).link, false);
  assert.equal(readPreferences({ link: 'no' }).link, true, 'an invalid stored flag falls back to showing Link');
});

test('a saved-songs export round-trips and import keeps only known, unique song ids', () => {
  const known = new Set(['a', 'b', 'c']);
  assert.deepEqual(parseSavedExport(savedExport(['a', 'c']), known), ['a', 'c']);
  assert.deepEqual(parseSavedExport(JSON.stringify({ app: 'ocarina-hero', saved: ['b', 'zzz', 'b', 4] }), known), ['b']);
  assert.throws(() => parseSavedExport('not json', known));
  assert.throws(() => parseSavedExport(JSON.stringify({ app: 'other', saved: ['a'] }), known));
});

test('the preference store applies a change for the session, persists it and tells every listener what changed', () => {
  const persisted: Preferences[] = [];
  let storageWorks = true;
  const store = createPreferenceStore(DEFAULT_PREFERENCES, value => { persisted.push(value); return storageWorks; });
  const heard: [boolean, boolean, boolean][] = [];
  store.subscribe((next, previous, saved) => heard.push([previous.bends, next.bends, saved]));
  store.update({ bends: false });
  storageWorks = false;
  store.update({ rate: '0.5' });
  assert.deepEqual(store.get(), { ...DEFAULT_PREFERENCES, bends: false, rate: '0.5' });
  assert.deepEqual(persisted.map(value => [value.bends, value.rate]), [[false, '1'], [false, '0.5']]);
  assert.deepEqual(heard, [[true, false, true], [false, false, false]]);
});

test('stored JSON is parsed by its owner, and unreadable or blocked storage reads as missing', () => {
  const items = new Map([['good', '{"a":1}'], ['broken', '{']]);
  const storage = { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); } };
  const parse = (stored: unknown) => stored ?? 'missing';
  assert.deepEqual(readStored('good', parse, storage), { value: { a: 1 }, readable: true });
  assert.deepEqual(readStored('absent', parse, storage), { value: 'missing', readable: true });
  assert.deepEqual(readStored('broken', parse, storage), { value: 'missing', readable: false });
  assert.deepEqual(readStored('good', parse, null), { value: 'missing', readable: false });
  assert.equal(writeStored('saved', [1], storage), true);
  assert.equal(items.get('saved'), '[1]');
  assert.equal(writeStored('saved', [2], { getItem: () => null, setItem: () => { throw new Error('quota'); } }), false);
});
