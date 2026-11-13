import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CATALOGUE_INDEX } from '../src/core/songs/catalogue-index';
import { INLINE_DEMOS, type DemoTrack } from '../src/core/demo';
import { createTrackLoader, latestRequest } from '../src/core/track-loader';
import { rateDifficulty } from '../src/core/difficulty';
import { prepareMelody } from '../src/core/prepare';
import { catalogueTrack, catalogueSources } from './catalogue-loader';

test('every indexed difficulty equals the difficulty of the notes the lesson opens with', () => {
  assert.ok(CATALOGUE_INDEX.length > 200);
  for (const summary of CATALOGUE_INDEX) {
    const track = catalogueTrack(summary.id);
    const notes = prepareMelody(track, { simplify: false, maxBend: 2 }).notes;
    assert.deepEqual(summary.difficulty, rateDifficulty(notes, summary.tempoBpm), summary.id);
  }
});

test('a loaded track carries the summary fields and the exact notes stored in its JSON file', async () => {
  const loader = createTrackLoader([...CATALOGUE_INDEX, ...INLINE_DEMOS], catalogueSources());
  for (const summary of CATALOGUE_INDEX) {
    const stored = JSON.parse(readFileSync(`src/core/songs/catalogue/${summary.id}.json`, 'utf8'));
    const track = await loader.load(summary.id);
    assert.deepEqual(track.melody, stored.melody, summary.id);
    assert.deepEqual(track.fixedNotes, stored.fixedNotes, summary.id);
    assert.deepEqual(track.phraseStarts, stored.phraseStarts, summary.id);
    assert.deepEqual([track.title, track.subtitle, track.tempoBpm, track.beatsPerBar], [summary.title, summary.subtitle, summary.tempoBpm, summary.beatsPerBar]);
    assert.equal('difficulty' in track, false);
  }
});

test('inline demos resolve without a source and unknown ids reject', async () => {
  const loader = createTrackLoader(INLINE_DEMOS, {});
  const demo = INLINE_DEMOS[0]!;
  assert.equal(await loader.load(demo.id), demo);
  assert.equal(loader.cached(demo.id), demo);
  await assert.rejects(loader.load('nope'));
});

test('prefetch and load share one request per song and a failed request is retried', async () => {
  let calls = 0;
  let fail = true;
  const summary = CATALOGUE_INDEX[0]!;
  const data = catalogueTrack(summary.id);
  const loader = createTrackLoader([summary], {
    [summary.id]: async () => {
      calls++;
      if (fail) throw new Error('offline');
      return data;
    },
  });
  loader.prefetch(summary.id);
  loader.prefetch(summary.id);
  await assert.rejects(loader.load(summary.id));
  assert.equal(calls, 1);
  assert.equal(loader.cached(summary.id), undefined);
  fail = false;
  const [first, second] = await Promise.all([loader.load(summary.id), loader.load(summary.id)]);
  assert.equal(calls, 2);
  assert.equal(first, second);
  loader.prefetch(summary.id);
  assert.equal(calls, 2);
  assert.equal(loader.cached(summary.id), first);
});

test('only the latest request may apply its result when loads finish out of order', async () => {
  const gates = new Map<string, () => void>();
  const wait = (id: string) => new Promise<void>(resolve => gates.set(id, resolve));
  const [a, b] = CATALOGUE_INDEX;
  const loader = createTrackLoader([a!, b!], Object.fromEntries([a!, b!].map(summary => [summary.id, async () => {
    await wait(summary.id);
    return catalogueTrack(summary.id);
  }])));
  const latest = latestRequest();
  const applied: string[] = [];
  const open = (id: string) => {
    const current = latest.begin();
    return loader.load(id).then((track: DemoTrack) => { if (current()) applied.push(track.id); });
  };
  const first = open(a!.id);
  const second = open(b!.id);
  while (gates.size < 2) await new Promise(resolve => setImmediate(resolve));
  gates.get(b!.id)!();
  await second;
  gates.get(a!.id)!();
  await first;
  assert.deepEqual(applied, [b!.id]);
  const cancelled = latest.begin();
  latest.cancel();
  assert.equal(cancelled(), false);
});
