import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QuickPlay, type QuickPlayState } from '../src/ui/quick-play';
import type { Arrangement } from '../src/core/ir';

const song = (title: string): Arrangement => ({
  title, tempoBpm: 120,
  notes: [0, 1, 2, 3].map(beat => ({ pitch: 'A4', startBeat: beat * 2, durationBeats: 1 })),
});

function fixture() {
  let engine = { playing: false, noteIndex: null as number | null };
  const played: Arrangement[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  const states: QuickPlayState[] = [];
  const player = {
    play: async (arrangement: Arrangement) => { played.push(arrangement); engine = { playing: true, noteIndex: null }; return 1; },
    stopAll: () => { engine = { playing: false, noteIndex: null }; },
    getPlaybackState: () => engine,
  };
  const quick = new QuickPlay(player, state => states.push(state), error => { throw error; }, {
    request: callback => { const id = ++nextId; frames.set(id, callback); return id; },
    cancel: id => { frames.delete(id); },
  });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  /** Advance the engine to a note of the started arrangement, then run one animation frame. */
  const sound = (noteIndex: number | null, playing = true) => {
    engine = { playing, noteIndex };
    const [id, callback] = [...frames.entries()][0]!;
    frames.delete(id);
    callback(0);
  };
  return { quick, played, states, settle, sound };
}

test('pausing keeps the position and resuming restarts at the sounding note', async () => {
  const f = fixture();
  f.quick.toggle('a', song('a'));
  await f.settle();
  f.sound(2);
  assert.equal(f.quick.state.activeNote, 2);

  f.quick.toggle('a', song('a'));
  assert.deepEqual(f.quick.state, { id: 'a', playing: false, activeNote: null, cursor: 2 });

  f.quick.toggle('a', song('a'));
  await f.settle();
  assert.equal(f.played.length, 2);
  assert.deepEqual(f.played[1]!.notes.map(note => note.startBeat), [0, 2], 'resumes from note 2 with its onset at beat zero');
  f.sound(0);
  assert.equal(f.quick.state.activeNote, 2, 'engine indices map back to arrangement indices');
});

test('another song replaces the current one from its start', async () => {
  const f = fixture();
  f.quick.toggle('a', song('a'));
  await f.settle();
  f.sound(3);
  f.quick.toggle('b', song('b'));
  await f.settle();
  assert.equal(f.played[1]!.title, 'b');
  assert.equal(f.played[1]!.notes.length, 4);
  assert.deepEqual(f.quick.state, { id: 'b', playing: true, activeNote: null, cursor: 0 });
  assert.ok(f.states.every(state => state.id !== null), 'switching songs never reports a closed player');
});

test('finishing the song rewinds it and closing unloads it', async () => {
  const f = fixture();
  f.quick.toggle('a', song('a'));
  await f.settle();
  f.sound(3);
  f.sound(null, false);
  assert.deepEqual(f.quick.state, { id: 'a', playing: false, activeNote: null, cursor: 0 });

  f.quick.toggle('a', song('a'));
  await f.settle();
  assert.equal(f.played[1]!.notes.length, 4, 'plays again from the first note');

  f.quick.close();
  assert.deepEqual(f.quick.state, { id: null, playing: false, activeNote: null, cursor: 0 });
  assert.equal(f.states.at(-1)!.id, null);
});
