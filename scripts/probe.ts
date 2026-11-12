import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

/** Prints absolute and relative levels at specific frequencies. */
const SR = 44100;
const input = process.argv[2];
const time = Number(process.argv[3] ?? 1.8);
const freqs = (process.argv[4] ?? '444,888,1332,499,998,593,1186')
  .split(',')
  .map(Number);

if (!input) throw new Error('Usage: tsx scripts/probe.ts <audio> <time> [freqs]');

mkdirSync('out', { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'out/probe.f32']);
const buffer = readFileSync('out/probe.f32');
const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

const size = 8192;
const offset = Math.floor(time * SR);
const data = new Float32Array(size);
for (let i = 0; i < size; i += 1) {
  const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  data[i] = (samples[offset + i] ?? 0) * hann;
}

const values = freqs.map((hz) => goertzel(data, hz));
const max = Math.max(...values, 1e-12);

for (let i = 0; i < freqs.length; i += 1) {
  const value = values[i] ?? 0;
  console.log(
    `${(freqs[i] ?? 0).toFixed(0).padStart(5)} Hz  ${(20 * Math.log10(value / max)).toFixed(1).padStart(6)} dB`,
  );
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
