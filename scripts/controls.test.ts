import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Controls } from '../src/ui/input';

test('latest note owns the voice and superseded releases do nothing', () => {
  const events: unknown[] = [];
  const c = new Controls((...args) => events.push(args), () => events.push('off'), (...args) => events.push(args));
  c.noteDown('keyboard:a', 'Y'); c.noteDown('touch:1', 'X'); c.noteUp('keyboard:a');
  assert.deepEqual(events, [['Y', 0], ['X', 0]]);
  c.noteUp('touch:1'); c.noteDown('mouse:1', 'L'); c.reset(); c.noteUp('mouse:1');
  assert.deepEqual(events, [['Y', 0], ['X', 0], 'off', ['L', 0], 'off']);
});

test('live note handoff reuses the voice and preserves the bend', async () => {
  const { OcarinaEngine } = await import('../src/audio/engine');
  const { pitchForButton, frequencyOf } = await import('../src/core/pitches');
  const engine = new OcarinaEngine() as any;
  const targets: number[] = [];
  const param = () => ({ cancelScheduledValues() {}, setValueAtTime(v: number) { targets.push(v); } });
  const ctx = { currentTime: 0 };
  let voices = 0;
  engine.ensure = () => ({ ctx, master: {} });
  engine.createVoice = () => { voices++; return { ctx, fundamental: {frequency: param()}, overtone: {frequency: param()}, third: {frequency: param()} }; };
  engine.noteOn(pitchForButton('Y'), 1);
  engine.noteOn(pitchForButton('X'), 1);
  assert.equal(voices, 1);
  assert.equal(targets[0], frequencyOf(pitchForButton('X').id, 1));
});

test('modifier transitions restore held values with the released modifier policy in either order', () => {
  for (const value of [1, 2]) for (const modifierFirst of [true, false]) {
    const events: unknown[] = [];
    const c = new Controls((...args) => events.push(['on', ...args]), () => events.push('off'), (...args) => events.push(['bend', ...args]));
    if (modifierFirst) c.bendDown('a', value);
    c.noteDown('n', 'Y');
    if (!modifierFirst) c.bendDown('a', value);
    c.bendDown('b', -value); c.bendDown('c', value); c.bendUp('b'); c.bendUp('c'); c.bendUp('a');
    const bends = events.filter((x: any) => x[0] === 'bend');
    assert.deepEqual(bends, [['bend',value,value === 2 ? .09 : 0], ['bend',-value,value === 2 ? .09 : 0], ['bend',value,value === 2 ? .09 : 0], ['bend',0,value === 2 ? .09 : 0]]);
    c.reset();
  }
});

test('reset clears held modifiers and ownership for the next gesture', () => {
  const events: unknown[] = [];
  const c = new Controls((...args) => events.push(['on', ...args]), () => events.push('off'), (...args) => events.push(['bend', ...args]));
  c.bendDown('arrow', 2); c.noteDown('note', 'Y'); c.reset();
  c.bendUp('arrow'); c.noteUp('note'); c.noteDown('next', 'X');
  assert.deepEqual(events, [['bend', 2, .09], ['on', 'Y', 2], 'off', ['bend', 0, 0], ['on', 'X', 0]]);
});
