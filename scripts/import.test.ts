import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASIC_PITCH_DECODER, SourceImporter } from '../src/ui/import';
import { BASIC_PITCH_MODEL_SHA256 } from '../src/audio/basic-pitch-model';

/** The melody model is unavailable, so the injected periodicity detector runs. */
const unavailable = async (): Promise<never> => { throw new Error('offline'); };

test('invalidation prevents stale decode errors and closes the context', async () => {
  let reject!: (e: Error) => void;
  let closed = 0;
  const messages: string[] = [];
  const sources: unknown[] = [];
  const importer = new SourceImporter({ onSource: x => sources.push(x), onStatus: x => messages.push(x) }, {
    createContext: () => ({ decodeAudioData: () => new Promise((_, r) => { reject = r; }), close: async () => { closed++; } }),
  });
  const pending = importer.load({ name: 'old.wav', arrayBuffer: async () => new ArrayBuffer(0) } as File);
  await Promise.resolve();
  importer.invalidate();
  const count = messages.length;
  reject(new Error('bad'));
  await pending;
  assert.equal(messages.length, count);
  assert.equal(sources.length, 0);
  assert.equal(closed, 1);
});

test('a whole-file import mixes every channel and analyses at most the first fifteen seconds', async () => {
  let received: number[] = [];
  const channels = [new Float32Array(40).fill(0.3), new Float32Array(40).fill(0.6), new Float32Array(40).fill(0.9)];
  const buffer = { length: 40, sampleRate: 2, numberOfChannels: 3, getChannelData: (i: number) => channels[i]! } as AudioBuffer;
  const importer = new SourceImporter({ onSource: () => assert.fail('no notes must not create a source'), onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => buffer, close: async () => {} }),
    basicPitch: unavailable,
    transcribe: samples => { received = [...samples]; return null; },
  });
  await importer.load({ name: 'test.wav', arrayBuffer: async () => new ArrayBuffer(0) } as File);
  assert.equal(received.length, 30);
  assert.ok(received.every(value => Math.abs(value - 0.6) < 1e-6));
});

test('a newer audio import wins over an earlier decode success', async () => {
  let resolve!: (buffer: AudioBuffer) => void;
  let calls = 0;
  const sources: string[] = [];
  const buffer = { length: 10, sampleRate: 10, numberOfChannels: 1, getChannelData: () => new Float32Array(10) } as AudioBuffer;
  const importer = new SourceImporter({ onSource: x => sources.push(x.title), onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => ++calls === 1 ? new Promise(r => { resolve = r; }) : buffer, close: async () => {} }),
    basicPitch: unavailable,
    transcribe: () => ({ notes: [{ midi: 60, startBeat: 0.25, durationBeats: 0.5 }], tempoBpm: 60, quality: 0.5 }),
  });
  const file = (name: string) => ({ name, arrayBuffer: async () => new ArrayBuffer(0) } as File);
  const old = importer.load(file('old.wav'));
  while (!resolve) await Promise.resolve();
  await importer.load(file('new.wav'));
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
const fakeFile = (name: string, read: () => Promise<ArrayBuffer> = async () => new ArrayBuffer(0)) => ({ name, arrayBuffer: read } as File);
/** A Basic Pitch model in which MIDI 69 (piano key 48) sounds in every frame of every window. */
const soundingModel: import('../src/core/basic-pitch').BasicPitchModel = async () => {
  const notes = new Float32Array(172 * 88);
  for (let j = 0; j < 172; j++) notes[j * 88 + 48] = 0.9;
  return { notes, onsets: new Float32Array(notes.length) };
};

test('pending state belongs to the newest job and ends before publishing its source', async () => {
  let resolveOld!: (bytes: ArrayBuffer) => void;
  let resolveNew!: (bytes: ArrayBuffer) => void;
  const publishedPending: boolean[] = [];
  const importer = new SourceImporter({
    onSource: () => publishedPending.push(importer.pending), onStatus: () => {},
  });
  const old = importer.load(fakeFile('old.mid', () => new Promise(r => { resolveOld = r; })));
  assert.equal(importer.pending, true);
  const next = importer.load(fakeFile('new.mid', () => new Promise(r => { resolveNew = r; })));
  resolveOld(midiBytes.slice(0));
  await old;
  assert.equal(importer.pending, true);
  resolveNew(midiBytes.slice(0));
  await next;
  assert.deepEqual(publishedPending, [false]);
  assert.equal(importer.pending, false);
});

