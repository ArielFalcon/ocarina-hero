import assert from 'node:assert/strict';
import test from 'node:test';
import { BROWSE_POINTS, createListenClock, createSupportMeter, LISTEN_MS, LISTEN_POINTS, readSupportSession, type SupportSession } from '../src/ui/support-meter';

/** A meter over an in-memory session; `asks` counts how often the tip card was asked for. */
function setup(options: { random?: number; saved?: SupportSession | null; suppressed?: boolean } = {}) {
  let saved: SupportSession | null = options.saved ?? null;
  let asks = 0;
  const meter = createSupportMeter({
    load: () => saved,
    save: session => { saved = structuredClone(session); },
    random: () => options.random ?? 0,
    suppressed: () => options.suppressed ?? false,
    ask: () => { asks += 1; },
  });
  return { meter, asks: () => asks, saved: () => saved };
}

test('the threshold is drawn once per session among 3, 3.5 and 4 points and kept', () => {
  assert.equal(setup({ random: 0 }).meter.threshold(), 3);
  assert.equal(setup({ random: 0.5 }).meter.threshold(), 3.5);
  assert.equal(setup({ random: 0.999 }).meter.threshold(), 4);
  const first = setup({ random: 0.999 });
  first.meter.credit('a', BROWSE_POINTS);
  const reopened = setup({ random: 0, saved: first.saved() });
  assert.equal(reopened.meter.threshold(), 4, 'a reload in the same session keeps its threshold');
});

test('each song scores once, at its highest value: a listen is 1 point, a visit or a preview 0.5', () => {
  const { meter, asks } = setup({ random: 0 });
  meter.credit('a', BROWSE_POINTS);
  meter.credit('a', LISTEN_POINTS);
  meter.credit('a', BROWSE_POINTS);
  meter.credit('b', LISTEN_POINTS);
  assert.equal(meter.points(), 2, 'visit then listen on a counts 1, not 1.5');
  meter.credit('c', BROWSE_POINTS);
  assert.equal(asks(), 0, 'below the threshold of 3');
  meter.credit('c', LISTEN_POINTS);
  assert.equal(asks(), 1, 'the third listened song reaches 3');
});

test('the card is asked for exactly once per session, even across reloads', () => {
  const first = setup({ random: 0 });
  for (const song of ['a', 'b', 'c', 'd']) first.meter.credit(song, LISTEN_POINTS);
  assert.equal(first.asks(), 1);
  const reopened = setup({ saved: first.saved() });
  reopened.meter.credit('e', LISTEN_POINTS);
  assert.equal(reopened.asks(), 0, 'already asked this session');
  assert.equal(first.saved()?.asked, true, 'asked is saved before the card shows');
});

test('a confirmed supporter is never asked', () => {
  const { meter, asks } = setup({ suppressed: true });
  for (const song of ['a', 'b', 'c', 'd', 'e']) meter.credit(song, LISTEN_POINTS);
  assert.equal(asks(), 0);
});

test('unreadable stored sessions start fresh', () => {
  assert.equal(readSupportSession(null), null);
  assert.equal(readSupportSession({ threshold: 9, points: {}, asked: false }), null, 'a threshold outside 3 to 4');
  assert.equal(readSupportSession({ threshold: 3, points: { a: 2 }, asked: false }), null, 'a song worth more than a listen');
  assert.equal(readSupportSession({ threshold: 3, points: [], asked: false }), null);
  assert.deepEqual(readSupportSession({ threshold: 3.5, points: { a: 0.5 }, asked: true }), { threshold: 3.5, points: { a: 0.5 }, asked: true });
});

/** A listen clock on a fake timer; `listens` records each song and source that reached a listen. */
function clock() {
  let now = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  let next = 1;
  const listens: string[] = [];
  const listen = createListenClock({
    now: () => now,
    setTimer: (run, ms) => { const id = next++; timers.set(id, { at: now + ms, run }); return id; },
    clearTimer: id => { timers.delete(id); },
    heard: (song, source) => { listens.push(`${source}:${song}`); },
  });
  const advance = (ms: number) => {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); }
  };
  return { listen, advance, listens };
}

test(`a song is heard after ${LISTEN_MS / 1000} s of playback, summed across pauses, once per source`, () => {
  const { listen, advance, listens } = clock();
  listen.playing('lesson', 'a', true);
  advance(6_000);
  listen.playing('lesson', 'a', false);
  advance(60_000);
  assert.deepEqual(listens, [], 'paused time does not count');
  listen.playing('lesson', 'a', true);
  advance(3_999);
  assert.deepEqual(listens, []);
  advance(1);
  assert.deepEqual(listens, ['lesson:a']);
  listen.playing('lesson', 'a', false);
  listen.playing('lesson', 'a', true);
  advance(LISTEN_MS);
  assert.deepEqual(listens, ['lesson:a'], 'heard once');
});

test('switching song or source keeps each count apart', () => {
  const { listen, advance, listens } = clock();
  listen.playing('preview', 'a', true);
  advance(8_000);
  listen.playing('preview', 'b', true);
  advance(8_000);
  assert.deepEqual(listens, [], 'a stopped at 8 s when b started');
  listen.playing('preview', 'b', false);
  listen.playing('lesson', 'a', true);
  advance(2_000);
  assert.deepEqual(listens, [], 'the lesson does not inherit the preview time');
  advance(LISTEN_MS - 2_000);
  assert.deepEqual(listens, ['lesson:a']);
  listen.playing('preview', 'b', true);
  advance(2_000);
  assert.deepEqual(listens, ['lesson:a', 'preview:b'], 'b resumes from its own 8 s');
});
