import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';

const names = (extension: string) => readdirSync('public/art/icons').filter(file => file.endsWith(extension)).map(file => file.slice(0, -extension.length)).sort();

test('every tapestry patch icon has the bitmap the app shows, rendered from its SVG', () => {
  assert.deepEqual(names('.webp'), names('.svg'));
});
