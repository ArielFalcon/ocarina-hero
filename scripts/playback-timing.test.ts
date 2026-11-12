import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OcarinaEngine } from '../src/audio/engine';

const song = { title: '', tempoBpm: 120, notes: [
  { pitch: 'A4' as const, startBeat: 2, durationBeats: 1 },
  { pitch: 'D5' as const, startBeat: 0, durationBeats: 1 },
] };

test('waits for resume, preserves first duration and original indices through rests and release', async () => {
  let resolve!: () => void;
  const ctx = { currentTime: 4, state: 'suspended', resume: () => new Promise<void>(r => { resolve = r; }) };
  const engine = new OcarinaEngine() as any;
  const calls: number[][] = [];
  engine.ctx = ctx;
  engine.ensure = () => ({ ctx, master: {} });
  engine.createVoice = (_c: unknown, _m: unknown, hz: number, start: number, duration: number) => { calls.push([hz, start, duration]); return {}; };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 1, clearInterval() {} } });
  const pending = engine.play(song);
  assert.deepEqual(engine.getPlaybackState(), { playing: true, noteIndex: null });
  assert.equal(calls.length, 0);
  ctx.currentTime = 10; ctx.state = 'running'; resolve();
  const end = await pending;
  assert.equal(calls.length, 2);
  assert.ok(calls[0]![1]! >= 10);
  assert.equal(calls[0]![2], 0.5);
  ctx.currentTime = 10.02; assert.equal(engine.getPlaybackState().noteIndex, 1);
  ctx.currentTime = 10.7; assert.equal(engine.getPlaybackState().noteIndex, null);
  ctx.currentTime = 11.1; assert.equal(engine.getPlaybackState().noteIndex, 0);
  ctx.currentTime = end - 0.01; assert.deepEqual(engine.getPlaybackState(), { playing: true, noteIndex: null });
  ctx.currentTime = end; assert.deepEqual(engine.getPlaybackState(), { playing: false, noteIndex: null });
});

test('stop invalidates an unresolved start', async () => {
  let resolve!: () => void;
  const ctx = { currentTime: 0, state: 'suspended', resume: () => new Promise<void>(r => { resolve = r; }) };
  const engine = new OcarinaEngine() as any; let voices = 0;
  engine.ctx = ctx;
  engine.ensure = () => ({ ctx, master: {} });
  engine.createVoice = () => { voices++; return {}; };
  const pending = engine.play(song); engine.stopAll(); resolve();
  assert.equal(await pending, 0); assert.equal(voices, 0);
});

test('a rejected resume clears pending state and propagates the error', async () => {
  const failure = new Error('resume failed');
  const ctx = { currentTime: 0, state: 'suspended', resume: () => Promise.reject(failure) };
  const engine = new OcarinaEngine() as any;
  engine.ctx = ctx;
  engine.ensure = () => ({ ctx, master: {} });
  await assert.rejects(engine.play(song), failure);
  assert.deepEqual(engine.getPlaybackState(), { playing: false, noteIndex: null });
});
