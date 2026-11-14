import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test, { mock } from 'node:test';
import { missedSearchNoter } from '../src/core/search-text';
import { handlePost, MAX_MISSED_TEXTS, parseMissedSearch } from '../src/server/missed-searches';
import type { Database } from '../src/server/popularity';

test('typing a search letter by letter reports only the text it settles on, once', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const sent: string[] = [];
    const note = missedSearchNoter(query => sent.push(query), 1000);
    for (const typed of ['ze', 'zel', 'zeld', 'zelda ']) { note(typed, true); mock.timers.tick(400); }
    assert.deepEqual(sent, [], 'no report while the player is still typing');
    mock.timers.tick(1000);
    assert.deepEqual(sent, ['zelda']);
    note('ZELDA', true);
    mock.timers.tick(5000);
    assert.deepEqual(sent, ['zelda'], 'the same text is not reported twice');
  } finally { mock.timers.reset(); }
});

test('a search that finds songs, or is too short, or is replaced by one with results, is never reported', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const sent: string[] = [];
    const note = missedSearchNoter(query => sent.push(query), 1000);
    note('zelda', false);
    note('ab', true);
    note('zeldaa', true);
    note('zelda', false);
    mock.timers.tick(5000);
    assert.deepEqual(sent, [], 'the pending report is dropped when the last render found songs');
  } finally { mock.timers.reset(); }
});

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0003_missed_searches.sql', import.meta.url), 'utf8'));
  const db: Database = {
    prepare(text) {
      const statement = (values: unknown[]) => ({
        bind: (...next: unknown[]) => statement(next),
        run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...values as never[]).changes) } }),
        all: async <T>() => ({ results: sql.prepare(text).all(...values as never[]) as T[] }),
      });
      return statement([]);
    },
  };
  return { db, sql };
}

const rows = (sql: DatabaseSync) => (sql.prepare('SELECT query, count FROM missed_searches ORDER BY query').all() as { query: string; count: number }[]).map(row => ({ ...row }));

function post(db: Database | undefined, body: unknown, origin: string | null = 'https://ocarinahero.app') {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin) headers.set('Origin', origin);
  const request = new Request('https://ocarinahero.app/api/missed-searches', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return handlePost({ request, env: { DB: db }, waitUntil: () => {} });
}

test('the server stores one normalized row per text and counts repeats', async () => {
  const { db, sql } = database();
  assert.equal((await post(db, { query: ' Zelda  MAJORA ' })).status, 204);
  assert.equal((await post(db, { query: 'zelda majora' })).status, 204);
  assert.equal((await post(db, { query: 'Música' })).status, 204);
  assert.deepEqual(rows(sql), [{ query: 'musica', count: 1 }, { query: 'zelda majora', count: 2 }]);
});

test('the server rejects personal data, bad sizes, other origins and a missing database without writing', async () => {
  const { db, sql } = database();
  for (const query of ['me@example.com', 'call 600123456', 'ab', 'x'.repeat(61), 42, null]) assert.equal((await post(db, { query })).status, 400, String(query));
  assert.equal((await post(db, { query: 'zelda' }, 'https://evil.example')).status, 403);
  assert.equal((await post(db, { query: 'zelda' }, null)).status, 403);
  assert.equal((await post(db, 'nope')).status, 400);
  assert.equal((await post(db, { query: 'zelda', pad: 'x'.repeat(600) })).status, 413);
  assert.equal((await post(undefined, { query: 'zelda' })).status, 503);
  assert.deepEqual(rows(sql), []);
  assert.equal(parseMissedSearch({ query: 'Hyrule  Field' }), 'hyrule field');
});

test('past the row cap new texts are dropped while stored ones keep counting', async () => {
  const { db, sql } = database();
  sql.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${MAX_MISSED_TEXTS}) INSERT INTO missed_searches SELECT 'text ' || i, 1, 0 FROM n`);
  assert.equal((await post(db, { query: 'brand new' })).status, 204);
  assert.equal((await post(db, { query: 'text 7' })).status, 204);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM missed_searches WHERE query = 'brand new'").get()!.n, 0);
  assert.equal(sql.prepare("SELECT count FROM missed_searches WHERE query = 'text 7'").get()!.count, 2);
});
