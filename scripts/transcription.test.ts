import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { transcribeAudio } from '../src/core/transcribe';

const rate = 24000;
function tones(midis: number[], duration = 0.2, gap = 0.04, gain = 0.5): Float32Array {
  const count = Math.round((duration + gap) * rate);
  const data = new Float32Array(count * midis.length);
  midis.forEach((midi, index) => {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    for (let i = 0; i < duration * rate; i++) {
      const envelope = Math.min(1, i / 120, (duration * rate - i) / 120);
      data[index * count + i] = gain * envelope * Math.sin(2 * Math.PI * frequency * i / rate);
    }
  });
  return data;
}
test('extracts chromatic source pitches across registers', () => {
  for (const expected of [[60, 62, 64, 65], [83, 86, 93, 91]]) {
    assert.deepEqual(transcribeAudio(tones(expected), rate)?.notes.map(n => n.midi), expected);
  }
});
test('preserves repeated notes across silence at different gains', () => {
  for (const gain of [0.5, 0.01]) {
    assert.deepEqual(transcribeAudio(tones([74, 74], 0.2, 0.05, gain), rate)?.notes.map(n => n.midi), [74, 74]);
  }
});
test('retains short notes and short excerpts', () => {
  assert.deepEqual(transcribeAudio(tones([72, 73, 74, 75, 76, 77], 0.08, 0.03), rate)?.notes.map(n => n.midi), [72, 73, 74, 75, 76, 77]);
  assert.deepEqual(transcribeAudio(tones([72]), rate)?.notes.map(n => n.midi), [72]);
});

test('finds low fundamentals instead of short-lag boundary peaks at supported sample rates', () => {
  for (const sampleRate of [24000, 48000, 96000]) {
    const samples = new Float32Array(sampleRate);
    for (let i = 0; i < samples.length; i++) samples[i] = 0.3 * Math.sin(2 * Math.PI * 65.4064 * i / sampleRate);
    assert.deepEqual(transcribeAudio(samples, sampleRate)?.notes.map(n => n.midi), [36]);
  }
});

test('ignores a loud impulse while retaining quiet notes and silence between repeats', () => {
  const samples = tones([69, 69], 0.2, 0.05, 0.01);
  samples[0] = 1;
  const notes = transcribeAudio(samples, rate)?.notes;
  assert.deepEqual(notes?.map(n => n.midi), [69, 69]);
  assert.ok(notes![1]!.startBeat - notes![0]!.startBeat - notes![0]!.durationBeats >= 0.03);
});

test('distinguishes a brief real note from a difference-frequency transition', () => {
  for (const sampleRate of [24000, 44100, 48000, 96000]) {
    for (const brief of [0.03, 0.04]) {
      const length = 0.6 + brief;
      const samples = new Float32Array(Math.round(length * sampleRate));
      for (let i = 0; i < samples.length; i++) {
        const t = i / sampleRate;
        const midi = t < 0.3 ? 69 : t < 0.3 + brief ? 57 : 76;
        samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * t);
      }
      assert.deepEqual(transcribeAudio(samples, sampleRate)?.notes.map(n => n.midi), [69, 57, 76], `${sampleRate} Hz, ${brief}s`);
    }
    const samples = new Float32Array(Math.round(0.64 * sampleRate));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const blend = Math.max(0, Math.min(1, (t - 0.3) / 0.04));
      samples[i] = 0.35 * ((1 - blend) * Math.sin(2 * Math.PI * 1174.659 * t) + blend * Math.sin(2 * Math.PI * 880 * t));
    }
    assert.deepEqual(transcribeAudio(samples, sampleRate)?.notes.map(n => n.midi), [86, 81], `overlap ${sampleRate} Hz`);
  }
});

test('rejects broadband noise without stable periodicity', () => {
  let seed = 271828;
  const samples = new Float32Array(rate);
  for (let i = 0; i < samples.length; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    samples[i] = (seed / 0x100000000 * 2 - 1) * 0.03;
  }
  assert.equal(transcribeAudio(samples, rate), null);
});

function dynamicPhrase(sampleRate: number, background: number, quietNote: boolean): Float32Array {
  const samples = new Float32Array(Math.round(sampleRate * 1.8));
  const notes = [[0.2, 69, 0.5], [0.7, 72, quietNote ? 0.005 : 0], [1.2, 76, 0.5]] as const;
  let seed = 1459;
  for (let i = 0; i < samples.length; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const t = i / sampleRate;
    samples[i] = background * ((seed / 0x100000000 - 0.5) * 0.2 + Math.sin(2 * Math.PI * 110 * t));
    for (const [start, midi, gain] of notes) {
      const local = t - start;
      if (local >= 0 && local < 0.4) {
        const envelope = Math.min(1, local / 0.01, (0.4 - local) / 0.01);
        samples[i] += gain * envelope * Math.sin(2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * local);
      }
    }
  }
  return samples;
}

