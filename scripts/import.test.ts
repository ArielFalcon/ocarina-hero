import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SourceImporter } from '../src/ui/import';

test('invalidation prevents stale decode errors and closes the context', async () => {
  let reject!: (e: Error) => void;
  let closed = 0;
  const messages: string[] = [];
  const sources: unknown[] = [];
  const importer = new SourceImporter({ onSource: x => sources.push(x), onStatus: x => messages.push(x) }, {
    createContext: () => ({ decodeAudioData: () => new Promise((_, r) => { reject = r; }), close: async () => { closed++; } }),
  });
  const pending = importer.load({ name: 'old.wav', arrayBuffer: async () => new ArrayBuffer(0) } as File, 'isolated');
  await Promise.resolve();
  importer.invalidate();
  const count = messages.length;
  reject(new Error('bad'));
  await pending;
  assert.equal(messages.length, count);
  assert.equal(sources.length, 0);
  assert.equal(closed, 1);
});

test('mixes every channel, caps the clip and posts little-endian PCM at the actual rate', async () => {
  let request: { url: string; init: RequestInit } | undefined;
  const messages: string[] = [];
  const channels = [new Float32Array(40).fill(0.3), new Float32Array(40).fill(0.6), new Float32Array(40).fill(0.9)];
  const buffer = { length: 40, sampleRate: 2, numberOfChannels: 3, getChannelData: (i: number) => channels[i]! } as AudioBuffer;
  const importer = new SourceImporter({ onSource: () => assert.fail('silent track must not create a source'), onStatus: x => messages.push(x) }, {
    createContext: () => ({ decodeAudioData: async () => buffer, close: async () => {} }),
    fetch: async (input, init) => {
      request = { url: String(input), init: init! };
      return new Response(JSON.stringify({ schemaVersion: 1, engine: { id: 'melodic-segnet', revision: 'a', checkpointSha256: 'a'.repeat(64) }, sampleRate: 44100, durationSeconds: 15, hopSeconds: 1, frames: [] }));
    },
  });
  await importer.load({ name: 'test.wav', arrayBuffer: async () => new ArrayBuffer(0) } as File, 'main-melody');
  assert.equal(request!.url, '/api/melody?sampleRate=2');
  assert.equal((request!.init.body as ArrayBuffer).byteLength, 120);
  for (let i = 0; i < 30; i++) assert.ok(Math.abs(new DataView(request!.init.body as ArrayBuffer).getFloat32(i * 4, true) - 0.6) < 1e-6);
  assert.match(messages.at(-1)!, /No melody found/);
});

test('aborts an old model request once and suppresses its later error', async () => {
  let reject!: (error: Error) => void;
  let aborts = 0;
  const messages: string[] = [];
  const buffer = { length: 10, sampleRate: 10, numberOfChannels: 1, getChannelData: () => new Float32Array(10) } as AudioBuffer;
  const importer = new SourceImporter({ onSource: () => assert.fail('stale source'), onStatus: x => messages.push(x) }, {
    createContext: () => ({ decodeAudioData: async () => buffer, close: async () => {} }),
    fetch: async (_, init) => new Promise((_, r) => { reject = r; init!.signal!.addEventListener('abort', () => aborts++); }),
  });
  const pending = importer.load({ name: 'test.wav', arrayBuffer: async () => new ArrayBuffer(0) } as File, 'main-melody');
  while (!reject) await Promise.resolve();
  importer.invalidate();
  importer.invalidate();
  const count = messages.length;
  reject(new Error('aborted'));
  await pending;
  assert.equal(aborts, 1);
  assert.equal(messages.length, count);
});

test('distinguishes model errors from decode errors', async () => {
  const messages: string[] = [];
  const buffer = { length: 10, sampleRate: 10, numberOfChannels: 1, getChannelData: () => new Float32Array(10) } as AudioBuffer;
  const importer = new SourceImporter({ onSource: () => assert.fail(), onStatus: x => messages.push(x) }, {
    createContext: () => ({ decodeAudioData: async () => buffer, close: async () => {} }),
    fetch: async () => new Response(JSON.stringify({ error: 'model missing' }), { status: 503 }),
  });
  await importer.load({ name: 'test.wav', arrayBuffer: async () => new ArrayBuffer(0) } as File, 'main-melody');
  assert.match(messages.at(-1)!, /Melody analysis failed: model missing/);
});

