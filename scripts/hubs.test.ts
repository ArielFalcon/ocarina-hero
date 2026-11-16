import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMOS } from './catalogue-loader';
import { buildHubs, hubHead, hubPath, MIN_INDEXED_SONGS, OCARINA_GAMES, OPENING_NOTES, universeSlug, ZELDA_UNIVERSE } from '../src/site/hubs';
import { homeDirectoryHtml, llmsTxt, sitemapXml, songGroups, songHead, songPageOf } from '../src/site/song-pages';
import { songArticleHtml } from '../src/site/song-article';
import { createSongbookEntries } from '../src/ui/songbook';

const SITE = 'https://ocarinahero.app/';
const entries = createSongbookEntries(DEMOS);
const pages = entries.map(songPageOf);
const hubs = buildHubs(pages);
const hubOf = (kind: string) => hubs.find(hub => hub.kind === kind)!;
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]);

test('every hub link is a catalogued song, and a hub lists a song once', () => {
  const ids = new Set(entries.map(entry => entry.id));
  for (const hub of hubs) {
    assert.ok(hub.songIds.length > 0, hub.path);
    assert.deepEqual(hub.songIds.filter(id => !ids.has(id)), [], hub.path);
    assert.equal(new Set(hub.songIds).size, hub.songIds.length, hub.path);
  }
});

test('the one Zelda hub lists every Zelda song, the ocarina games first, and the universe gets no generic hub', () => {
  const zelda = entries.filter(entry => entry.universe === ZELDA_UNIVERSE).map(entry => entry.id);
  assert.deepEqual([...hubOf('zelda').songIds].sort(), [...zelda].sort());
  assert.deepEqual(hubOf('zelda').sections.slice(0, OCARINA_GAMES.length).map(section => section.heading), [...OCARINA_GAMES]);
  assert.equal(hubOf('zelda').path, 'zelda-ocarina-songs/');
  assert.equal(hubs.filter(hub => hub.kind === 'zelda').length, 1);
  assert.ok(!hubs.some(hub => hub.path === 'songs/the-legend-of-zelda/' || hub.path === 'zelda-songs/'));
  assert.equal(hubs.filter(hub => hub.kind === 'universe').length, new Set(entries.map(entry => entry.universe)).size - 1);
});

test('the Zelda hub shows each song\'s own tab, cut after the opening notes only when it is longer', () => {
  const songs = hubOf('zelda').sections.flatMap(section => section.songs);
  for (const song of songs) {
    const full = pages.find(page => page.id === song.id)!.tab.split(', ');
    assert.equal(song.tab, full.slice(0, OPENING_NOTES).join(', '), song.id);
    assert.equal(song.tabCut, full.length > OPENING_NOTES, song.id);
  }
  assert.ok(songs.some(song => song.tabCut) && songs.some(song => !song.tabCut));
  assert.ok(hubs.filter(hub => hub.kind === 'universe').every(hub => hub.sections.every(section => section.songs.every(song => song.tab === undefined))));
});