test('a MIDI import supersedes a pending model load, whether it later succeeds or fails, without stale callbacks', async () => {
  for (const outcome of ['success', 'error'] as const) {
    let resolve!: (model: import('../src/core/basic-pitch').BasicPitchModel) => void;
    let reject!: (error: Error) => void;
    const callbacks: string[] = [];
    const importer = new SourceImporter({ onSource: source => callbacks.push(`source:${source.title}`), onStatus: status => callbacks.push(`status:${status}`) }, {
      createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
      basicPitch: () => new Promise((yes, no) => { resolve = yes; reject = no; }),
      // A stale failure would otherwise publish these fallback notes.
      transcribe: () => ({ notes: [{ midi: 64, startBeat: 0.2, durationBeats: 0.3 }], tempoBpm: 60, quality: 0.5 }),
    });
    const old = importer.load(fakeFile('old.wav'));
    while (!resolve) await Promise.resolve();
    await importer.load(fakeFile('new.mid', async () => midiBytes.slice(0)));
    assert.equal(callbacks.at(-1), 'source:new.mid');
    const before = [...callbacks];
    if (outcome === 'success') resolve(soundingModel);
    else reject(new Error('late failure'));
    await old;
    assert.deepEqual(callbacks, before);
  }
});

test('a newer audio source supersedes a pending MIDI read', async () => {
  let resolve!: (bytes: ArrayBuffer) => void;
  const callbacks: string[] = [];
  const importer = new SourceImporter({ onSource: source => callbacks.push(`source:${source.title}`), onStatus: status => callbacks.push(`status:${status}`) }, {
    createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
    basicPitch: unavailable,
    transcribe: () => ({ notes: [{ midi: 64, startBeat: 0.2, durationBeats: 0.3 }], tempoBpm: 60, quality: 0.5 }),
  });
  const old = importer.load(fakeFile('old.mid', () => new Promise(r => { resolve = r; })));
  await importer.load(fakeFile('new.wav'));
  assert.equal(callbacks.at(-1), 'source:new.wav');
  const before = [...callbacks];
  resolve(midiBytes.slice(0));
  await old;
  assert.deepEqual(callbacks, before);
});

test('prepared audio analyzes only the selected stereo samples with local clock and provenance', async () => {
  const channels = [Float32Array.from([0, 1, 2, 3, 4, 5]), Float32Array.from([0, 2, 4, 6, 8, 10])];
  const buffer = { length: 6, duration: 3, sampleRate: 2, numberOfChannels: 2, getChannelData: (i: number) => channels[i]! } as AudioBuffer;
  let received: number[] = [];
  let source: import('../src/ui/import').ImportedSource | undefined;
  const importer = new SourceImporter({ onSource: x => { source = x; }, onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => buffer, close: async () => {} }),
    basicPitch: unavailable,
    transcribe: samples => { received = [...samples]; return { notes: [{ midi: 60, startBeat: 0.25, durationBeats: 0.5 }], tempoBpm: 60, quality: 1 }; },
  });
  const prepared = await importer.prepareAudio(fakeFile('clip.wav'));
  assert.ok(prepared);
  assert.deepEqual(received, []);
  importer.invalidate();
  await importer.analyzeAudio(prepared, { startIndex: 2, endIndex: 5 });
  assert.deepEqual(received, [3, 4.5, 6]);
  assert.equal(source!.melody[0]!.startBeat, 0.25);
  assert.deepEqual(source!.analysis!.sourceWindow, { startSeconds: 1, endSeconds: 2.5, sourceDurationSeconds: 3 });
  const replacement = await importer.prepareAudio(fakeFile('new.wav'));
  assert.ok(replacement);
  source = undefined;
  await importer.analyzeAudio(prepared, { startIndex: 0, endIndex: 2 });
  assert.equal(source, undefined);
});

test('invalid selections are reported and never analysed', async () => {
  const buffer = { length: 6, duration: 3, sampleRate: 2, numberOfChannels: 1, getChannelData: () => new Float32Array(6) } as AudioBuffer;
  let calls = 0;
  const messages: string[] = [];
  const importer = new SourceImporter({ onSource: () => {}, onStatus: x => messages.push(x) }, {
    createContext: () => ({ decodeAudioData: async () => buffer, close: async () => {} }),
    basicPitch: async () => { calls++; throw new Error('offline'); },
    transcribe: () => { calls++; return null; },
  });
  const audio = (await importer.prepareAudio(fakeFile('clip.wav')))!;
  const invalid = [{ startIndex: -1, endIndex: 2 }, { startIndex: 0.5, endIndex: 2 }, { startIndex: 0, endIndex: 7 }, { startIndex: 2, endIndex: 2 }];
  for (const selection of invalid) await importer.analyzeAudio(audio, selection);
  assert.equal(messages.length, invalid.length);
  assert.equal(calls, 0);
});

