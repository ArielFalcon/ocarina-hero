import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { POPULAR_SEED } from '../src/core/popular-seed';
import {
  handleGet, handlePost, networkOf, POPULAR_LIMIT, pruneMarks, recordEvent, resetSongIds, topSongs, utcDay,
  VISITOR_DAILY_CAP, visitorKey, type Database, type PopularityEnv,
} from '../src/server/popularity';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 11, 1, 12);

/** D1's binding API over the real migration in node:sqlite, so the SQL itself is under test. */
function database(): { db: Database; sql: DatabaseSync } {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_popularity.sql', import.meta.url), 'utf8'));
  const db: Database = {
    prepare(text) {
      const statement = (values: unknown[]) => ({
        bind: (...next: unknown[]) => statement(next),
        first: async <T>() => (sql.prepare(text).get(...values as never[]) ?? null) as T | null,
        run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...values as never[]).changes) } }),
        all: async <T>() => ({ results: sql.prepare(text).all(...values as never[]) as T[] }),
      });
      return statement([]);
    },
  };
  return { db, sql };
}

const scoreOf = (sql: DatabaseSync, id: string) => (sql.prepare('SELECT score FROM song_popularity WHERE song_id = ?').get(id) as { score: number } | undefined)?.score;

test('an action counts once per visitor and day; another action, visitor or day counts again', async () => {
  const { db, sql } = database();
  assert.equal(await recordEvent(db, { song: 'a', action: 'open' }, 'v1', NOW), 'recorded');
  const once = scoreOf(sql, 'a');
  assert.equal(await recordEvent(db, { song: 'a', action: 'open' }, 'v1', NOW + 1000), 'duplicate');
  assert.equal(scoreOf(sql, 'a'), once, 'a repeated action adds nothing');
  assert.equal(await recordEvent(db, { song: 'a', action: 'complete' }, 'v1', NOW), 'recorded');
  assert.equal(await recordEvent(db, { song: 'a', action: 'open' }, 'v2', NOW), 'recorded');
  assert.equal(await recordEvent(db, { song: 'a', action: 'open' }, 'v1', NOW + DAY), 'recorded');
  const a = (await topSongs(db, NOW)).find(song => song.id === 'a');
  assert.ok(Math.abs(a!.score - (2 + 5 + 2 + 2 * 2 ** (1 / 14))) < 0.01, `weighted points, got ${a!.score}`);
  assert.equal(a!.plays, 3, 'opens are plays, the deduplicated one and the completion are not');
});

test('older plays decay: a lesson opened today outranks a completion from a month ago', async () => {
  const { db } = database();
  await recordEvent(db, { song: 'old', action: 'complete' }, 'v1', NOW - 30 * DAY);
  await recordEvent(db, { song: 'new', action: 'open' }, 'v1', NOW);
  await recordEvent(db, { song: 'mid', action: 'quick-play' }, 'v1', NOW - 14 * DAY);
  const songs = (await topSongs(db, NOW)).filter(song => !POPULAR_SEED.includes(song.id));
  assert.deepEqual(songs.map(song => song.id), ['new', 'old', 'mid']);
  assert.equal(songs[2]!.score, 0.5, 'one half-life halves the points');
});

test('the seed fills an empty ranking in its order and real plays displace it', async () => {
  const { db } = database();
  assert.deepEqual((await topSongs(db, NOW)).map(song => song.id), POPULAR_SEED);
  for (let visitor = 0; visitor < 8; visitor++) await recordEvent(db, { song: 'rising', action: 'open' }, `v${visitor}`, NOW);
  await recordEvent(db, { song: POPULAR_SEED.at(-1)!, action: 'complete' }, 'fan', NOW);
  const ids = (await topSongs(db, NOW)).map(song => song.id);
  assert.equal(ids[0], 'rising', 'sixteen real points beat a seeded song with a baseline plus five');
  assert.equal(ids[1], POPULAR_SEED.at(-1), 'a seeded song adds its real points to the baseline');
  assert.deepEqual(ids.slice(2), POPULAR_SEED.slice(0, -1));
});

test('a visitor stops scoring at the daily cap', async () => {
  const { db, sql } = database();
  for (let index = 0; index < VISITOR_DAILY_CAP; index++) await recordEvent(db, { song: `s${index}`, action: 'open' }, 'bot', NOW);
  assert.equal(await recordEvent(db, { song: 'extra', action: 'open' }, 'bot', NOW), 'capped');
  assert.equal(scoreOf(sql, 'extra'), undefined);
  assert.equal(await recordEvent(db, { song: 'extra', action: 'open' }, 'person', NOW), 'recorded', 'other visitors are unaffected');
});

