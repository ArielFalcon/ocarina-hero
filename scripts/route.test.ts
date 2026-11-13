import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation, parseRoute, shareUrl, songPath } from '../src/ui/route';

test('earlier hash links to a song still parse, including ids that need encoding', () => {
  for (const id of ['zelda-lullaby', 'pokémon/route 1']) {
    assert.deepEqual(parseRoute(`#song/${encodeURIComponent(id)}`), { view: 'song', songId: id });
  }
});

test('view routes parse, and unknown or empty hashes fall back to the songbook', () => {
  assert.deepEqual(parseRoute('#workshop'), { view: 'workshop' });
  assert.deepEqual(parseRoute('#free'), { view: 'free' });
  assert.deepEqual(parseRoute('#lesson'), { view: 'lesson' });
  assert.deepEqual(parseRoute('#saved'), { view: 'saved' });
  assert.deepEqual(parseRoute('#song/'), { view: 'catalog' });
  assert.deepEqual(parseRoute('#nope'), { view: 'catalog' });
  assert.deepEqual(parseRoute(''), { view: 'catalog' });
});

test('a song lives at its own path under the app base, and other views stay on hashes', () => {
  for (const base of ['/', '/ocarina-hero/']) {
    for (const id of ['song-of-storms', 'pokémon/route 1']) {
      assert.deepEqual(parseLocation(base, songPath(base, id), ''), { view: 'song', songId: id });
    }
    assert.deepEqual(parseLocation(base, base, '#workshop'), { view: 'workshop' });
    assert.deepEqual(parseLocation(base, base, ''), { view: 'catalog' });
    assert.deepEqual(parseLocation(base, `${base}song/`, ''), { view: 'catalog' });
  }
  assert.deepEqual(parseLocation('/app/', '/song/ode-to-joy/', ''), { view: 'catalog' });
});

test('a hash that names a route decides over the path, so links shared before song paths existed still open', () => {
  assert.deepEqual(parseLocation('/', '/', '#song/ode'), { view: 'song', songId: 'ode' });
  assert.deepEqual(parseLocation('/', '/song/ode/', '#free'), { view: 'free' });
  assert.deepEqual(parseLocation('/', '/song/ode/', '#catalog'), { view: 'catalog' });
});

test('an in-page anchor on a song page keeps the song', () => {
  assert.deepEqual(parseLocation('/', '/song/ode/', '#main-content'), { view: 'song', songId: 'ode' });
});

test('a malformed song address falls back to the songbook instead of throwing', () => {
  assert.deepEqual(parseLocation('/', '/song/%E0%A4%A/', ''), { view: 'catalog' });
  assert.deepEqual(parseRoute('#song/%E0%A4%A'), { view: 'catalog' });
});

test('share links point at the song path and drop the current query and hash', () => {
  assert.equal(shareUrl('https://ocarinahero.app/?x=1#catalog', '/', 'song-of-storms'), 'https://ocarinahero.app/song/song-of-storms/');
  assert.equal(shareUrl('https://user.github.io/ocarina-hero/song/ode/', '/ocarina-hero/', 'twinkle'), 'https://user.github.io/ocarina-hero/song/twinkle/');
});
