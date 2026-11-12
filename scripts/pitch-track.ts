import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { detectPitch } from '../src/core/pitch-detect';

/** Frame-by-frame pitch track, to read a noisy reference recording. */
const SR = 44100;
const input = process.argv[2];
if (!input) throw new Error('Usage: tsx scripts/pitch-track.ts <audio>');

mkdirSync('out', { recursive: true });
const raw = 'out/track.f32';
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-ac', '1', '-ar', String(SR), '-f', 'f32le', raw]);

const buffer = readFileSync(raw);
const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

const size = 4096;
const hop = Math.floor(SR * 0.1);

for (let start = 0; start + size < samples.length; start += hop) {
  const segment = samples.subarray(start, start + size);
  const { hz, confidence } = detectPitch(segment, SR);
  const time = (start / SR).toFixed(1).padStart(4);
  const value =
    confidence < 0.55 || hz > 1500 ? '   ---' : `${hz.toFixed(0).padStart(5)}Hz`;
  process.stdout.write(`${time}s ${value} c${confidence.toFixed(2)}\n`);
}
