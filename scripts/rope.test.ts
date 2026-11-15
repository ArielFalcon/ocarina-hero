import assert from 'node:assert/strict';
import test from 'node:test';
import { advance, breaks, clearGone, dropIn, fall, fallFrom, goneThisSession, heldAt, markGone, restY, settle, type Rope } from '../src/ui/rope';

const CONFIG = { length: 70 };
const FRAME = 1 / 60;

function run(rope: Rope, seconds: number, onFrame?: () => void): number {
  let slept = -1;
  for (let t = 0; t < seconds; t += FRAME) {
    advance(rope, CONFIG, FRAME);
    onFrame?.();
    if (slept < 0 && settle(rope, CONFIG)) slept = t;
  }
  return slept;
}

test('the drop comes from above the screen, is caught by the cord, and the loop can sleep soon after', () => {
  const rope = dropIn(150);
  let top = rope.y;
  let caught = -1;
  const slept = run(rope, 8, () => { if (caught < 0 && rope.taut) caught = rope.y; top = Math.max(top, rope.y); });
  assert.ok(rope.y === restY(CONFIG) && rope.x === 0, 'hangs straight below the pivot');
  assert.ok(caught >= 0 && caught <= CONFIG.length * 1.2, 'the cord catches it near its own length, not a screen lower');
  assert.ok(top > restY(CONFIG), 'the catch overshoots and bounces');
  assert.ok(slept > 0 && slept < 7, `the swing dies out and the frame loop stops (slept at ${slept})`);
});

test('once the cord catches the drop it bounces on the elastic cord but never falls far past its length', () => {
  const rope = dropIn(150);
  let lowest = 0;
  run(rope, 4, () => { if (rope.taut) lowest = Math.max(lowest, Math.hypot(rope.x, rope.y)); });
  assert.ok(lowest < CONFIG.length * 1.7, `deepest reach ${lowest.toFixed(1)}`);
});

test('a figure pulled aside swings back across the middle and settles hanging straight', () => {
  const rope: Rope = { x: CONFIG.length, y: 0, vx: 0, vy: 0, taut: true };
  let crossed = false;
  const slept = run(rope, 12, () => { if (rope.x < -5) crossed = true; });
  assert.ok(crossed, 'swings past the vertical to the other side');
  assert.ok(slept > 0, 'sleeps');
  assert.equal(rope.x, 0);
});

test('a hand pulling beyond the cord stretches it, giving most of the pull but not all of it', () => {
  const held = heldAt({ x: 0, y: CONFIG.length * 2.4 }, CONFIG);
  assert.ok(held.y > CONFIG.length && held.y < CONFIG.length * 2.4);
  assert.deepEqual(heldAt({ x: 30, y: 40 }, CONFIG), { x: 30, y: 40 });
});

test('the cord snaps only for a hard pull downwards', () => {
  assert.equal(breaks({ x: 0, y: CONFIG.length * 3 }, CONFIG), true);
  assert.equal(breaks({ x: 0, y: CONFIG.length * 2.6 }, CONFIG), false, 'not far enough');
  assert.equal(breaks({ x: CONFIG.length * 3.5, y: 0 }, CONFIG), false, 'the same distance sideways only swings it');
  assert.equal(breaks({ x: 0, y: -CONFIG.length * 3.5 }, CONFIG), false, 'pulling up does not count');
});

test('a snapped figure keeps its speed, accelerates downwards and tumbles', () => {
  const state = fallFrom({ x: 10, y: 100, vx: 120, vy: 50 });
  for (let i = 0; i < 30; i++) fall(state, FRAME);
  assert.ok(state.vy > 50 && state.y > 100 && state.x > 10 && state.turn > 0);
});

test('removal lasts the session and tolerates storage that throws', () => {
  const map = new Map<string, string>();
  const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), removeItem: (key: string) => void map.delete(key) };
  assert.equal(goneThisSession(storage), false);
  markGone(storage);
  assert.equal(goneThisSession(storage), true);
  clearGone(storage);
  assert.equal(goneThisSession(storage), false);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(goneThisSession(broken), false);
  assert.doesNotThrow(() => markGone(broken));
});