test('a newer audio import wins over an earlier decode success', async () => {
  let resolve!: (buffer: AudioBuffer) => void;
  let calls = 0;
  const sources: string[] = [];
  const buffer = { length: 10, sampleRate: 10, numberOfChannels: 1, getChannelData: () => new Float32Array(10) } as AudioBuffer;
  const importer = new SourceImporter({ onSource: x => sources.push(x.title), onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => ++calls === 1 ? new Promise(r => { resolve = r; }) : buffer, close: async () => {} }),
    transcribe: () => ({ notes: [{ midi: 60, startBeat: 0.25, durationBeats: 0.5 }], tempoBpm: 60, quality: 0.5 }),
  });
  const file = (name: string) => ({ name, arrayBuffer: async () => new ArrayBuffer(0) } as File);
  const old = importer.load(file('old.wav'), 'isolated');
  while (!resolve) await Promise.resolve();
  await importer.load(file('new.wav'), 'isolated');
  resolve(buffer);
  await old;
  assert.deepEqual(sources, ['new.wav']);
});

// Standard MIDI: eight quarter notes in a single track.
const midiBytes = Uint8Array.from([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0,
  0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 76,
  ...Array.from({ length: 8 }, (_, i) => [0, 0x90, 60 + i, 100, 0x83, 0x60, 0x80, 60 + i, 0]).flat(),
  0, 0xff, 0x2f, 0,
]).buffer;
const oneSecond = { length: 10, sampleRate: 10, numberOfChannels: 1, getChannelData: () => new Float32Array(10) } as AudioBuffer;
const syntheticTrack = {
  schemaVersion: 1, engine: { id: 'melodic-segnet', revision: 'rev', checkpointSha256: 'a'.repeat(64) },
  sampleRate: 44100, durationSeconds: 1, hopSeconds: 0.01,
  frames: [
    { timeSeconds: 0.1, frequencyHz: 440, modelScore: 0.2 },
    { timeSeconds: 0.11, frequencyHz: 0, modelScore: 0.1 },
    { timeSeconds: 0.12, frequencyHz: 660, modelScore: 0.8 },
  ],
};
const fakeFile = (name: string, read: () => Promise<ArrayBuffer> = async () => new ArrayBuffer(0)) => ({ name, arrayBuffer: read } as File);

test('pending state belongs to the newest job and ends before publishing its source', async () => {
  let resolveOld!: (bytes: ArrayBuffer) => void;
  let resolveNew!: (bytes: ArrayBuffer) => void;
  const publishedPending: boolean[] = [];
  const importer = new SourceImporter({
    onSource: () => publishedPending.push(importer.pending), onStatus: () => {},
  });
  const old = importer.load(fakeFile('old.mid', () => new Promise(r => { resolveOld = r; })), 'isolated');
  assert.equal(importer.pending, true);
  const next = importer.load(fakeFile('new.mid', () => new Promise(r => { resolveNew = r; })), 'isolated');
  resolveOld(midiBytes.slice(0));
  await old;
  assert.equal(importer.pending, true);
  resolveNew(midiBytes.slice(0));
  await next;
  assert.deepEqual(publishedPending, [false]);
  assert.equal(importer.pending, false);
});

test('a MIDI import supersedes a pending model success or error without stale callbacks', async () => {
  for (const outcome of ['success', 'error'] as const) {
    let resolve!: (response: Response) => void;
    let reject!: (error: Error) => void;
    let aborts = 0;
    const callbacks: string[] = [];
    const importer = new SourceImporter({ onSource: source => callbacks.push(`source:${source.title}`), onStatus: status => callbacks.push(`status:${status}`) }, {
      createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
      fetch: async (_, init) => new Promise((yes, no) => {
        resolve = yes; reject = no;
        init!.signal!.addEventListener('abort', () => aborts++);
      }),
    });
    const old = importer.load(fakeFile('old.wav'), 'main-melody');
    while (!resolve) await Promise.resolve();
    await importer.load(fakeFile('new.mid', async () => midiBytes.slice(0)), 'isolated');
    assert.equal(aborts, 1);
    assert.equal(callbacks.at(-1), 'source:new.mid');
    const before = [...callbacks];
    if (outcome === 'success') resolve(new Response(JSON.stringify(syntheticTrack)));
    else reject(new Error('aborted old request'));
    await old;
    assert.deepEqual(callbacks, before);
  }
});

