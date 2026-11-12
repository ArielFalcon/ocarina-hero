import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Playback } from '../src/ui/playback';
import type { Arrangement } from '../src/core/ir';

const song: Arrangement = { title: 'test', tempoBpm: 120, notes: [] };
function fixture() {
  let state: { playing: boolean; noteIndex: number | null } = { playing: true, noteIndex: null };
  const pending: { resolve: (value: number) => void; reject: (error: Error) => void }[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  const highlights: (number | null)[] = [];
  const statuses: boolean[] = [];
  const errors: unknown[] = [];
  const played: Arrangement[] = [];
  let completions = 0;
  const player = {
    play: (arrangement: Arrangement) => (played.push(arrangement), new Promise<number>((resolve, reject) => pending.push({ resolve, reject }))),
    stopAll: () => {},
    getPlaybackState: () => state,
  };
  const playback = new Playback(player, {
    highlight: (index) => highlights.push(index),
    status: (playing) => statuses.push(playing),
    error: (error) => errors.push(error),
    complete: () => completions++,
  }, {
    request: (callback) => { const id = ++nextId; frames.set(id, callback); return id; },
    cancel: (id) => { frames.delete(id); },
  });
  return { playback, pending, frames, highlights, statuses, errors, played,
    completed: () => completions,
    setState: (value: typeof state) => { state = value; },
    tick: () => { const [id, callback] = [...frames.entries()][0]!; frames.delete(id); callback(0); },
  };
}

test('stale start resolution or rejection cannot affect the newer playback', async () => {
  for (const rejectOld of [false, true]) {
    const f = fixture();
    const old = f.playback.start(song, 0.75);
    f.playback.stop();
    const current = f.playback.start(song, 0.9);
    f.setState({ playing: true, noteIndex: 2 });
    f.pending[1]!.resolve(10);
    await current;
    const before = [f.statuses.length, f.highlights.length];
    if (rejectOld) f.pending[0]!.reject(new Error('stale'));
    else f.pending[0]!.resolve(9);
    await old;
    assert.deepEqual([f.statuses.length, f.highlights.length], before);
    assert.deepEqual(f.errors, []);
    assert.equal(f.playback.playing, true);
    assert.equal(f.frames.size, 1);
    f.playback.stop();
    assert.equal(f.frames.size, 0);
    assert.equal(f.highlights.at(-1), null);
  }
});

test('audio state drives note, rest, next note and completion', async () => {
  const f = fixture();
  const start = f.playback.start(song);
  f.setState({ playing: true, noteIndex: 0 });
  f.pending[0]!.resolve(10);
  await start;
  f.setState({ playing: true, noteIndex: null }); f.tick();
  f.setState({ playing: true, noteIndex: 3 }); f.tick();
  f.setState({ playing: false, noteIndex: null }); f.tick();
  assert.deepEqual(f.highlights.slice(-4), [0, null, 3, null]);
  assert.equal(f.playback.playing, false);
  assert.equal(f.statuses.at(-1), false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.completed(), 1);
  f.playback.stop();
  assert.equal(f.completed(), 1);
});

test('manual cancellation and failed starts do not report natural completion', async () => {
  const f = fixture();
  const cancelled = f.playback.start(song);
  f.playback.stop();
  f.pending[0]!.resolve(10);
  await cancelled;
  const failed = f.playback.start(song);
  f.pending[1]!.reject(new Error('failed'));
  await failed;
  assert.equal(f.completed(), 0);
});

test('rate scales only engine tempo and preserves note indices and source', async () => {
  const f = fixture(); const source: Arrangement = { ...song, notes: [{ pitch: 'A4', bend: 0, startBeat: 1, durationBeats: 2 }] };
  const before = structuredClone(source); const start = f.playback.start(source, 0.9);
  assert.equal(f.played[0]!.tempoBpm, 108); assert.deepEqual(source, before); assert.deepEqual(f.played[0]!.notes, before.notes);
  f.setState({ playing: true, noteIndex: 0 }); f.pending[0]!.resolve(10); await start; assert.equal(f.highlights.at(-1), 0);
});

test('invalid rates report an error without starting audio', async () => {
  const f = fixture(); for (const rate of [0, -1, NaN, Infinity]) await f.playback.start(song, rate);
  assert.equal(f.played.length, 0);
  assert.equal(f.errors.length, 4);
  assert.ok(f.errors.every(error => error instanceof RangeError));
});
