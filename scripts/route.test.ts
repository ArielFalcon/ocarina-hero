import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeHash, shareUrl } from '../src/ui/route';

test('song routes round-trip ids, including characters that need encoding', () => {
  for (const id of ['zelda-lullaby', 'pokémon/route 1']) {
    assert.deepEqual(parseRoute(routeHash({ view: 'song', songId: id })), { view: 'song', songId: id });
  }
});

test('view routes parse, and unknown or empty hashes fall back to the songbook', () => {
  assert.deepEqual(parseRoute('#workshop'), { view: 'workshop' });
  assert.deepEqual(parseRoute('#settings'), { view: 'settings' });
  assert.deepEqual(parseRoute('#free'), { view: 'free' });
  assert.deepEqual(parseRoute('#lesson'), { view: 'lesson' });
  assert.deepEqual(parseRoute('#song/'), { view: 'catalog' });
  assert.deepEqual(parseRoute('#nope'), { view: 'catalog' });
  assert.deepEqual(parseRoute(''), { view: 'catalog' });
});

test('share links keep the page path and query but replace the current hash', () => {
  assert.equal(
    shareUrl('https://user.github.io/ocarina-hero/?x=1#catalog', 'song-of-storms'),
    'https://user.github.io/ocarina-hero/?x=1#song/song-of-storms',
  );
});
