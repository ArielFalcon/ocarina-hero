import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEMOS } from './catalogue-loader';
import { songDocumentTitle } from '../src/ui/route';
import { createSongbookEntries, songTitleQualifier } from '../src/ui/songbook';
import { homeHead, jsonLd } from '../src/site/site';
import { homeDirectoryHtml, llmsTxt, relatedSongs, robotsTxt, sitemapXml, songGroups, songHead, songPageOf } from '../src/site/song-pages';

const SITE = 'https://ocarinahero.app/';
const song = { id: 'song-of-storms', title: 'Song of "Storms" & Rain', meta: 'Zelda · Ocarina of Time', qualifier: 'Ocarina of Time', universe: 'The Legend of <Zelda>', details: 'Ocarina of Time · 23 notes', tab: 'L R X | L + D-pad up' };
const graphItem = (data: unknown, type: string) => (data as { '@graph': { '@type': string }[] })['@graph'].find(item => item['@type'] === type) as Record<string, any>;

test('a song page carries its own title, description, canonical address and share preview', () => {
  const head = songHead(song, SITE);
  assert.equal(head.title, 'Song of "Storms" & Rain (Ocarina of Time) | Ocarina of Time Button Tabs');
  assert.equal(head.shareTitle, head.title);
  assert.equal(head.url, 'https://ocarinahero.app/song/song-of-storms/');
  assert.ok(head.description.startsWith('How to play Song of "Storms" & Rain (Zelda · Ocarina of Time) on the Zelda ocarina'));
  assert.ok(head.description.includes('tabs and notes'));
});

test('the page of a bundled song carries the tab the lesson opens with', () => {
  const lullaby = songPageOf(createSongbookEntries(DEMOS).find(entry => entry.id === 'lullaby-trigger')!);
  assert.equal(lullaby.tab, 'L + Stick up, R + Stick up, L, L + Stick down, L, L + Stick up, R + Stick up, L, L + Stick up, R + Stick up, X, Y + D-pad up, R + Stick up, R, R + D-pad down, L');
  assert.equal(lullaby.details, 'Ocarina of Time · 16 notes · 4 passages');
});

test('the sitemap lists the home, the Popular page and every song', () => {
  const xml = sitemapXml(SITE, ['ode', 'song-of-storms']);
  assert.deepEqual([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]),
    ['https://ocarinahero.app/', 'https://ocarinahero.app/popular/', 'https://ocarinahero.app/song/ode/', 'https://ocarinahero.app/song/song-of-storms/']);
});

test('the sitemap dates a song only when its day is known, and the home carries the newest day', () => {
  const xml = sitemapXml(SITE, ['ode', 'song-of-storms'], new Map([['ode', '2026-01-02'], ['other', '2026-03-04']]));
  assert.deepEqual([...xml.matchAll(/<loc>([^<]*)<\/loc>(?:<lastmod>([^<]*)<\/lastmod>)?/g)].map(match => [match[1], match[2]]), [
    ['https://ocarinahero.app/', '2026-03-04'],
    ['https://ocarinahero.app/popular/', undefined],
    ['https://ocarinahero.app/song/ode/', '2026-01-02'],
    ['https://ocarinahero.app/song/song-of-storms/', undefined],
  ]);
});

test('robots.txt points crawlers to the sitemap', () => {
  assert.match(robotsTxt(SITE), /^User-agent: \*\nAllow: \/\n\nSitemap: https:\/\/ocarinahero\.app\/sitemap\.xml\n$/);
});

test('the pages.dev address is kept out of search results, the custom domain is not', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /^https:\/\/:project\.pages\.dev\/\*\n\s+X-Robots-Tag: noindex$/m);
  assert.doesNotMatch(headers, /^\/\*\n(?:\s+.*\n)*?\s+X-Robots-Tag/m);
});

test('no two bundled songs share a page title', () => {
  const titles = createSongbookEntries(DEMOS).map(song => songDocumentTitle(song.title, songTitleQualifier(song)));
  assert.deepEqual(titles.filter((title, index) => titles.indexOf(title) !== index), []);
});

