import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMOS } from './catalogue-loader';
import { RELATED_SHOWN, songArticleHtml, songSummary, type SongArticle } from '../src/site/song-article';
import { relatedSongs, songGroups, songPageOf } from '../src/site/song-pages';
import { createSongbookEntries } from '../src/ui/songbook';

const article: SongArticle = { title: 'Song of "Storms" & Rain', universe: 'The Legend of <Zelda>', version: 'Ocarina of Time', noteCount: 23, passageCount: 1, difficulty: 'medium', tab: 'L + D-pad up, R <b>' };
const related = [{ id: 'zeldas-lullaby', title: 'Zelda’s <Lullaby>', meta: 'Zelda · Ocarina of Time' }];

test('the summary states the song, its version, size and difficulty from its own data', () => {
  assert.equal(songSummary(article), 'Song of "Storms" & Rain (Ocarina of Time) from The Legend of <Zelda>: 23 notes in 1 passage, Medium difficulty.');
  assert.equal(songSummary({ ...article, version: undefined, noteCount: 1, passageCount: 3 }), 'Song of "Storms" & Rain from The Legend of <Zelda>: 1 note in 3 passages, Medium difficulty.');
});

test('the article shows the tab and the summary as text, escaped', () => {
  const html = songArticleHtml(article, related, '/');
  assert.ok(html.includes('<p id="tab-text" class="tab-text">L + D-pad up, R &lt;b&gt;</p>'));
  assert.ok(html.includes('Song of &quot;Storms&quot; &amp; Rain (Ocarina of Time) from The Legend of &lt;Zelda&gt;'));
  assert.doesNotMatch(html, /<b>|<Zelda>/);
});

test('the article links the related songs and the songbook under the deployment base', () => {
  const html = songArticleHtml(article, related, '/sub/');
  assert.ok(html.includes('<a class="song-card" href="/sub/song/zeldas-lullaby/" data-song-link="zeldas-lullaby"><span class="song-card-title">Zelda’s &lt;Lullaby&gt;</span>'));
  assert.ok(html.includes('More The Legend of &lt;Zelda&gt; songs'));
  assert.ok(html.includes('<a href="/sub/" data-view-link="catalog">'));
  assert.doesNotMatch(songArticleHtml(article, [], '/'), /<ul|More /);
});

test('a bundled song page feeds the article with its opening arrangement and never lists itself', () => {
  const entries = createSongbookEntries(DEMOS);
  const pages = entries.map(songPageOf);
  const page = pages.find(candidate => candidate.id === 'lullaby-trigger')!;
  const others = relatedSongs(songGroups(entries), page);
  const html = songArticleHtml(page, others, '/');
  assert.ok(html.includes(`${page.noteCount} notes in ${page.passageCount} passages`));
  assert.ok(html.includes(page.tab.replace(/&/g, '&amp;')));
  assert.ok(!others.some(link => link.id === page.id) && others.every(link => html.includes(`href="/song/${link.id}/"`)));
});

test('the article folds under one closed disclosure, and related songs past the first cards fold under "Show N more"', () => {
  const links = Array.from({ length: RELATED_SHOWN + 2 }, (_, index) => ({ id: `song-${index}`, title: `Song ${index}`, meta: 'Zelda' }));
  const html = songArticleHtml(article, links, '/');
  assert.match(html, /^<details class="song-about"><summary>/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  const [shown, folded] = html.split('<details class="song-cards-more"><summary>Show 2 more</summary>');
  assert.ok(folded !== undefined);
  assert.ok(links.slice(0, RELATED_SHOWN).every(link => shown!.includes(`data-song-link="${link.id}"`)));
  assert.ok(links.slice(RELATED_SHOWN).every(link => !shown!.includes(`data-song-link="${link.id}"`) && folded.includes(`data-song-link="${link.id}"`)));
  assert.doesNotMatch(songArticleHtml(article, links.slice(0, RELATED_SHOWN), '/'), /song-cards-more/);
});