test('a newer audio source supersedes a pending MIDI read', async () => {
  let resolve!: (bytes: ArrayBuffer) => void;
  const callbacks: string[] = [];
  const importer = new SourceImporter({ onSource: source => callbacks.push(`source:${source.title}`), onStatus: status => callbacks.push(`status:${status}`) }, {
    createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
    transcribe: () => ({ notes: [{ midi: 64, startBeat: 0.2, durationBeats: 0.3 }], tempoBpm: 60, quality: 0.5 }),
  });
  const old = importer.load(fakeFile('old.mid', () => new Promise(r => { resolve = r; })), 'isolated');
  await importer.load(fakeFile('new.wav'), 'isolated');
  assert.equal(callbacks.at(-1), 'source:new.wav');
  const before = [...callbacks];
  resolve(midiBytes.slice(0));
  await old;
  assert.deepEqual(callbacks, before);
});

test('model source preserves short candidates and their timing before projection', async () => {
  let source: import('../src/ui/import').ImportedSource | undefined;
  const importer = new SourceImporter({ onSource: value => { source = value; }, onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
    fetch: async () => new Response(JSON.stringify(syntheticTrack)),
  });
  await importer.load(fakeFile('model.wav'), 'main-melody');
  assert.ok(source);
  assert.equal(source.preserveTiming, true);
  assert.deepEqual(source.melody.map(note => note.midi), [69, 76]);
  assert.ok(Math.abs(source.melody[0]!.startBeat - 0.095) < 1e-12);
  assert.ok(Math.abs(source.melody[1]!.startBeat - 0.115) < 1e-12);
  assert.ok(source.melody.every(note => Math.abs(note.durationBeats - 0.01) < 1e-12));
  const analysis = source.analysis!;
  assert.ok('events' in analysis);
  assert.deepEqual(analysis.events.map(event => event.insufficientSupport), [true, true]);
  assert.deepEqual(analysis.contour, syntheticTrack.frames);
  assert.equal(analysis.voicedFrameFraction, 2 / 3);
  assert.match(source.subtitle, /67% voiced frames/);
  assert.match(source.subtitle, /insufficient pitch support/);
  assert.doesNotMatch(source.subtitle, /accuracy/i);
});

test('network failures give actionable setup instructions', async () => {
  const messages: string[] = [];
  const importer = new SourceImporter({ onSource: () => assert.fail(), onStatus: value => messages.push(value) }, {
    createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
    fetch: async () => { throw new TypeError('Failed to fetch'); },
  });
  await importer.load(fakeFile('model.wav'), 'main-melody');
  assert.match(messages.at(-1)!, /npm run dev.*npm run setup:melody/);
});

test('prepared audio analyzes only the selected stereo samples with local clock and provenance', async () => {
  const channels = [Float32Array.from([0, 1, 2, 3, 4, 5]), Float32Array.from([0, 2, 4, 6, 8, 10])];
  const buffer = { length: 6, duration: 3, sampleRate: 2, numberOfChannels: 2, getChannelData: (i: number) => channels[i]! } as AudioBuffer;
  let received: number[] = [];
  let source: import('../src/ui/import').ImportedSource | undefined;
  const importer = new SourceImporter({ onSource: x => { source = x; }, onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => buffer, close: async () => {} }),
    transcribe: samples => { received = [...samples]; return { notes: [{ midi: 60, startBeat: 0.25, durationBeats: 0.5 }], tempoBpm: 60, quality: 1 }; },
  });
  const prepared = await importer.prepareAudio(fakeFile('clip.wav'));
  assert.ok(prepared);
  assert.deepEqual(received, []);
  importer.invalidate();
  await importer.analyzeAudio(prepared, 'isolated', { startIndex: 2, endIndex: 5 });
  assert.deepEqual(received, [3, 4.5, 6]);
  assert.equal(source!.melody[0]!.startBeat, 0.25);
  assert.deepEqual(source!.analysis!.sourceWindow, { startSeconds: 1, endSeconds: 2.5, sourceDurationSeconds: 3 });
  const replacement = await importer.prepareAudio(fakeFile('new.wav'));
  assert.ok(replacement);
  source = undefined;
  await importer.analyzeAudio(prepared, 'isolated', { startIndex: 0, endIndex: 2 });
  assert.equal(source, undefined);
});

