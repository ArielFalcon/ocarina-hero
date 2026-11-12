import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { calibrate } from '../src/core/calibration';

/**
 * Calibrates the app's tuning against a recording of the real instrument.
 *
 * Point it at any audio file: a phone recording of the game, a video rip, a
 * WAV. It decodes with ffmpeg and reports how many cents the recording sits
 * away from the app's five pitches. That number is the tuning offset, measured
 * instead of guessed. The page exposes the same measurement as an upload.
 */
const SR = 44100;
const input = process.argv[2];

if (!input) {
  console.log('Usage: tsx scripts/calibrate.ts <audio file>');
  process.exit(1);
}

mkdirSync('out', { recursive: true });
const raw = 'out/calibration.f32';
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-i',
  input,
  '-ac',
  '1',
  '-ar',
  String(SR),
  '-f',
  'f32le',
  raw,
]);

const buffer = readFileSync(raw);
const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
const result = calibrate(samples, SR);

if (!result) {
  console.log('No stable sustained pitch found. Use a clean recording of held notes.');
  process.exit(1);
}

console.log(`frames analysed  ${result.frames}`);
console.log(`median offset    ${result.median >= 0 ? '+' : ''}${result.median.toFixed(1)} ¢`);
console.log(`interquartile    ${result.low.toFixed(1)} .. ${result.high.toFixed(1)} ¢`);
console.log(`suggested value  ${Math.round(result.tuningCents)} ¢`);
