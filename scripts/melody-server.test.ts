import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createMelodyPlugin, runModel, validatePcm, validOrigin } from '../server/melody.js';

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise<void>(resolve => setImmediate(resolve)); };
const track = (durationSeconds = 1) => JSON.stringify({ schemaVersion: 1, engine: { id: 'melodic-segnet', revision: '6d9d758f167d5fd2b56aa26da0618c4d451896b2', checkpointSha256: 'd56d10ede86aaf2053fca10047e0120ccb75b05f7e55f4dcaba90a0b2be159cb', decoder: 'segnet-basic-pitch-viterbi-v2', basicPitchSha256: '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec' }, sampleRate: 44100, durationSeconds, hopSeconds: 256 / 44100, frames: Array.from({ length: Math.ceil(durationSeconds * 44100 / 256) - 1 }, (_, i) => ({ timeSeconds: (i + 1) * 256 / 44100, frequencyHz: 440, modelScore: 0.5 })) });
function harness(pauseFile?: 'create' | 'write') {
  const server = Object.assign(new EventEmitter(), { close() { this.emit('close'); } }); let middleware: any; let callback: (() => void) | undefined;
  let starts = 0, kills = 0, removes = 0, writes = 0; let finish: (value: any) => void = () => {};
  let releaseFile = () => {}; const fileGate = new Promise<void>(resolve => { releaseFile = resolve; });
  const deps = {
    clock: { set: (fn: () => void) => { callback = fn; return 1; }, clear: () => { callback = undefined; } },
    files: { create: async () => { if (pauseFile === 'create') await fileGate; return '/temp/job'; }, write: async () => { writes++; if (pauseFile === 'write') await fileGate; }, remove: async () => { removes++; } },
    run: () => { starts++; return { result: new Promise((resolve) => { finish = resolve; }), kill: () => { kills++; } }; },
  };
  const plugin = createMelodyPlugin(deps as any) as any;
  plugin.configureServer({ httpServer: server, middlewares: { use: (_path: string, fn: any) => { middleware = fn; } } });
  function request(options: {end?: boolean; origin?: string; method?: string; type?: string; rate?: string; body?: Buffer} = {}) {
    const req: any = new PassThrough(); req.method = options.method ?? 'POST'; req.url = '/?sampleRate=' + (options.rate ?? '8000'); req.headers = { origin: options.origin ?? 'http://localhost:5173', host: 'localhost:5173', 'content-type': options.type ?? 'application/octet-stream' }; req.socket = {};
    let text = ''; const res: any = new Writable({ write(chunk, _encoding, next) { text += chunk.toString(); next(); } }); res.writeHead = (status: number) => { res.statusCode = status; return res; };
    const done = middleware(req, res); if (options.end !== false) req.end(options.body ?? Buffer.alloc(32000));
    return { req, res, done, body: () => text };
  }
  return { request, server, releaseFile, timeout: () => callback?.(), finish: (x: any) => finish(x), stats: () => ({ starts, kills, removes, writes }) };
}

