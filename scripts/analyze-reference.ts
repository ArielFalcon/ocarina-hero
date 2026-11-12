import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { detectPitch } from '../src/core/pitch-detect';

/**
 * Reference analysis: decode any audio and report what the instrument actually
 * does — note onsets, pitch, duration, gaps, attack and harmonic profile.
 */
const SR = 44100;
const input = process.argv[2];
if (!input) throw new Error('Usage: tsx scripts/analyze-reference.ts <audio>');

mkdirSync('out', { recursive: true });
const raw = 'out/reference.f32';
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-ac', '1', '-ar', String(SR), '-f', 'f32le', raw]);

const buffer = readFileSync(raw);
const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

const frame = 1024;
const hop = 256;
const envelope: number[] = [];
for (let i = 0; i + frame < samples.length; i += hop) {
  let sum = 0;
  for (let j = 0; j < frame; j += 1) sum += (samples[i + j] ?? 0) ** 2;
  envelope.push(Math.sqrt(sum / frame));
}

const max = Math.max(...envelope);
const minOn = max * 0.12;
const minOff = max * 0.05;
const frameSeconds = hop / SR;

const onsets: number[] = [];
for (let i = 2; i < envelope.length; i += 1) {
  const current = envelope[i] ?? 0;
  const previous = envelope[i - 1] ?? 0;
  if (current < minOn) continue;
  if (current - previous < max * 0.06) continue;
  if (onsets.length > 0) {
    const last = onsets[onsets.length - 1] ?? 0;
    if ((i - last) * frameSeconds < 0.08) continue;
  }
  onsets.push(i);
}

console.log(`duration ${(samples.length / SR).toFixed(2)} s · peak ${(20 * Math.log10(max || 1e-9)).toFixed(1)} dB`);
console.log(`onsets ${onsets.length}\n`);

const notes: { start: number; duration: number; hz: number }[] = [];

for (let index = 0; index < onsets.length; index += 1) {
  const startFrame = onsets[index] ?? 0;
  const nextFrame = onsets[index + 1] ?? envelope.length;

  let endFrame = startFrame;
  for (let i = startFrame; i < nextFrame; i += 1) {
    if ((envelope[i] ?? 0) < minOff) break;
    endFrame = i;
  }

  const start = startFrame * frameSeconds;
  const duration = Math.max((endFrame - startFrame + 1) * frameSeconds - 0.02, 0.03);
  const from = Math.floor((start + duration * 0.25) * SR);
  const to = Math.min(samples.length, Math.floor((start + duration * 0.75) * SR));
  const segment = samples.subarray(from, to);
  const { hz, confidence } = detectPitch(segment, SR);

  if (hz > 100 && hz < 1200 && confidence > 0.5) {
    notes.push({ start, duration, hz });
    const cents = 1200 * Math.log2(hz / 440);
    console.log(
      `  ${start.toFixed(2)}s  dur ${duration.toFixed(2)}s  ${hz.toFixed(1)} Hz  ${cents.toFixed(0)}¢ from A4`,
    );
  }
}

console.log('\nintervals between starts:');
console.log(
  notes
    .slice(1)
    .map((note, index) => (note.start - (notes[index]?.start ?? note.start)).toFixed(2))
    .join(' '),
);

if (notes.length > 0) {
  const strongest = notes.reduce((a, b) => (b.duration > a.duration ? b : a));
  const from = Math.floor((strongest.start + 0.05) * SR);
  const to = Math.floor((strongest.start + 0.05 + 0.25) * SR);
  const segment = windowed(samples.subarray(from, to));
  const profile = harmonics(segment, strongest.hz);
  const breath = interHarmonic(segment, strongest.hz);

  console.log(`\nharmonic profile (1f..8f, normalised) on ${strongest.hz.toFixed(1)} Hz:`);
  console.log(profile.map((value) => value.toFixed(3)).join('  '));
  console.log(`inter-harmonic energy (breath): ${breath.toFixed(3)}`);
}

function windowed(data: Float32Array): Float32Array {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = (data[i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (data.length - 1)));
  }
  return out;
}

function goertzel(data: Float32Array, hz: number): number {
  const omega = (2 * Math.PI * hz) / SR;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;

  for (const value of data) {
    s0 = value + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }

  return Math.sqrt(Math.max(s1 * s1 + s2 * s2 - coeff * s1 * s2, 0)) / data.length;
}

function harmonics(data: Float32Array, hz: number): number[] {
  const values = [];
  for (let k = 1; k <= 8; k += 1) values.push(goertzel(data, hz * k));
  const max = Math.max(...values, 1e-9);
  return values.map((value) => value / max);
}

function interHarmonic(data: Float32Array, hz: number): number {
  let sum = 0;
  for (let k = 1; k <= 6; k += 1) sum += goertzel(data, hz * (k + 0.5));
  const fundamental = goertzel(data, hz) || 1e-9;
  return sum / 6 / fundamental;
}