test('release and MIDI selection invalidate prepared audio identities', async () => {
  for (const replacement of ['release', 'midi']) {
    let transcriptions = 0;
    const importer = new SourceImporter({ onSource: () => {}, onStatus: () => {} }, {
      createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
      basicPitch: unavailable,
    transcribe: () => { transcriptions++; return null; },
    });
    const prepared = (await importer.prepareAudio(fakeFile('old.wav')))!;
    if (replacement === 'release') importer.releaseAudio();
    else await importer.load(fakeFile('new.mid', async () => midiBytes));
    await importer.analyzeAudio(prepared, { startIndex: 0, endIndex: 10 });
    assert.equal(transcriptions, 0);
  }
});

test('a new analysis supersedes one still waiting for the model and suppresses its late result', async () => {
  let release!: (model: import('../src/core/basic-pitch').BasicPitchModel) => void;
  let loads = 0;
  const sources: import('../src/ui/import').ImportedSource[] = [];
  const importer = new SourceImporter({ onSource: source => sources.push(source), onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
    basicPitch: () => ++loads === 1 ? new Promise(done => { release = done; }) : unavailable(),
    transcribe: () => ({ notes: [{ midi: 72, startBeat: 0, durationBeats: 0.5 }], tempoBpm: 60, quality: 1 }),
  });
  const prepared = (await importer.prepareAudio(fakeFile('clip.wav')))!;
  const old = importer.analyzeAudio(prepared, { startIndex: 0, endIndex: 10 });
  while (!release) await Promise.resolve();
  await importer.analyzeAudio(prepared, { startIndex: 2, endIndex: 7 });
  release(soundingModel);
  await old;
  assert.equal(sources.length, 1);
  assert.deepEqual(sources[0]!.analysis!.sourceWindow, { startSeconds: 0.2, endSeconds: 0.7, sourceDurationSeconds: 1 });
});

test('audio decodes the Basic Pitch melody with provenance, keeps its timing and never runs the fallback detector', async () => {
  const rate = 22050;
  const buffer = { length: rate * 2, duration: 2, sampleRate: rate, numberOfChannels: 1, getChannelData: () => new Float32Array(rate * 2) } as AudioBuffer;
  let fallback = 0;
  let source: import('../src/ui/import').ImportedSource | undefined;
  const importer = new SourceImporter({ onSource: x => { source = x; }, onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => buffer, close: async () => {} }),
    basicPitch: async () => soundingModel,
    transcribe: () => { fallback++; return null; },
  });
  await importer.load(fakeFile('flute.wav'));
  assert.equal(fallback, 0);
  assert.equal(source!.preserveTiming, true);
  assert.deepEqual(source!.melody.map(note => note.midi), [69]);
  assert.ok(source!.melody[0]!.durationBeats > 1.9);
  assert.deepEqual(source!.analysis!.engine, { id: 'basic-pitch', modelSha256: BASIC_PITCH_MODEL_SHA256, decoder: BASIC_PITCH_DECODER });
  assert.deepEqual(source!.analysis!.warnings, []);
});

test('audio falls back to the periodicity detector and says why when the model cannot load', async () => {
  let source: import('../src/ui/import').ImportedSource | undefined;
  const messages: string[] = [];
  const importer = new SourceImporter({ onSource: x => { source = x; }, onStatus: x => messages.push(x) }, {
    createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
    basicPitch: unavailable,
    transcribe: () => ({ notes: [{ midi: 64, startBeat: 0.2, durationBeats: 0.3 }], tempoBpm: 60, quality: 0.5 }),
  });
  await importer.load(fakeFile('flute.wav'));
  assert.deepEqual(source!.analysis!.engine, { id: 'isolated-periodicity' });
  assert.match(source!.analysis!.warnings[0]!, /Melody model unavailable \(offline\)/);
  assert.match(source!.subtitle, /Melody model unavailable/);
  const silent = new SourceImporter({ onSource: () => assert.fail('no notes'), onStatus: x => messages.push(x) }, {
    createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
    basicPitch: unavailable,
    transcribe: () => null,
  });
  await silent.load(fakeFile('quiet.wav'));
  assert.match(messages.at(-1)!, /No melody found.*could not load \(offline\)/);
});

test('audio falls back to the periodicity detector when the loaded model fails during inference', async () => {
  let source: import('../src/ui/import').ImportedSource | undefined;
  const importer = new SourceImporter({ onSource: x => { source = x; }, onStatus: () => {} }, {
    createContext: () => ({ decodeAudioData: async () => oneSecond, close: async () => {} }),
    basicPitch: async () => async () => { throw new Error('out of memory'); },
    transcribe: () => ({ notes: [{ midi: 64, startBeat: 0.2, durationBeats: 0.3 }], tempoBpm: 60, quality: 0.5 }),
  });
  await importer.load(fakeFile('flute.wav'));
  assert.deepEqual(source!.analysis!.engine, { id: 'isolated-periodicity' });
  assert.deepEqual(source!.melody.map(note => note.midi), [64]);
  assert.match(source!.analysis!.warnings[0]!, /out of memory/);
});
