import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PREFERENCES, readPreferences } from '../src/ui/preferences';
import { parseSavedExport, savedExport } from '../src/ui/local-data';

test('stored preferences keep each valid field and fall back per field', () => {
  assert.deepEqual(readPreferences(null), DEFAULT_PREFERENCES);
  assert.deepEqual(readPreferences({ bends: false, simplify: 'yes', rate: '0.75', effects: false, haptics: 1 }), {
    ...DEFAULT_PREFERENCES, bends: false, rate: '0.75', effects: false,
  });
  assert.equal(readPreferences({ rate: '2' }).rate, DEFAULT_PREFERENCES.rate);
});

test('a saved-songs export round-trips and import keeps only known, unique song ids', () => {
  const known = new Set(['a', 'b', 'c']);
  assert.deepEqual(parseSavedExport(savedExport(['a', 'c']), known), ['a', 'c']);
  assert.deepEqual(parseSavedExport(JSON.stringify({ app: 'ocarina-hero', saved: ['b', 'zzz', 'b', 4] }), known), ['b']);
  assert.throws(() => parseSavedExport('not json', known));
  assert.throws(() => parseSavedExport(JSON.stringify({ app: 'other', saved: ['a'] }), known));
});
