import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  handleGet, handlePost, MAX_BATCH_PLAYS, POPULAR_LIMIT, recordPlays, resetSongIds, topSongs, type Database, type PopularityEnv,
} from '../src/server/popularity';

/** D1's binding API over the real migration in node:sqlite, so the SQL itself is under test. `writes` counts statements run. */
function database(): { db: Database; sql: DatabaseSync; writes: () => number } {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['0001_popularity.sql', '0002_all_time_plays.sql']) sql.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  let runs = 0;
  const db: Database = {
    prepare(text) {
      const statement = (values: unknown[]) => ({
        bind: (...next: unknown[]) => statement(next),
        run: async () => { runs++; return { meta: { changes: Number(sql.prepare(text).run(...values as never[]).changes) } }; },
        all: async <T>() => ({ results: sql.prepare(text).all(...values as never[]) as T[] }),
      });
      return statement([]);
    },
  };
  return { db, sql, writes: () => runs };
}

const playsOf = (sql: DatabaseSync, id: string) => (sql.prepare('SELECT plays FROM song_popularity WHERE song_id = ?').get(id) as { plays: number } | undefined)?.plays;
const play = (song: string, count = 1) => new Map([[song, count]]);

test('every play counts, even repeated ones from the same visitor, and ranks by all-time plays', async () => {
  const { db } = database();
  for (let index = 0; index < 3; index++) await recordPlays(db, play('steady'));
  await recordPlays(db, play('quick', 2));
  await recordPlays(db, play('once'));
  assert.deepEqual(await topSongs(db), [{ id: 'steady', plays: 3 }, { id: 'quick', plays: 2 }, { id: 'once', plays: 1 }]);
});

test('an empty database ranks nothing and ties keep a stable order', async () => {
  const { db } = database();
  assert.deepEqual(await topSongs(db), []);
  await recordPlays(db, play('b'));
  await recordPlays(db, play('a'));
  assert.deepEqual((await topSongs(db)).map(song => song.id), ['a', 'b']);
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
  assert.equal((await handlePost(context(env, { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await handlePost(context(env, { origin: null }))).status, 403);
  assert.equal((await handlePost(context(env, { body: '{"song":"zzz","action":"open"}' }))).status, 400);
  assert.equal((await handlePost(context(env, { body: '{"song":"a","action":"cheat"}' }))).status, 400);
  assert.equal((await handlePost(context(env, { body: 'not json' }))).status, 400);
  assert.equal((await handlePost(context(env, { body: `{"song":"a","action":"open","pad":"${'x'.repeat(600)}"}` }))).status, 413);
  assert.equal(playsOf(sql, 'a'), undefined, 'nothing above counted a play');
  assert.equal((await handlePost(context(env))).status, 204);
  assert.equal((await handlePost(context(env))).status, 204);
  assert.equal(playsOf(sql, 'a'), 2, 'the same visitor and song count again');
});

test('a batch adds each song its plays in one write, alongside the single-play format', async () => {
  resetSongIds();
  const { db, sql, writes } = database();
  const env = { DB: db, ASSETS: assets(['a', 'b', 'c']) };
  assert.equal((await handlePost(context(env, { body: '{"plays":{"a":3,"b":1}}' }))).status, 204);
  assert.equal(writes(), 1, 'the whole batch is one statement');
  assert.equal((await handlePost(context(env, { body: '{"plays":{"a":2}}' }))).status, 204);
  assert.equal((await handlePost(context(env, { body: '{"song":"c","action":"open"}' }))).status, 204, 'tabs still running the previous build');
  assert.deepEqual([playsOf(sql, 'a'), playsOf(sql, 'b'), playsOf(sql, 'c')], [5, 1, 1]);
});

test('a batch over five plays, or with any invalid entry, is rejected whole without writing; five plays pass', async () => {
  resetSongIds();
  assert.equal(MAX_BATCH_PLAYS, 5);
  /** The catalogue's longest ids are 43 characters. */
  const long = Array.from({ length: MAX_BATCH_PLAYS }, (_, index) => `long-${index}-`.padEnd(43, 'x'));
  const { db, sql, writes } = database();
  const env = { DB: db, ASSETS: assets(['s0', 's1', ...long]) };
  const batch = (plays: Record<string, unknown>) => context(env, { body: JSON.stringify({ plays }) });
  for (const plays of [
    {}, { s0: 1, zzz: 1 }, { s0: 0 }, { s0: 0, s1: 1 }, { s0: 1.5 }, { s0: '2' }, { s0: 6 }, { s0: 3, s1: 3 },
    Object.fromEntries([...long, 's0'].map(id => [id, 1])),
  ]) assert.equal((await handlePost(batch(plays))).status, 400, JSON.stringify(plays).slice(0, 60));
  assert.equal((await handlePost(context(env, { body: '{"plays":[1]}' }))).status, 400);
  assert.equal(writes(), 0, 'nothing above wrote');
  assert.equal((await handlePost(batch({ s0: 5 }))).status, 204);
  assert.equal((await handlePost(batch({ s0: 2, s1: 3 }))).status, 204);
  assert.equal((await handlePost(batch(Object.fromEntries(long.map(id => [id, 1]))))).status, 204, 'five songs, ids at full length');
  assert.deepEqual([playsOf(sql, 's0'), playsOf(sql, 's1'), playsOf(sql, long[4]!)], [7, 3, 1]);
});

test('POST answers 503 without a database or catalogue, and retries the catalogue later', async () => {
  resetSongIds();
  const { db } = database();
  assert.equal((await handlePost(context({ ASSETS: assets(['a']) }))).status, 503);
  assert.equal((await handlePost(context({ DB: db, ASSETS: assets([], 404) }))).status, 503);
  assert.equal((await handlePost(context({ DB: db, ASSETS: assets(['a']) }))).status, 204, 'a failed catalogue load is not cached');
});

test('GET returns the most played songs, capped, and serves the edge cache when present', async () => {
  const { db } = database();
  for (let index = 0; index < POPULAR_LIMIT + 5; index++) {
    await recordPlays(db, play(`s${index}`, index + 1));
  }
  const response = await handleGet(context({ DB: db }, { method: 'GET' }), null);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control') ?? '', /max-age=60/);
  const { songs } = await response.json() as { songs: { id: string }[] };
  assert.equal(songs.length, POPULAR_LIMIT);
  assert.equal(songs[0]!.id, `s${POPULAR_LIMIT + 4}`);
  const cached = new Response('{"songs":[{"id":"cached","plays":1}]}');
  const cache = { match: async () => cached, put: async () => {} } as unknown as Cache;
  assert.equal(await handleGet(context({}, { method: 'GET' }), cache), cached, 'a cache hit skips the database');
  assert.equal((await handleGet(context({}, { method: 'GET' }), null)).status, 503);
});
