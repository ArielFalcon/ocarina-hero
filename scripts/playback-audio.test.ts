import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OcarinaEngine } from '../src/audio/engine';
import { pitchById } from '../src/core/pitches';

class Param {
  value = 0;
  events: string[] = [];
  timings: Array<[string, number, number]> = [];
  setValueAtTime(value: number, time: number) { this.events.push("set"); this.timings.push(["set", value, time]); } linearRampToValueAtTime(value: number, time: number) { this.events.push("linear"); this.timings.push(["linear", value, time]); } exponentialRampToValueAtTime(value: number, time: number) { this.events.push("exponential"); this.timings.push(["exponential", value, time]); }
  cancelScheduledValues() {} setTargetAtTime() {}
}
class Node {
  edges: Node[] = [];
  gain = new Param(); frequency = new Param(); delayTime = new Param();
  type = ''; buffer: unknown; loop = false; started = false;
  constructor(readonly kind: string) {}
  connect(node: Node) { this.edges.push(node); return node; }
  disconnect() { this.edges = []; }
  start() { this.started = true; } stop() {} addEventListener() {}
}
class Context {
  static last: Context;
  currentTime = 0; sampleRate = 100; state = 'running'; destination = new Node('destination');
  nodes: Node[] = [];
  constructor() { Context.last = this; }
  make(kind: string) { const node = new Node(kind); this.nodes.push(node); return node; }
  createGain() { return this.make('gain'); } createOscillator() { return this.make('oscillator'); }
  createDelay() { return this.make('delay'); } createBiquadFilter() { return this.make('filter'); }
  createBufferSource() { return this.make('buffer'); }
  createBuffer(_channels: number, length: number) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  resume() {}
}
function path(node: Node, destination: Node, seen = new Set<Node>()): Node[] | undefined {
  if (node === destination) return [node];
  if (seen.has(node)) return;
  seen.add(node);
  for (const next of node.edges) { const rest = path(next, destination, seen); if (rest) return [node, ...rest]; }
}

for (const mode of ['live', 'scheduled'] as const) test(`${mode} voice does not route a started buffer source to output`, async () => {
  const previousAudio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 1, clearInterval() {} } });
  try {
    const engine = new OcarinaEngine();
    if (mode === 'live') engine.noteOn(pitchById('D5'));
    else await engine.play({ title: '', tempoBpm: 120, notes: [{ pitch: 'D5', startBeat: 0, durationBeats: 1 }] });
    const ctx = Context.last;
    const paths = ctx.nodes.filter(n => n.kind === 'buffer' && n.started).map(n => path(n, ctx.destination)).filter(Boolean);
    assert.deepEqual(paths.map(p => p!.map(n => n.kind)), [], `${mode}: started buffer reaches output`);
  } finally {
    if (previousAudio) Object.defineProperty(globalThis, 'AudioContext', previousAudio); else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});


test('adjacent and bent scheduled notes set oscillator frequencies without ramps', async () => {
  const audio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const win = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 1, clearInterval() {} } });
  try {
    await new OcarinaEngine().play({ title: '', tempoBpm: 120, notes: [
      { pitch: 'D5', startBeat: 0, durationBeats: 1 },
      { pitch: 'A4', bend: -1, startBeat: 1, durationBeats: 1 },
    ] });
    const oscillators = Context.last.nodes.filter(node => node.kind === 'oscillator');
    assert.equal(oscillators.length, 6);
    for (const oscillator of oscillators) assert.deepEqual(oscillator.frequency.events, ['set']);
  } finally {
    if (audio) Object.defineProperty(globalThis, 'AudioContext', audio); else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (win) Object.defineProperty(globalThis, 'window', win); else Reflect.deleteProperty(globalThis, 'window');
  }
});


test('scheduled envelope reaches sustain by the end of short notes and retains the long envelope', async () => {
  const audio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const win = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 1, clearInterval() {} } });
  try {
    await new OcarinaEngine().play({ title: '', tempoBpm: 120, notes: [
      { pitch: 'A4', startBeat: 0, durationBeats: 0.196 },
      { pitch: 'D5', startBeat: 1, durationBeats: 0.278 },
      { pitch: 'A4', startBeat: 2, durationBeats: 1 },
    ] });
    const gains = Context.last.nodes.filter(node => node.kind === 'gain' && node.gain.timings.some(event => event[0] === 'exponential'));
    assert.equal(gains.length, 3);
    for (const [index, duration] of [0.098, 0.139, 0.5].entries()) {
      const events = gains[index]!.gain.timings;
      const attack = events.find(event => event[0] === 'linear' && event[1] === 0.85)!;
      const decay = events.find(event => event[0] === 'linear' && event[1] === 0.62)!;
      const start = [0.01, 0.51, 1.01][index]!;
      assert.ok(attack[2] <= start + duration + 1e-9);
      assert.ok(decay[2] <= start + duration + 1e-9);
      assert.ok(Math.abs(decay[2] - (start + Math.min(duration, 0.215))) < 1e-9);
      const release = events.find(event => event[0] === 'exponential')!;
      assert.ok(Math.abs(release[2] - (start + duration + 0.28)) < 1e-9);
    }
  } finally {
    if (audio) Object.defineProperty(globalThis, 'AudioContext', audio); else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (win) Object.defineProperty(globalThis, 'window', win); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('scheduled release clears a rapid preceding note without shortening a later isolated release', async () => {
  const audio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const win = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 1, clearInterval() {} } });
  try {
    await new OcarinaEngine().play({ title: '', tempoBpm: 120, notes: [
      { pitch: 'D4', startBeat: 0, durationBeats: 0.25 },
      { pitch: 'D5', startBeat: 0.25, durationBeats: 0.25 },
    ] });
    const releases = Context.last.nodes.filter(node => node.kind === 'gain')
      .flatMap(node => node.gain.timings.filter(event => event[0] === 'exponential'));
    assert.ok(Math.abs(releases[0]![2] - 0.14) < 1e-9);
    assert.ok(Math.abs(releases[1]![2] - 0.54) < 1e-9);
  } finally {
    if (audio) Object.defineProperty(globalThis, 'AudioContext', audio); else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (win) Object.defineProperty(globalThis, 'window', win); else Reflect.deleteProperty(globalThis, 'window');
  }
});