test('pruning keeps today and yesterday, so a play just after midnight is still deduplicated', async () => {
  const { db, sql } = database();
  for (const offset of [0, 1, 2, 5]) await recordEvent(db, { song: 'a', action: 'open' }, `v${offset}`, NOW - offset * DAY);
  await pruneMarks(db, NOW);
  const days = (sql.prepare('SELECT day FROM popularity_marks ORDER BY day').all() as { day: number }[]).map(row => utcDay(NOW) - row.day);
  assert.deepEqual(days, [1, 0]);
});

test('visitors are grouped by IPv6 /64 and stay distinct per IPv4 address and per day', async () => {
  assert.equal(networkOf('2001:db8:0:1::5'), networkOf('2001:0db8:0000:0001:ffff:1:2:3'));
  assert.notEqual(networkOf('2001:db8:0:1::5'), networkOf('2001:db8:0:2::5'));
  const day = utcDay(NOW);
  assert.equal(await visitorKey('2001:db8:0:1::5', day, 's'), await visitorKey('2001:db8:0:1:9::', day, 's'));
  assert.notEqual(await visitorKey('203.0.113.1', day, 's'), await visitorKey('203.0.113.2', day, 's'));
  assert.notEqual(await visitorKey('203.0.113.1', day, 's'), await visitorKey('203.0.113.1', day + 1, 's'));
  assert.notEqual(await visitorKey('203.0.113.1', day, 's'), await visitorKey('203.0.113.1', day, 't'), 'the salt changes the hash');
});

function context(env: PopularityEnv, init: { url?: string; origin?: string | null; body?: string; method?: string } = {}) {
  const url = init.url ?? 'https://ocarinahero.app/api/popularity';
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' });
  const origin = init.origin === undefined ? new URL(url).origin : init.origin;
  if (origin) headers.set('Origin', origin);
  const method = init.method ?? 'POST';
  const waited: Promise<unknown>[] = [];
  return { request: new Request(url, { method, headers, body: method === 'POST' ? init.body ?? JSON.stringify({ song: 'a', action: 'open' }) : undefined }), env, waitUntil: (promise: Promise<unknown>) => { waited.push(promise); } };
}

const assets = (ids: unknown, status = 200) => ({ fetch: async () => new Response(JSON.stringify(ids), { status }) });

test('POST records a known song from the site and rejects everything else without writing', async () => {
  resetSongIds();
  const { db, sql } = database();
  const env = { DB: db, ASSETS: assets(['a', 'b']) };
  assert.equal((await handlePost(context(env, { origin: 'https://evil.example' }), NOW)).status, 403);
  assert.equal((await handlePost(context(env, { origin: null }), NOW)).status, 403);
  assert.equal((await handlePost(context(env, { body: '{"song":"zzz","action":"open"}' }), NOW)).status, 400);
  assert.equal((await handlePost(context(env, { body: '{"song":"a","action":"cheat"}' }), NOW)).status, 400);
  assert.equal((await handlePost(context(env, { body: 'not json' }), NOW)).status, 400);
  assert.equal((await handlePost(context(env, { body: `{"song":"a","action":"open","pad":"${'x'.repeat(600)}"}` }), NOW)).status, 413);
  assert.equal(scoreOf(sql, 'a'), undefined, 'nothing above wrote a score');
  assert.equal((await handlePost(context(env), NOW)).status, 204);
  assert.ok(scoreOf(sql, 'a')! > 0);
});

test('POST answers 503 without a database or catalogue, and retries the catalogue later', async () => {
  resetSongIds();
  const { db } = database();
  assert.equal((await handlePost(context({ ASSETS: assets(['a']) }), NOW)).status, 503);
  assert.equal((await handlePost(context({ DB: db, ASSETS: assets([], 404) }), NOW)).status, 503);
  assert.equal((await handlePost(context({ DB: db, ASSETS: assets(['a']) }), NOW)).status, 204, 'a failed catalogue load is not cached');
});

test('GET returns the top songs by current score, capped, and serves the edge cache when present', async () => {
  const { db } = database();
  for (let index = 0; index < POPULAR_LIMIT + 5; index++) {
    for (let visitor = 0; visitor <= index; visitor++) await recordEvent(db, { song: `s${index}`, action: 'quick-play' }, `v${visitor}`, NOW);
  }
  const response = await handleGet(context({ DB: db }, { method: 'GET' }), NOW, null);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control') ?? '', /max-age=60/);
  const { songs } = await response.json() as { songs: { id: string }[] };
  assert.equal(songs.length, POPULAR_LIMIT);
  assert.equal(songs[0]!.id, `s${POPULAR_LIMIT + 4}`);
  const cached = new Response('{"songs":[{"id":"cached","score":1}]}');
  const cache = { match: async () => cached, put: async () => {} } as unknown as Cache;
  assert.equal(await handleGet(context({}, { method: 'GET' }), NOW, cache), cached, 'a cache hit skips the database');
  assert.equal((await handleGet(context({}, { method: 'GET' }), NOW, null)).status, 503);
});
