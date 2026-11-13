import { mkdirSync, writeFileSync } from 'node:fs';
import { ensureExternalMedia } from './media-directory';
import { VOICE, VOICE_PARTIAL_SUM, releaseForGap } from '../src/audio/voice-model';
import { DEMOS } from './catalogue-loader';
import { frequencyOf } from '../src/core/pitches';
import { prepareMelody } from '../src/core/prepare';
import type { ScheduledNote } from '../src/core/schedule';
import { buildSchedule } from '../src/core/schedule';
import { detectPitch } from '../src/core/pitch-detect';
import { applyHeadroom } from './audio-headroom';

const SR = 44100;
const id = process.argv[2] ?? 'lullaby-full';
const demo = DEMOS.find((item) => item.id === id);

if (!demo) {
  console.log(`unknown demo "${id}". Options: ${DEMOS.map((d) => d.id).join(', ')}`);
  process.exit(1);
}

const prepared = prepareMelody(demo, { simplify: false, maxBend: 2 });
const schedule = buildSchedule(prepared.notes, demo.tempoBpm, 0);

const totalSeconds =
  Math.max(...schedule.map((note) => note.startTime + note.duration + VOICE.release)) + 0.2;
const samples = new Float32Array(Math.ceil(totalSeconds * SR));

function envelope(t: number, duration: number, releaseDuration: number): number {
  if (t < 0) return 0;
  const attackEnd = Math.min(VOICE.attack, duration);
  const decayEnd = Math.min(VOICE.attack + VOICE.decay, duration);
  if (t < attackEnd) return VOICE.peak * (t / attackEnd);
  if (t < decayEnd) {
    return VOICE.peak + (VOICE.sustain - VOICE.peak) * ((t - attackEnd) / (decayEnd - attackEnd));
  }
  if (t < duration) return VOICE.sustain;
  const ratio = (t - duration) / releaseDuration;
  if (ratio >= 1) return 0;
  return VOICE.sustain * (0.0001 / VOICE.sustain) ** ratio;
}

function triangle(phase: number): number {
  return (2 / Math.PI) * Math.asin(Math.sin(phase));
}

for (const [index, note] of schedule.entries()) {
  const gap = (schedule[index + 1]?.startTime ?? Infinity) - note.startTime - note.duration;
  const releaseDuration = releaseForGap(gap);
  const hz = frequencyOf(note.pitch, note.bend);
  const from = Math.max(0, Math.floor(note.startTime * SR));
  const to = Math.min(samples.length, Math.floor((note.startTime + note.duration + releaseDuration) * SR));

  for (let i = from; i < to; i += 1) {
    const t = i / SR - note.startTime;
    const env = envelope(t, note.duration, releaseDuration);
    if (env <= 0) continue;
    const phase = 2 * Math.PI * hz * t;
    const signal =
      Math.sin(phase) + VOICE.overtoneGain * triangle(phase * 2) + VOICE.thirdGain * Math.sin(phase * 3);
    samples[i] += (env * signal * VOICE.master) / VOICE_PARTIAL_SUM;
  }
}

ensureExternalMedia();
mkdirSync('out', { recursive: true });
applyHeadroom(samples);
writeFileSync(`out/${id}.wav`, encodeWav(samples));

console.log('Approximate handwritten renderer: no native delay or engine-equivalence guarantee.');
const report = analyse(samples, schedule);
printReport(report);

function encodeWav(data: Float32Array): Buffer {
  const buffer = Buffer.alloc(44 + data.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + data.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(data.length * 2, 40);

  for (let i = 0; i < data.length; i += 1) {
    const value = Math.max(-1, Math.min(1, data[i] ?? 0));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }

  return buffer;
}

interface Report {
  readonly noteCount: number;
  readonly meanCents: number;
  readonly maxCents: number;
  readonly offNotes: number;
  readonly peakDb: number;
  readonly silenceShare: number;
  readonly longestSilenceMs: number;
  readonly noiseFloorDb: number;
  readonly firstNotes: readonly string[];
}

function analyse(data: Float32Array, notes: readonly ScheduledNote[]): Report {
  const errors: number[] = [];
  const firstNotes: string[] = [];

  for (const note of notes) {
    const windowStart = note.startTime + note.duration * 0.3;
    const windowLength = Math.max(0.03, note.duration * 0.4);
    const from = Math.floor(windowStart * SR);
    const to = Math.min(data.length, Math.floor((windowStart + windowLength) * SR));
    if (to - from < 512) continue;

    const segment = data.subarray(from, to);
    const detected = detectPitch(segment, SR).hz;
    if (!Number.isFinite(detected) || detected <= 0) continue;

    const target = frequencyOf(note.pitch, note.bend);
    const cents = 1200 * Math.log2(detected / target);
    errors.push(cents);

    if (firstNotes.length < 6) {
      firstNotes.push(`${note.pitch}${note.bend ? `+${note.bend}` : ''}: ${detected.toFixed(1)} Hz (${cents.toFixed(1)}¢)`);
    }
  }

  const absolute = errors.map((value) => Math.abs(value));
  const frame = Math.floor(SR * 0.01);
  const rms: number[] = [];
  for (let i = 0; i + frame < data.length; i += frame) {
    let sum = 0;
    for (let j = 0; j < frame; j += 1) sum += (data[i + j] ?? 0) ** 2;
    rms.push(Math.sqrt(sum / frame));
  }

  const threshold = 10 ** (-55 / 20);
  const firstSample = Math.floor((notes[0]?.startTime ?? 0) * 100);
  const lastNote = notes[notes.length - 1];
  const lastSample = Math.floor(((lastNote?.startTime ?? 0) + (lastNote?.duration ?? 0)) * 100);

  let longest = 0;
  let current = 0;
  let silentFrames = 0;

  for (let i = firstSample; i <= lastSample && i < rms.length; i += 1) {
    if ((rms[i] ?? 0) < threshold) {
      current += 1;
      silentFrames += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  const span = Math.max(1, lastSample - firstSample);
  let peak = 0;
  for (const value of data) peak = Math.max(peak, Math.abs(value));

  return {
    noteCount: notes.length,
    meanCents: absolute.reduce((a, b) => a + b, 0) / Math.max(absolute.length, 1),
    maxCents: absolute.reduce((a, b) => Math.max(a, b), 0),
    offNotes: absolute.filter((value) => value > 50).length,
    peakDb: 20 * Math.log10(peak || 1e-9),
    silenceShare: silentFrames / span,
    longestSilenceMs: longest * 10,
    noiseFloorDb: 20 * Math.log10(threshold),
    firstNotes,
  };
}

function printReport(report: Report): void {
  console.log(`\n${demo?.title} -> out/${id}.wav`);
  console.log(`  notes          ${report.noteCount}`);
  console.log(`  pitch error    mean ${report.meanCents.toFixed(2)} ¢ · max ${report.maxCents.toFixed(2)} ¢ · ${report.offNotes} notes off`);
  console.log(`  peak           ${report.peakDb.toFixed(1)} dBFS`);
  console.log(`  silence        ${(report.silenceShare * 100).toFixed(1)}% · longest ${report.longestSilenceMs} ms`);
  console.log(`  first notes    ${report.firstNotes.join(' | ')}`);
}
