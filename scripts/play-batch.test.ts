import assert from 'node:assert/strict';
import test from 'node:test';
import { browserStore, createPlayBatch, memoryStore, PENDING_PLAYS_STORAGE, type PlayStore, type SendResult } from '../src/ui/play-batch';

/** A batch whose sends answer with the queued results (default delivered); `sent` records every send. */
function setup(options: { store?: PlayStore; results?: SendResult[]; maxQueuedPlays?: number } = {}) {
  const store = options.store ?? memoryStore();
  const results = [...options.results ?? []];
  const sent: Record<string, number>[] = [];
  const batch = createPlayBatch({
    store,
    maxBatchPlays: 5,
    maxQueuedPlays: options.maxQueuedPlays ?? 50,
    send: async plays => { sent.push(plays); return results.shift() ?? 'delivered'; },
  });
  return { batch, store, sent };
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const total = (plays: Record<string, number>) => Object.values(plays).reduce((sum, count) => sum + count, 0);

test('plays leave together exactly once, at the fifth play or on a flush, counted per song', async () => {
  const { batch, sent, store } = setup();
  for (const song of ['a', 'b', 'a', 'c']) batch.add(song);
  assert.deepEqual(sent, [], 'four plays wait');
  batch.add('d');
  assert.deepEqual(sent, [{ a: 2, b: 1, c: 1, d: 1 }]);
  assert.deepEqual(store.read(), {}, 'the queue empties as the batch leaves');
  batch.add('e');
  batch.flush();
  batch.flush();
  assert.deepEqual(sent.slice(1), [{ e: 1 }], 'a second flush has nothing to send');
});

test('queued plays survive the page: a later page with the same storage sends them', () => {
  const store = memoryStore();
  setup({ store }).batch.add('a');
  setup({ store }).batch.add('b');
  const next = setup({ store });
  next.batch.flush();
  assert.deepEqual(next.sent, [{ a: 1, b: 1 }]);
});

test('a batch the server could not take returns to the queue; a rejected one is dropped', async () => {
  const { batch, sent, store } = setup({ results: ['retry', 'rejected'] });
  batch.add('a');
  batch.flush();
  await settle();
  assert.deepEqual(store.read(), { a: 1 }, 'kept for the next flush');
  for (const song of ['b', 'c', 'd', 'e']) batch.add(song);
  assert.equal(sent.length, 1, 'after a failure the queue waits for the next flush instead of sending at every play');
  batch.flush();
  await settle();
  assert.deepEqual(sent[1], { a: 1, b: 1, c: 1, d: 1, e: 1 });
  assert.deepEqual(store.read(), {}, 'rejected plays are not retried');
  for (const song of ['f', 'g', 'h', 'i', 'j']) batch.add(song);
  assert.equal(sent.length, 3, 'a successful flush ends the wait');
});

test('a queue longer than one batch leaves in batches of at most five plays, losing none', async () => {
  const { batch, sent, store } = setup({ results: ['retry'] });
  batch.add('a');
  batch.flush();
  await settle();
  for (let play = 0; play < 6; play++) batch.add('x');
  assert.deepEqual(store.read(), { a: 1, x: 6 }, 'held while waiting for the next flush');
  batch.flush();
  await settle();
  assert.deepEqual(sent.slice(1), [{ a: 1, x: 4 }, { x: 2 }], 'one song splits across batches');
  assert.deepEqual(store.read(), {});
});

test('a waiting queue stops growing at its cap', async () => {
  const { batch, store } = setup({ maxQueuedPlays: 6, results: ['retry'] });
  batch.add('a');
  batch.flush();
  await settle();
  for (let play = 0; play < 8; play++) batch.add(`s${play}`);
  assert.equal(total(store.read()), 6);
});

test('stored plays that cannot be read count as an empty queue, and a full storage keeps the queue in memory', () => {
  const items = new Map<string, string>();
  let full = false;
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { if (full) throw new Error('QuotaExceededError'); items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  } as unknown as Storage;
  const store = browserStore(storage);
  items.set(PENDING_PLAYS_STORAGE, 'not json');
  assert.deepEqual(store.read(), {});
  items.set(PENDING_PLAYS_STORAGE, '{"a":2,"b":0,"c":1.5,"d":"3"}');
  assert.deepEqual(store.read(), { a: 2 }, 'only whole positive counts survive');
  store.write({});
  assert.equal(items.has(PENDING_PLAYS_STORAGE), false, 'an empty queue leaves nothing stored');
  full = true;
  store.write({ e: 1 });
  assert.deepEqual(store.read(), { e: 1 });
});
