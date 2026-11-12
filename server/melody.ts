import audioLimits from '../src/core/audio-limits.json';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { parseModelPitchTrack } from '../src/core/melody-analysis';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY = 192000 * audioLimits.maxDurationSeconds * 4;
const MAX_OUTPUT = 8 * 1024 * 1024;
const MAX_STDERR = 64 * 1024;
const REVISION = '6d9d758f167d5fd2b56aa26da0618c4d451896b2';
const CHECKPOINT = 'd56d10ede86aaf2053fca10047e0120ccb75b05f7e55f4dcaba90a0b2be159cb';
const DECODER = 'segnet-basic-pitch-viterbi-v2';
const BASIC_PITCH = '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec';
export function validatePcm(data: Buffer, rate: number): boolean {
  if (!Number.isInteger(rate) || rate < 8000 || rate > 192000 || !data.length || data.length % 4 || data.length > MAX_BODY || data.length / 4 > rate * audioLimits.maxDurationSeconds) return false;
  for (let i = 0; i < data.length; i += 4) if (!Number.isFinite(data.readFloatLE(i))) return false;
  return true;
}
export function validOrigin(origin: string | undefined, host: string | undefined, secure: boolean): boolean {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return url.origin === origin && url.host === host
      && (url.protocol === 'https:' || (!secure && url.protocol === 'http:'));
  } catch { return false; }
}
type Result = { stdout?: string; error?: string; oversized?: boolean };
type Running = { result: Promise<Result>; kill: () => void };
type Deps = {
  run: (input: string, rate: number) => Running;
  files: { create: () => Promise<string>; write: (path: string, data: Buffer) => Promise<void>; remove: (path: string) => Promise<void> };
  clock: { set: (fn: () => void, ms: number) => unknown; clear: (timer: any) => void };
};
export function runModel(input: string, rate: number, spawnProcess: typeof spawn = spawn): Running {
  const child = spawnProcess(join(root, '.runtime-melody', 'venv', 'bin', 'python'), [join(root, 'scripts', 'melody-inference.py'), '--input', input, '--sample-rate', String(rate)], { shell: false, env: { ...process.env, OMP_NUM_THREADS: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let killed = false;
  const kill = () => { if (!killed) { killed = true; child.kill('SIGKILL'); } };
  const result = new Promise<Result>(resolveResult => {
    const stdout: Buffer[] = [], stderr: Buffer[] = []; let outBytes = 0, errBytes = 0, oversized = false, error = '';
    child.stdout.on('data', (chunk: Buffer) => { outBytes += chunk.length; if (outBytes > MAX_OUTPUT) { oversized = true; kill(); } else stdout.push(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { errBytes += chunk.length; if (errBytes > MAX_STDERR) { oversized = true; kill(); } else stderr.push(chunk); });
    child.on('error', err => { error = err.message; });
    child.on('close', code => resolveResult(oversized ? { oversized: true } : code === 0 && !error ? { stdout: Buffer.concat(stdout).toString('utf8') } : { error: error || Buffer.concat(stderr).toString('utf8') || `Process exited with code ${code}` }));
  });
  return { result, kill };
}
const defaults: Deps = {
  run: runModel,
  files: { create: () => mkdtemp(join(tmpdir(), 'melody-')), write: writeFile, remove: path => rm(path, { recursive: true, force: true }) },
  clock: { set: (fn, ms) => setTimeout(fn, ms), clear: timer => clearTimeout(timer) },
};
function validOutput(value: unknown, duration: number, count: number): boolean {
  try {
    const v = parseModelPitchTrack(value);
    return v.engine.revision === REVISION && v.engine.checkpointSha256 === CHECKPOINT && v.engine.decoder === DECODER && v.engine.basicPitchSha256 === BASIC_PITCH && v.durationSeconds === duration && v.hopSeconds === 256 / 44100 && v.frames.length === count && v.frames.every((f, i) => Math.abs(f.timeSeconds - (i + 1) * v.hopSeconds) < 1e-9 && f.timeSeconds < duration);
  } catch { return false; }
}
export function createMelodyPlugin(deps: Deps = defaults): Plugin {
  let busy = false;
  let cancel: (() => void) | undefined;
  const install = (server: any) => {
    if (server.httpServer) {
      const httpServer = server.httpServer;
      const originalClose = httpServer.close;
      httpServer.close = function (...args: unknown[]) { cancel?.(); return originalClose.apply(this, args); };
      httpServer.once('close', () => { cancel?.(); httpServer.close = originalClose; });
    }
    server.middlewares.use('/api/melody', async (req: IncomingMessage, res: ServerResponse) => {
      const send = (status: number, message: unknown) => { if (!res.destroyed && !res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(message)); } };
      if (req.method !== 'POST') return send(405, { error: 'POST required' });
      if (!validOrigin(req.headers.origin, req.headers.host, !!(req.socket as any).encrypted)) return send(403, { error: 'Same origin required' });
      const url = new URL(req.url || '/', 'http://localhost');
      const rates = url.searchParams.getAll('sampleRate'); const rateText = rates[0]; const rate = Number(rateText);
      if (rates.length !== 1 || !/^\d+$/.test(rateText) || !Number.isInteger(rate) || rate < 8000 || rate > 192000 || req.headers['content-type'] !== 'application/octet-stream') return send(400, { error: 'Invalid sample rate or content type' });
      if (busy) return send(429, { error: 'Melody inference is busy' });
      busy = true;
      let dir: string | undefined, running: Running | undefined, stopped = false, timedOut = false;
      let rejectBody: ((error: Error) => void) | undefined;
      const stop = () => { if (stopped) return; stopped = true; rejectBody?.(new Error('Request cancelled')); running?.kill(); };
      const aborted = () => stop();
      const closed = () => { if (!res.writableEnded) stop(); };
      const shutdown = () => { stop(); send(503, { error: 'Melody server shutting down' }); };
      cancel = shutdown;
      const ignoreRequestError = () => {};
      req.on('error', ignoreRequestError);
      req.once('close', () => req.removeListener('error', ignoreRequestError));
      req.once('aborted', aborted); res.once('close', closed);
      const timer = deps.clock.set(() => { timedOut = true; stop(); send(504, { error: 'Melody inference timed out' }); }, 60000);
      try {
        const data = await new Promise<Buffer>((accept, reject) => {
          const chunks: Buffer[] = []; let size = 0;
          const cleanup = () => { req.removeListener('data', onData); req.removeListener('end', onEnd); req.removeListener('error', onError); rejectBody = undefined; };
          const fail = (error: Error) => { cleanup(); req.resume(); reject(error); };
          const onData = (chunk: Buffer) => { size += chunk.length; if (size > MAX_BODY || size > rate * audioLimits.maxDurationSeconds * 4) fail(new Error('Audio too large')); else chunks.push(chunk); };
          const onEnd = () => { cleanup(); accept(Buffer.concat(chunks)); };
          const onError = (error: Error) => fail(error);
          rejectBody = fail;
          req.on('data', onData); req.once('end', onEnd); req.once('error', onError);
        });
        rejectBody = undefined;
        if (stopped) return;
        if (!validatePcm(data, rate)) return send(400, { error: 'Invalid mono float32 PCM' });
        dir = await deps.files.create(); if (stopped) return;
        const input = join(dir, 'audio.f32'); await deps.files.write(input, data); if (stopped) return;
        running = deps.run(input, rate);
        const result = await running.result;
        running = undefined;
        if (stopped) return;
        if (result.oversized || (result.stdout && Buffer.byteLength(result.stdout) > MAX_OUTPUT)) return send(502, { error: 'Inference output too large' });
        if (result.error || result.stdout === undefined) return send(500, { error: `Melody inference failed. Run python3 scripts/setup-melody.py. ${(result.error || 'Unknown error').slice(0, 1024)}` });
        let value: unknown; try { value = JSON.parse(result.stdout); } catch { return send(502, { error: 'Malformed inference output' }); }
        if (!validOutput(value, data.length / 4 / rate, Math.max(0, Math.ceil((data.length / 4) * 44100 / (rate * 256)) - 1))) return send(502, { error: 'Invalid inference output' });
        send(200, value);
      } catch (error) { if (!stopped) send(String(error).includes('Audio too large') ? 413 : 500, { error: String(error) }); else if (timedOut) send(504, { error: 'Melody inference timed out' }); }
      finally { deps.clock.clear(timer); req.removeListener('aborted', aborted); res.removeListener('close', closed); try { if (dir) await deps.files.remove(dir); } finally { busy = false; if (cancel === shutdown) cancel = undefined; } }
    });
  };
  return { name: 'local-melody', configureServer: install, configurePreviewServer: install };
}