test('hub addresses are unique, URL-safe and stable', () => {
  const paths = hubs.map(hub => hub.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(paths.filter(path => !/^(zelda-ocarina-songs|songs\/[a-z0-9]+(-[a-z0-9]+)*)\/$/.test(path)), []);
  assert.equal(universeSlug('Pokémon'), 'pokemon');
  assert.equal(universeSlug('Mission: Impossible'), 'mission-impossible');
  assert.equal(universeSlug('Breakfast at Tiffany’s'), 'breakfast-at-tiffany-s');
  assert.equal(universeSlug('Super Smash Bros.'), 'super-smash-bros');
  assert.equal(universeSlug('Rock & Roll'), 'rock-and-roll');
  assert.equal(hubPath('Pokémon'), 'songs/pokemon/');
  assert.throws(() => universeSlug('音楽'), /no ASCII/);
});

test('two universes that share a slug fail the build instead of overwriting each other', () => {
  const page = (universe: string) => ({ ...pages[0]!, universe, id: universe });
  assert.throws(() => buildHubs([page('Pokémon'), page('Pokemon')]), /share the address/);
});

test('a hub of fewer than three songs is noindex and stays out of the sitemap; the others are indexable and listed', () => {
  const small = hubs.filter(hub => hub.songIds.length < MIN_INDEXED_SONGS);
  const large = hubs.filter(hub => hub.songIds.length >= MIN_INDEXED_SONGS);
  assert.ok(small.length > 0 && large.length > 0);
  const urls = locs(sitemapXml(SITE, pages.map(page => page.id), new Map(), hubs));
  for (const hub of small) {
    assert.equal(hubHead(hub, SITE).robots, 'noindex,follow', hub.path);
    assert.ok(!urls.includes(SITE + hub.path), hub.path);
  }
  for (const hub of large) {
    assert.equal(hubHead(hub, SITE).robots, undefined, hub.path);
    assert.ok(urls.includes(SITE + hub.path), hub.path);
  }
});

test('a song page breadcrumb goes home, then to its universe hub, then to the song', () => {
  for (const id of ['lullaby-trigger', pages.find(page => page.universe !== ZELDA_UNIVERSE)!.id]) {
    const page = pages.find(candidate => candidate.id === id)!;
    const graph = (songHead(page, SITE).structuredData as { '@graph': { '@type': string; itemListElement?: { name: string; item: string }[] }[] })['@graph'];
    const crumbs = graph.find(item => item['@type'] === 'BreadcrumbList')!.itemListElement!;
    assert.deepEqual(crumbs.map(crumb => crumb.item), [SITE, SITE + hubPath(page.universe), `${SITE}song/${id}/`]);
    assert.ok(hubs.some(hub => hub.path === hubPath(page.universe) && hub.songIds.includes(id)));
  }
  assert.equal(hubPath(ZELDA_UNIVERSE), 'zelda-ocarina-songs/');
});

test('the song article links to its universe hub under the deployment base', () => {
  const page = pages.find(candidate => candidate.id === 'lullaby-trigger')!;
  assert.ok(songArticleHtml(page, [], '/sub/').includes('<a href="/sub/zelda-ocarina-songs/">All Zelda songs</a>'));
});

test('a hub tells search engines its songs in order, in one list, with a breadcrumb back home', () => {
  const hub = hubOf('universe');
  const graph = (hubHead(hub, SITE).structuredData as { '@graph': Record<string, any>[] })['@graph'];
  const collection = graph.find(item => item['@type'] === 'CollectionPage')!;
  assert.deepEqual(collection.mainEntity.itemListElement.map((item: { url: string }) => item.url), hub.songIds.map(id => `${SITE}song/${id}/`));
  assert.deepEqual(graph.find(item => item['@type'] === 'BreadcrumbList')!.itemListElement.map((crumb: { item: string }) => crumb.item), [SITE, SITE + hub.path]);
  assert.equal(hubHead(hub, SITE).url, SITE + hub.path);
});

test('hub titles and headings are distinct, and the Zelda hub targets "Zelda ocarina songs"', () => {
  assert.equal(new Set(hubs.map(hub => hub.title)).size, hubs.length);
  assert.equal(new Set(hubs.map(hub => hub.h1)).size, hubs.length);
  assert.match(hubOf('zelda').title, /^Zelda Ocarina Songs/);
});

test('the sitemap, llms.txt and home directory keep every earlier entry and add the hubs', () => {
  const ids = pages.map(page => page.id);
  const before = locs(sitemapXml(SITE, ids));
  const after = locs(sitemapXml(SITE, ids, new Map(), hubs));
  assert.deepEqual(after.slice(0, before.length), before);
  assert.equal(after.length, before.length + hubs.filter(hub => hub.indexable).length);

  const groups = songGroups(entries);
  const old = llmsTxt(SITE, groups);
  const text = llmsTxt(SITE, groups, hubs);
  assert.equal(text.replace(/## Hubs\n\n(?:- .*\n)+\n/, ''), old);
  assert.ok(text.includes(`(${SITE}zelda-ocarina-songs/)`) && !text.includes('zelda-songs/'));
  const hidden = hubs.find(hub => !hub.indexable)!;
  assert.ok(!text.includes(`](${SITE}${hidden.path})`));

  const html = homeDirectoryHtml(groups, SITE, hubs);
  for (const hub of hubs) assert.ok(html.includes(`href="${SITE}${hub.path}"`), hub.path);
  assert.deepEqual([...html.matchAll(/href="https:\/\/ocarinahero\.app\/song\/([^/]+)\/"/g)].map(match => match[1]!).sort(), entries.map(entry => entry.id).sort());
});

test('a song listed under its game heading does not repeat the game beside its name', () => {
  for (const hub of hubs.filter(hub => hub.kind !== 'universe'))
    for (const section of hub.sections)
      assert.deepEqual(section.songs.filter(song => song.detail.includes(section.heading)).map(song => song.id), [], `${hub.path} ${section.heading}`);
});