test('model requests selected PCM and invalid selections never request', async () => {
  const channels = [Float32Array.from([0, 1, 2, 3, 4, 5]), Float32Array.from([0, 2, 4, 6, 8, 10])];
  const buffer = { length: 6, duration: 3, sampleRate: 2, numberOfChannels: 2, getChannelData: (i: number) => channels[i]! } as AudioBuffer;
  let calls = 0;
  let samples: number[] = [];
  let url = '';
  const importer = new SourceImporter({ onSource: () => {}, onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => buffer, close: async () => {} }),
    fetch: async (input, init) => {
      calls++; url = String(input);
      const view = new DataView(init!.body as ArrayBuffer);
      samples = Array.from({ length: view.byteLength / 4 }, (_, i) => view.getFloat32(i * 4, true));
      return new Response(JSON.stringify({ ...syntheticTrack, durationSeconds: 1.5, frames: [] }));
    },
  });
  const audio = (await importer.prepareAudio(fakeFile('model.wav')))!;
  for (const selection of [{ startIndex: -1, endIndex: 2 }, { startIndex: 0.5, endIndex: 2 }, { startIndex: 0, endIndex: 7 }, { startIndex: 2, endIndex: 2 }]) await importer.analyzeAudio(audio, 'main-melody', selection);
  assert.equal(calls, 0);
  await importer.analyzeAudio(audio, 'main-melody', { startIndex: 2, endIndex: 5 });
  assert.equal(url, '/api/melody?sampleRate=2');
  assert.deepEqual(samples, [3, 4.5, 6]);
});

test('release and MIDI selection invalidate prepared audio identities', async () => {
  for (const replacement of ['release', 'midi']) {
    let transcriptions = 0;
    const importer = new SourceImporter({ onSource: () => {}, onStatus: () => {} }, {
      createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
      transcribe: () => { transcriptions++; return null; },
    });
    const prepared = (await importer.prepareAudio(fakeFile('old.wav')))!;
    if (replacement === 'release') importer.releaseAudio();
    else await importer.load(fakeFile('new.mid', async () => midiBytes), 'isolated');
    await importer.analyzeAudio(prepared, 'isolated', { startIndex: 0, endIndex: 10 });
    assert.equal(transcriptions, 0);
  }
});

test('changing the selection aborts a pending model and suppresses its late result', async () => {
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  const sources: import('../src/ui/import').ImportedSource[] = [];
  const importer = new SourceImporter({ onSource: source => sources.push(source), onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
    fetch: async (_, init) => { signal = init!.signal as AbortSignal; return new Promise(done => { resolve = done; }); },
    transcribe: () => ({ notes: [{ midi: 72, startBeat: 0, durationBeats: 0.5 }], tempoBpm: 60, quality: 1 }),
  });
  const prepared = (await importer.prepareAudio(fakeFile('clip.wav')))!;
  const old = importer.analyzeAudio(prepared, 'main-melody', { startIndex: 0, endIndex: 10 });
  importer.invalidate();
  assert.equal(signal!.aborted, true);
  await importer.analyzeAudio(prepared, 'isolated', { startIndex: 2, endIndex: 7 });
  resolve(new Response(JSON.stringify(syntheticTrack)));
  await old;
  assert.equal(sources.length, 1);
  assert.deepEqual(sources[0]!.analysis!.sourceWindow, { startSeconds: 0.2, endSeconds: 0.7, sourceDurationSeconds: 1 });
});