test('input validation and origin enforce exact boundaries', () => {
  assert.equal(validatePcm(Buffer.alloc(4), 8000), true); assert.equal(validatePcm(Buffer.alloc(480004), 8000), false);
  assert.equal(validatePcm(Buffer.from([0, 0, 128, 127]), 8000), false); assert.equal(validatePcm(Buffer.alloc(3), 8000), false);
  assert.equal(validOrigin('http://localhost:5173', 'localhost:5173', false), true);
  assert.equal(validOrigin('https://example.ts.net', 'example.ts.net', false), true);
  assert.equal(validOrigin('https://example.ts.net.evil', 'example.ts.net', false), false);
  assert.equal(validOrigin('http://example.ts.net', 'example.ts.net', true), false);
  assert.equal(validOrigin('http://localhost:5173.evil', 'localhost:5173', false), false);
});
test('one active job returns busy and normal finish cleans once without killing', async () => {
  const h = harness(); const a = h.request(); await flush(); assert.equal(h.stats().starts, 1);
  const b = h.request(); await flush(); assert.equal(b.res.statusCode, 429); await b.done;
  h.finish({ stdout: track() }); await a.done; assert.equal(a.res.statusCode, 200); assert.deepEqual(h.stats(), { starts: 1, kills: 0, removes: 1, writes: 1 });
});
test('abort kills once, waits for process exit before unlocking and cleans once', async () => {
  const h = harness(); const a = h.request(); await flush(); a.req.emit('aborted'); a.res.emit('close');
  assert.equal(h.stats().kills, 1); const b = h.request(); await flush(); assert.equal(b.res.statusCode, 429); await b.done;
  h.finish({ error: 'killed' }); await a.done; assert.equal(h.stats().removes, 1);
  const c = h.request({ body: Buffer.alloc(4) }); await flush(); h.finish({ stdout: track(1 / 8000) }); await c.done; assert.notEqual(c.res.statusCode, 429);
});
test('deadline covers stalled upload without spawning, releases lock', async () => {
  const h = harness(); const a = h.request({ end: false }); h.timeout(); await a.done;
  assert.equal(a.res.statusCode, 504); assert.deepEqual(h.stats(), { starts: 0, kills: 0, removes: 0, writes: 0 });
  const b = h.request(); await flush(); assert.equal(h.stats().starts, 1); h.finish({ stdout: track() }); await b.done; assert.equal(b.res.statusCode, 200);
});
test('timeout and shutdown kill active process once and clean after exit', async () => {
  for (const action of ['timeout', 'shutdown']) {
    const h = harness(); const a = h.request(); await flush();
    if (action === 'timeout') h.timeout(); else h.server.close();
    a.res.emit('close'); assert.equal(h.stats().kills, 1); assert.equal(h.stats().removes, 0);
    h.finish({ error: 'killed' }); await a.done; assert.equal(h.stats().removes, 1);
    assert.equal(a.res.statusCode, action === 'timeout' ? 504 : 503);
  }
});
test('aborted upload never spawns or creates files', async () => {
  const h = harness(); const a = h.request({ end: false }); a.req.emit('aborted'); await a.done;
  assert.deepEqual(h.stats(), { starts: 0, kills: 0, removes: 0, writes: 0 });
});
test('process failures and malformed, oversized, or invalid scores reject and clean', async () => {
  const invalidScore = JSON.parse(track()); invalidScore.frames[0].modelScore = 1.1;
  for (const [result, status] of [[{ error: 'failed' }, 500], [{ stdout: '{' }, 502], [{ oversized: true }, 502], [{ stdout: 'x'.repeat(8 * 1024 * 1024 + 1) }, 502], [{ stdout: JSON.stringify(invalidScore) }, 502]] as const) {
    const h = harness(); const a = h.request(); await flush(); h.finish(result); await a.done;
    assert.equal(a.res.statusCode, status); assert.equal(h.stats().removes, 1); assert.equal(h.stats().kills, 0);
  }
});
test('accepts current decoder output and rejects output from a stale or different decoder', async () => {
  const stale = JSON.parse(track()); delete stale.engine.decoder; delete stale.engine.basicPitchSha256;
  const otherModel = JSON.parse(track()); otherModel.engine.basicPitchSha256 = 'b'.repeat(64);
  for (const [stdout, status] of [[track(), 200], [JSON.stringify(stale), 502], [JSON.stringify(otherModel), 502]] as const) {
    const h = harness(); const a = h.request(); await flush(); h.finish({ stdout }); await a.done;
    assert.equal(a.res.statusCode, status);
  }
});
test('requests reject invalid headers, sample rates and PCM without starting jobs', async () => {
  const h = harness();
  for (const options of [{ origin: 'http://evil.test' }, { method: 'GET' }, { rate: '7999' }, { rate: '8000&sampleRate=8000' }, { type: 'text/plain' }, { body: Buffer.from([0, 0, 128, 127]) }, { body: Buffer.alloc(0) }, { body: Buffer.alloc(3) }, { body: Buffer.alloc(480004) }]) {
    const a = h.request(options); await a.done; assert.ok(a.res.statusCode >= 400);
  }
  assert.equal(h.stats().starts, 0);
});

test('real process adapter bounds stdout and stderr and waits for close', async () => {
  for (const stream of ['stdout', 'stderr'] as const) {
    const child: any = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); let kills = 0; child.kill = () => { kills++; };
    let options: any; const job = runModel('/temp/audio.f32', 8000, ((_command: string, _args: string[], opts: any) => { options = opts; return child; }) as any);
    child[stream].write(Buffer.alloc(stream === 'stdout' ? 8 * 1024 * 1024 + 1 : 65537));
    assert.equal(kills, 1); assert.equal(options.shell, false); child.emit('close', null);
    assert.deepEqual(await job.result, { oversized: true }); job.kill(); assert.equal(kills, 1);
  }
});
test('real process adapter reports spawn errors only after close', async () => {
  const child: any = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
  const job = runModel('/temp/audio.f32', 8000, (() => child) as any);
  child.emit('error', new Error('missing runtime')); child.emit('close', -1);
  assert.match((await job.result).error!, /missing runtime/);
});
test('shutdown releases a stalled upload and tolerates its later stream error', async () => {
  const h = harness(); const a = h.request({ end: false }); h.server.close(); await a.done;
  assert.equal(a.res.statusCode, 503); assert.equal(h.stats().starts, 0);
  a.req.emit('error', new Error('connection reset')); a.req.emit('close');
  assert.equal(a.req.listenerCount('error'), 0);
});

test('cancellation during temporary file creation or writing removes it once without spawning', async () => {
  for (const phase of ['create', 'write'] as const) {
    const h = harness(phase); const a = h.request(); await flush(); a.req.emit('aborted');
    const b = h.request(); await flush(); assert.equal(b.res.statusCode, 429);
    h.releaseFile(); await a.done; assert.equal(h.stats().starts, 0); assert.equal(h.stats().kills, 0); assert.equal(h.stats().removes, 1);
  }
});

test('maximum rate permits fifteen seconds but rejects one extra sample before spawn', async () => {
  assert.equal(validatePcm(Buffer.alloc(192000 * 15 * 4), 192000), true);
  assert.equal(validatePcm(Buffer.alloc(192000 * 15 * 4 + 4), 192000), false);
  const h = harness(); const a = h.request({ rate: '192000', body: Buffer.alloc(192000 * 15 * 4 + 4) });
  await a.done; assert.ok(a.res.statusCode >= 400); assert.equal(h.stats().starts, 0);
  const b = h.request({ rate: '192000', body: Buffer.alloc(192000 * 15 * 4) });
  await flush(); assert.equal(h.stats().starts, 1); h.finish({ stdout: track(15) }); await b.done; assert.equal(b.res.statusCode, 200);
});
