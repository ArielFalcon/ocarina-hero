import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMOS } from './catalogue-loader';
import { createSongbookEntries } from '../src/ui/songbook';
import { fetchPopularSnapshot, popularHead, popularRowsHtml, popularSnapshot } from '../src/site/popular';
import { sitemapXml, llmsTxt, songGroups } from '../src/site/song-pages';

const SITE = 'https://ocarinahero.app/';
const entries = createSongbookEntries(DEMOS);
const [first, second, third] = entries;
const icon = () => '<i></i>';

test('the snapshot keeps the API rank order and drops songs the catalogue no longer has', () => {
  const ranking = [
    { id: second!.id, plays: 90 }, { id: 'removed-song', plays: 80 }, { id: first!.id, plays: 70 }, { id: second!.id, plays: 60 }, { id: third!.id, plays: 5 },
  ];
  assert.deepEqual(popularSnapshot(entries, ranking).map(row => [row.entry.id, row.plays]), [[second!.id, 90], [first!.id, 70], [third!.id, 5]]);
});

test('the server rows are the rows the app draws: ranked, linked to the song path and unsaved', () => {
  const html = popularRowsHtml(popularSnapshot(entries, [{ id: first!.id, plays: 1200 }]), '/', icon);
  assert.match(html, new RegExp(`^<article class="song-row"><span class="count-badge popular-rank"[^>]*>1</span><a class="song-open" href="/song/${first!.id}/" data-song="${first!.id}">`));
  assert.ok(html.includes('1.2K plays'));
  assert.ok(html.includes('aria-pressed="false"'));
});

test('a failed, slow or malformed snapshot request renders an empty list and warns instead of failing the build', async () => {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(message);
  const ok = (body: unknown) => async () => new Response(JSON.stringify(body));
  assert.deepEqual(await fetchPopularSnapshot('https://x.test/api', { fetch: async () => { throw new Error('offline'); }, warn }), []);
  assert.deepEqual(await fetchPopularSnapshot('https://x.test/api', { fetch: async () => new Response('', { status: 503 }), warn }), []);
  assert.deepEqual(await fetchPopularSnapshot('https://x.test/api', { fetch: async () => new Response('<html>'), warn }), []);
  assert.deepEqual(await fetchPopularSnapshot('https://x.test/api', { fetch: ok({ songs: 'nope' }), warn }), []);
  const hang = (_url: string, init?: { signal?: AbortSignal }) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
  assert.deepEqual(await fetchPopularSnapshot('https://x.test/api', { fetch: hang, warn, timeoutMs: 20 }), []);
  assert.equal(warnings.length, 5);
  assert.deepEqual(await fetchPopularSnapshot('https://x.test/api', { fetch: ok({ songs: [{ id: 'a', plays: 3 }, { id: 7 }, { id: 'b', plays: 'many' }] }), warn }), [{ id: 'a', plays: 3 }, { id: 'b', plays: 0 }]);
  assert.equal(warnings.length, 5);
});

test('the Popular page has its own address and tells search engines its ranked songs and breadcrumb', () => {
  const rows = popularSnapshot(entries, [{ id: first!.id, plays: 3 }, { id: second!.id, plays: 2 }]);
  const head = popularHead(SITE, rows);
  assert.equal(head.url, `${SITE}popular/`);
  assert.equal(head.title, 'Most Popular Zelda Ocarina Songs | Ocarina Hero');
  const graph = (head.structuredData as { '@graph': Record<string, any>[] })['@graph'];
  assert.deepEqual(graph.find(item => item['@type'] === 'CollectionPage')!.mainEntity.itemListElement.map((item: { url: string }) => item.url), [first, second].map(entry => `${SITE}song/${entry!.id}/`));
  assert.deepEqual(graph.find(item => item['@type'] === 'BreadcrumbList')!.itemListElement.map((crumb: { item: string }) => crumb.item), [SITE, `${SITE}popular/`]);
  assert.equal(JSON.stringify(popularHead(SITE, []).structuredData).includes('ListItem","position":1,"url"'), false);
});

test('the sitemap and llms.txt list the Popular page', () => {
  const locs = [...sitemapXml(SITE, [first!.id]).matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(locs.slice(0, 2), [SITE, `${SITE}popular/`]);
  assert.ok(llmsTxt(SITE, songGroups(entries)).includes(`](${SITE}popular/)`));
});
