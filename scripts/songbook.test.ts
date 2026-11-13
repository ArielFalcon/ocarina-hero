import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMOS, type DemoTrack } from '../src/core/demo';
import { createSongbookEntries, filterSongbook, letterAnchors, listUniverses, songMeta } from '../src/ui/songbook';

const entries = createSongbookEntries(DEMOS);
const ids = (result: ReturnType<typeof filterSongbook>) => result.map((entry) => entry.id);

test('search matches all normalized words across title, franchise, artist and aliases', () => {
  assert.deepEqual(ids(filterSongbook(entries, { query: '  POKEMON   rÓute ' })), ['catalogue-pokemon-route1']);
  assert.deepEqual(ids(filterSongbook(entries, { query: 'ghibli spirited always' })), ['catalogue-always-with-me']);
  assert.deepEqual(ids(filterSongbook(entries, { query: 'linkin numb' })), ['catalogue-numb']);
  assert.deepEqual(ids(filterSongbook(entries, { query: 'pokemon route missing' })), []);
});

test('category, universe and saved filters intersect while preserving input order', () => {
  const savedIds = new Set(['catalogue-pallet-town', 'catalogue-pokemon-route1', 'catalogue-fallen-down']);
  assert.deepEqual(ids(filterSongbook(entries, { category: 'Games', universe: 'Pokémon', savedIds, onlySaved: true })),
    ['catalogue-pokemon-route1', 'catalogue-pallet-town']);
  assert.deepEqual(ids(filterSongbook(entries, { category: 'Anime', universe: 'Pokémon' })), []);
  assert.deepEqual(ids(filterSongbook(entries, { onlySaved: true })), []);
});

test('unknown tracks remain searchable under Other', () => {
  const track: DemoTrack = { id: 'future-track', title: 'Étoile nouvelle', subtitle: '', tempoBpm: 100, melody: [] };
  const result = createSongbookEntries([track]);
  assert.deepEqual(ids(filterSongbook(result, { category: 'Other', universe: 'Other melodies', query: 'etoile' })), ['future-track']);
  assert.equal(result[0]!.track, track);
  assert.deepEqual(result[0]!.aliases, []);
});

test('versions are distinct and Ghibli tracks belong to both Anime and Film', () => {
  assert.deepEqual(ids(filterSongbook(entries, { query: 'lullaby manual' })), ['lullaby-trigger']);
  assert.deepEqual(ids(filterSongbook(entries, { query: 'lullaby complete' })), ['lullaby-game']);
  for (const category of ['Anime', 'Film'] as const) {
    assert.ok(ids(filterSongbook(entries, { category, query: 'spirited' })).includes('catalogue-always-with-me'));
  }
});


test('universes group under their primary category with the universe icon and song count', () => {
  const fixture = createSongbookEntries([
    ...['catalogue-laputa', 'catalogue-numb', 'catalogue-always-with-me', 'catalogue-naruto',
      'catalogue-never-gonna', 'catalogue-imperial-march', 'catalogue-pokemon-route1', 'ode']
      .map(id => DEMOS.find(track => track.id === id)!),
    { id: 'future-track', title: 'Future track', subtitle: '', tempoBpm: 100, melody: [] },
  ]);
  const groups = listUniverses(fixture);
  assert.deepEqual(groups.map(group => group.category), ['Games', 'Anime', 'Film', 'Pop', 'Classics', 'Other']);
  const anime = groups.find(group => group.category === 'Anime')!;
  const ghibli = anime.universes.find(universe => universe.name === 'Studio Ghibli');
  assert.deepEqual(ghibli, { name: 'Studio Ghibli', icon: 'forestSpirit', count: 2 });
  assert.equal(groups.find(group => group.category === 'Film')!.universes.some(universe => universe.name === 'Studio Ghibli'), false);
  assert.deepEqual(groups.find(group => group.category === 'Pop')!.universes.find(universe => universe.name === 'Pop'), { name: 'Pop', icon: 'microphone', count: 2 });
  const names = anime.universes.map(universe => universe.name);
  assert.deepEqual(names, ['Naruto', 'Studio Ghibli']);
  assert.deepEqual(listUniverses(fixture, 'Film').map(group => group.category), ['Film']);
  assert.equal(listUniverses(fixture, 'Film')[0]!.universes.some(universe => universe.name === 'Studio Ghibli'), true);
});

test('every bundled melody has a specific universe and a clean, song-only title', () => {
  const generic = new Set(['Pop', 'Classics']);
  for (const entry of entries) {
    assert.notDeepEqual(entry.categories, ['Other'], `${entry.id} has no category`);
    assert.doesNotMatch(entry.title, /\s[—–-]\s|·/, `${entry.id} title mixes song and credit`);
    assert.ok(!entry.artist || generic.has(entry.universe), `${entry.id} shows an artist next to the ${entry.universe} universe`);
  }
});

test('franchise composers and full theme names stay searchable without being displayed', () => {
  assert.deepEqual(ids(filterSongbook(entries, { query: 'zimmer interstellar' })), ['catalogue-cornfield-chase']);
  assert.deepEqual(ids(filterSongbook(entries, { query: 'jujutsu aizo' })), ['catalogue-aizo']);
  assert.deepEqual(ids(filterSongbook(entries, { category: 'Games', universe: 'Super Mario' })),
    ['catalogue-dire-dire-docks', 'catalogue-smb-world-clear', 'catalogue-smb-game-over', 'catalogue-smw-overworld']);
});

test('letter anchors mark the first song of each initial, folding accents and non-letters', () => {
  const make = (id: string, title: string) => createSongbookEntries([{ id, title, subtitle: '', tempoBpm: 100, melody: [] }])[0]!;
  const anchors = letterAnchors([make('a', 'Étoile'), make('b', 'eagle'), make('c', '1UP'), make('d', '¡Ya!'), make('e', 'Zebra')]);
  assert.deepEqual(anchors, [{ letter: 'E', id: 'a' }, { letter: '#', id: 'c' }, { letter: 'Y', id: 'd' }, { letter: 'Z', id: 'e' }]);
});

test('song meta shortens Zelda and appends only the artist and version present', () => {
  const entry = (universe: string, artist?: string, version?: string) => ({ ...entries[0]!, universe, artist, version });
  assert.equal(songMeta(entry('The Legend of Zelda', undefined, 'Ocarina of Time')), 'Zelda · Ocarina of Time');
  assert.equal(songMeta(entry('Pop', 'Queen')), 'Pop · Queen');
});

test('a song never wears another franchise emblem', () => {
  // Universe marks that are plain drawings, not emblems, may be reused by other songs.
  const generic = new Set(['anime', 'film', 'gamepad', 'heart', 'moon', 'clock']);
  const markOwners = new Map<string, Set<string>>();
  for (const entry of entries) markOwners.set(entry.universeIcon, (markOwners.get(entry.universeIcon) ?? new Set()).add(entry.universe));
  const borrowed = entries
    .filter(entry => !generic.has(entry.icon) && [...markOwners.get(entry.icon) ?? []].some(universe => universe !== entry.universe))
    .map(entry => `${entry.title}: ${entry.icon}`);
  assert.deepEqual(borrowed, []);
});