test('a page title tells a song apart by its version, else its artist, else its universe', () => {
  const entry = (fields: object) => ({ title: 'Main Theme', universe: 'The Legend of Zelda', ...fields }) as Parameters<typeof songTitleQualifier>[0];
  assert.equal(songTitleQualifier(entry({ version: "Majora's Mask", artist: 'Koji Kondo' })), "Majora's Mask");
  assert.equal(songTitleQualifier(entry({ artist: 'Koji Kondo' })), 'Koji Kondo');
  assert.equal(songTitleQualifier(entry({})), 'Zelda');
});

test('every bundled song id is safe as a directory and URL segment', () => {
  assert.deepEqual(DEMOS.map(track => track.id).filter(id => !/^[a-z0-9-]+$/.test(id)), []);
});

test('a song page describes its song to search engines', () => {
  const head = songHead(song, SITE);
  const page = graphItem(head.structuredData, 'WebPage');
  assert.equal(page.url, 'https://ocarinahero.app/song/song-of-storms/');
  assert.equal(page.about['@type'], 'MusicComposition');
  assert.equal(page.about.name, 'Song of "Storms" & Rain');
  assert.equal(page.mainEntity.text, song.tab);
  const crumbs = graphItem(head.structuredData, 'BreadcrumbList').itemListElement;
  assert.deepEqual(crumbs.map((crumb: { name: string; item: string }) => [crumb.name, crumb.item]),
    [['Ocarina Hero', 'https://ocarinahero.app/'], ['The Legend of <Zelda> songs', 'https://ocarinahero.app/songs/the-legend-of-zelda/'], ['Song of "Storms" & Rain', 'https://ocarinahero.app/song/song-of-storms/']]);
});

test('a song page dates its change only when the day is known', () => {
  assert.equal(graphItem(songHead(song, SITE, '2026-03-04').structuredData, 'WebPage').dateModified, '2026-03-04');
  assert.ok(!('dateModified' in graphItem(songHead(song, SITE).structuredData, 'WebPage')));
});

test('a closing tag inside structured data cannot end its script element early', () => {
  assert.doesNotMatch(jsonLd(songHead(song, SITE).structuredData), /<\//);
  assert.deepEqual(JSON.parse(jsonLd({ title: '</script><b>' })), { title: '</script><b>' });
});

test('the other songs of a universe exclude the song itself', () => {
  const groups = songGroups(createSongbookEntries(DEMOS));
  const zelda = songPageOf(createSongbookEntries(DEMOS).find(entry => entry.id === 'lullaby-trigger')!);
  const others = relatedSongs(groups, zelda);
  assert.ok(others.length > 0 && !others.some(link => link.id === zelda.id));
});

test('the home page lists every song as a link for crawlers that do not run scripts, Zelda first', () => {
  const songs = createSongbookEntries(DEMOS);
  const groups = songGroups(songs);
  assert.equal(groups[0]!.universe, 'The Legend of Zelda');
  assert.equal(groups.reduce((sum, group) => sum + group.songs.length, 0), songs.length);
  const links = [...homeDirectoryHtml(groups, SITE).matchAll(/<a href="https:\/\/ocarinahero\.app\/song\/([^/]+)\/">/g)].map(match => match[1]);
  assert.deepEqual([...links].sort(), songs.map(entry => entry.id).sort());
  assert.equal(graphItem(homeHead('https://ocarinahero.app/').structuredData, 'WebApplication').offers.price, '0');
});

test('llms.txt summarises the app and links every song page', () => {
  const songs = createSongbookEntries(DEMOS);
  const text = llmsTxt(SITE, songGroups(songs));
  assert.match(text, /^# Ocarina Hero\n\n> /);
  for (const entry of songs) assert.ok(text.includes(`(https://ocarinahero.app/song/${entry.id}/)`), entry.id);
});