test('retains a quiet source note between loud notes with silence or a low background', () => {
  for (const sampleRate of [24000, 48000]) for (const background of [0, 0.001]) {
    const result = transcribeAudio(dynamicPhrase(sampleRate, background, true), sampleRate);
    assert.deepEqual(result?.notes.map(n => n.midi), [69, 72, 76], `${sampleRate} Hz, background ${background}`);
    for (const [index, note] of result!.notes.entries()) {
      assert.ok(Number.isFinite(note.startBeat) && Number.isFinite(note.durationBeats) && note.durationBeats > 0);
      const next = result!.notes[index + 1];
      if (next) assert.ok(note.startBeat + note.durationBeats <= next.startBeat + 1e-9);
    }
    const withoutQuietNote = transcribeAudio(dynamicPhrase(sampleRate, background, false), sampleRate)!;
    assert.ok(Number.isFinite(result!.quality) && result!.quality <= 1);
    assert.ok(result!.quality > withoutQuietNote.quality);
  }
});

test('does not turn a stationary background into notes between louder source events', () => {
  assert.deepEqual(transcribeAudio(dynamicPhrase(rate, 0.001, false), rate)?.notes.map(n => n.midi), [69, 76]);
});

test('keeps quiet recovery inside the already detected phrase boundaries', () => {
  const samples = dynamicPhrase(rate, 0, true);
  for (let i = Math.round(1.6 * rate); i < samples.length; i++) {
    samples[i] = 0.001 * Math.sin(2 * Math.PI * 110 * i / rate);
  }
  assert.deepEqual(transcribeAudio(samples, rate)?.notes.map(n => n.midi), [69, 72, 76]);
});

test('requires fundamental energy for newly recovered subharmonic candidates', () => {
  const samples = dynamicPhrase(rate, 0, false);
  for (let i = Math.round(0.7 * rate); i < Math.round(1.1 * rate); i++) {
    const t = i / rate;
    samples[i] = 0.0035 * (Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1174.659 * t));
  }
  const pitches = transcribeAudio(samples, rate)?.notes.map(n => n.midi);
  assert.ok(pitches?.includes(69) && pitches.includes(76));
  assert.ok(!pitches.includes(62));
});

test('detects a short isolated note in a mostly silent clip', () => {
  const samples = new Float32Array(rate * 2);
  samples.set(tones([69], 0.08, 0, 0.1), rate);
  assert.deepEqual(transcribeAudio(samples, rate)?.notes.map(n => n.midi), [69]);
});

function continuous(sampleRate: number, gain: number, pitch: (t: number) => number, envelope: (t: number) => number): Float32Array {
  const samples = new Float32Array(sampleRate);
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    phase += 2 * Math.PI * 440 * 2 ** ((pitch(t) - 69) / 12) / sampleRate;
    samples[i] = gain * envelope(t) * Math.sin(phase);
  }
  return samples;
}

test('keeps stable detuned notes and groups boundary-crossing vibrato', () => {
  for (const sampleRate of [24000, 44100, 48000]) for (const gain of [0.5, 0.02]) {
    for (const offset of [-0.45, -0.31, 0.31, 0.45]) {
      assert.deepEqual(transcribeAudio(continuous(sampleRate, gain, () => 69 + offset, () => 1), sampleRate)?.notes.map(n => n.midi), [69], `${sampleRate} ${gain} ${offset}`);
    }
    const vibrato = continuous(sampleRate, gain, t => 69.5 + 0.2 * Math.sin(2 * Math.PI * 5 * t), t => 0.7 + 0.2 * t);
    assert.equal(transcribeAudio(vibrato, sampleRate)?.notes.length, 1, `vibrato ${sampleRate} ${gain}`);
    const change = continuous(sampleRate, gain, t => t < 0.5 ? 69 : 70, () => 1);
    assert.deepEqual(transcribeAudio(change, sampleRate)?.notes.map(n => n.midi), [69, 70]);
  }
});

test('does not infer a new note from amplitude modulation alone', () => {
  for (const sampleRate of [24000, 44100, 48000]) for (const gain of [0.5, 0.02]) {
    const samples = continuous(sampleRate, gain, () => 69, t => 1 - 0.8 * Math.max(0, 1 - Math.abs(t - 0.5) / 0.08));
    const notes = transcribeAudio(samples, sampleRate)?.notes;
    assert.deepEqual(notes?.map(n => n.midi), [69], `${sampleRate} ${gain}`);
    assert.ok(notes!.every(n => n.durationBeats > 0));
  }
});


test('does not split steady harmonic tones or slow gain and vibrato', () => {
  for (const sampleRate of [24000, 44100, 48000]) for (const gain of [0.5, 0.02]) {
    const vibrato = continuous(sampleRate, gain, t => 69 + 0.2 * Math.sin(2 * Math.PI * 5 * t), t => 0.55 + 0.35 * t);
    assert.deepEqual(transcribeAudio(vibrato, sampleRate)?.notes.map(n => n.midi), [69]);
    for (const phase of [0, 1.2]) {
      const samples = new Float32Array(sampleRate);
      for (let i = 0; i < samples.length; i++) {
        const p = 2 * Math.PI * 65.4064 * i / sampleRate + phase;
        samples[i] = gain * (Math.sin(p) + 0.5 * Math.sin(2 * p + phase) + 0.25 * Math.sin(3 * p - phase)) / 1.75;
      }
      assert.deepEqual(transcribeAudio(samples, sampleRate)?.notes.map(n => n.midi), [36], `${sampleRate} ${gain} phase ${phase}`);
    }
  }
});
