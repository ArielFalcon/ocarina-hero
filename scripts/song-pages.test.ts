import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEMOS } from './catalogue-loader';
import { songDocumentTitle } from '../src/ui/route';
import { createSongbookEntries, songMeta } from '../src/ui/songbook';
import { homePageHtml, llmsTxt, siteUrlOf, sitemapXml, songGroups, songPageHtml, songPageOf } from './song-pages';

const indexHtml = readFileSync('index.html', 'utf8');
const song = { id: 'song-of-storms', title: 'Song of "Storms" & Rain', meta: 'Zelda · Ocarina of Time', universe: 'The Legend of <Zelda>', details: 'Ocarina of Time · 23 notes', tab: 'L R X | L + D-pad up' };
const headWithoutRewrittenValues = (html: string) => html.slice(0, html.indexOf('</head>')).replace(/<title>.*?<\/title>|content="[^"]*"|href="[^"]*"|(<script type="application\/ld\+json"[^>]*>).*?(?=<\/script>)/gs, '$1');
const related = [{ id: 'zeldas-lullaby', title: 'Zelda’s Lullaby', meta: 'Zelda · Ocarina of Time' }];
const structuredData = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)![1]!);
const directory = (html: string) => html.match(/<noscript id="song-directory">(.*?)<\/noscript>/s)![1]!;

test('a song page carries its own title, description, canonical address and share preview', () => {
  const html = songPageHtml(indexHtml, song, 'https://ocarinahero.app/', related);
  const address = 'https://ocarinahero.app/song/song-of-storms/';
  assert.ok(html.includes('<title>Song of &quot;Storms&quot; &amp; Rain (Zelda · Ocarina of Time) · Zelda ocarina tab · Ocarina Hero</title>'));
  assert.ok(html.includes(`<link rel="canonical" href="${address}"`));
  assert.ok(html.includes(`<meta property="og:url" content="${address}"`));
  for (const tag of ['<meta name="description"', '<meta property="og:title"', '<meta property="og:description"', '<meta name="twitter:title"', '<meta name="twitter:description"']) {
    const content = html.slice(html.indexOf(tag)).match(/content="([^"]*)"/)![1]!;
    assert.ok(content.includes('Song of &quot;Storms&quot; &amp; Rain'), `${tag} does not name the song`);
  }
  assert.ok(html.match(/<meta name="description" content="([^"]*)"/)![1]!.includes('Zelda · Ocarina of Time'));
  assert.equal(headWithoutRewrittenValues(html), headWithoutRewrittenValues(indexHtml));
});

test('a song page opens on the lesson of its song, with its heading and text tab in the markup', () => {
  const html = songPageHtml(indexHtml, song, 'https://ocarinahero.app/', related);
  assert.match(html, /<h1 id="lesson-title"[^>]*>Song of &quot;Storms&quot; &amp; Rain<\/h1>/);
  assert.match(html, /<p id="lesson-universe"[^>]*>The Legend of &lt;Zelda&gt;<\/p>/);
  assert.match(html, /<p id="lesson-meta"[^>]*>Ocarina of Time · 23 notes<\/p>/);
  assert.match(html, /<p id="tab-text"[^>]*>L R X \| L \+ D-pad up<\/p>/);
  assert.match(html, /<section id="catalog-view"[^>]* hidden>/);
  assert.doesNotMatch(html, /<section id="lesson-view"[^>]* hidden/);
  assert.match(html, /<div class="app is-lesson has-song">/);
});

test('the page of a bundled song carries the tab the lesson opens with', () => {
  const lullaby = songPageOf(createSongbookEntries(DEMOS).find(entry => entry.id === 'lullaby-trigger')!);
  assert.equal(lullaby.tab, 'Y, X, A, Y, X, A');
  assert.equal(lullaby.details, 'Manual trigger · 6 notes · 2 passages');
});

test('a page whose head lost a tag to rewrite is refused instead of published half-described', () => {
  assert.throws(() => songPageHtml(indexHtml.replace('<link rel="canonical"', '<link rel="alternate"'), song, 'https://ocarinahero.app/', related));
});

test('the site address comes from the canonical link, and the sitemap lists the home and every song', () => {
  assert.equal(siteUrlOf(indexHtml), 'https://ocarinahero.app/');
  const xml = sitemapXml('https://ocarinahero.app/', ['ode', 'song-of-storms']);
  assert.deepEqual([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]),
    ['https://ocarinahero.app/', 'https://ocarinahero.app/song/ode/', 'https://ocarinahero.app/song/song-of-storms/']);
});

test('no two bundled songs share a page title', () => {
  const titles = createSongbookEntries(DEMOS).map(song => songDocumentTitle(song.title, songMeta(song)));
  assert.deepEqual(titles.filter((title, index) => titles.indexOf(title) !== index), []);
});

test('every bundled song id is safe as a directory and URL segment', () => {
  assert.deepEqual(DEMOS.map(track => track.id).filter(id => !/^[a-z0-9-]+$/.test(id)), []);
});

test('a song page describes its song to search engines and links the other songs of its universe', () => {
  const html = songPageHtml(indexHtml, song, 'https://ocarinahero.app/', related);
  const data = structuredData(html);
  const page = data['@graph'].find((item: { '@type': string }) => item['@type'] === 'WebPage');
  assert.equal(page.url, 'https://ocarinahero.app/song/song-of-storms/');
  assert.equal(page.about['@type'], 'MusicComposition');
  assert.equal(page.about.name, 'Song of "Storms" & Rain');
  const crumbs = data['@graph'].find((item: { '@type': string }) => item['@type'] === 'BreadcrumbList').itemListElement;
  assert.deepEqual(crumbs.map((crumb: { name: string; item: string }) => [crumb.name, crumb.item]),
    [['Ocarina Hero', 'https://ocarinahero.app/'], ['Song of "Storms" & Rain', 'https://ocarinahero.app/song/song-of-storms/']]);
  // A closing tag inside a value would end the script early.
  assert.doesNotMatch(html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)![1]!, /<\//);
  const links = directory(html);
  assert.match(links, /<a href="https:\/\/ocarinahero\.app\/song\/zeldas-lullaby\/">Zelda’s Lullaby<\/a>/);
  assert.match(links, /<a href="https:\/\/ocarinahero\.app\/">/);
});

test('the home page lists every song as a link for crawlers that do not run scripts, Zelda first', () => {
  const songs = createSongbookEntries(DEMOS);
  const groups = songGroups(songs);
  assert.equal(groups[0]!.universe, 'The Legend of Zelda');
  assert.equal(groups.reduce((sum, group) => sum + group.songs.length, 0), songs.length);
  const html = homePageHtml(indexHtml, groups, 'https://ocarinahero.app/');
  const links = [...directory(html).matchAll(/<a href="https:\/\/ocarinahero\.app\/song\/([^/]+)\/">/g)].map(match => match[1]);
  assert.deepEqual([...links].sort(), songs.map(entry => entry.id).sort());
  assert.equal(structuredData(html)['@graph'].find((item: { '@type': string }) => item['@type'] === 'WebApplication').offers.price, '0');
});

test('llms.txt summarises the app and links every song page', () => {
  const songs = createSongbookEntries(DEMOS);
  const text = llmsTxt('https://ocarinahero.app/', songGroups(songs));
  assert.match(text, /^# Ocarina Hero\n\n> /);
  for (const entry of songs) assert.ok(text.includes(`(https://ocarinahero.app/song/${entry.id}/)`), entry.id);
});
