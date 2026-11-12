import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { detectPitch } from '../src/core/pitch-detect';

/** Quantises a recording to note names with durations (run-length). */
const SR = 44100;
const input = process.argv[2];
const minConfidence = Number(process.argv[3] ?? 0.85);
if (!input) throw new Error('Usage: tsx scripts/quantize.ts <audio> [minConfidence]');

mkdirSync('out', { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'out/quant.f32']);
const buffer = readFileSync('out/quant.f32');
const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const size = 4096;
const hop = Math.floor(SR * 0.08);

let current = '';
let start = 0;

for (let offset = 0; offset + size < samples.length; offset += hop) {
  const { hz, confidence } = detectPitch(samples.subarray(offset, offset + size), SR);
  const time = offset / SR;
  let name = '?';
  let midi = -1;

  if (confidence >= minConfidence && hz > 150 && hz < 1400) {
    midi = Math.round(12 * Math.log2(hz / 440) + 69);
    name = `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  }

  if (name !== current) {
    if (current && time - start >= 0.12) {
      console.log(`${start.toFixed(2)}s  ${(time - start).toFixed(2)}s  ${current}`);
    }
    current = name;
    start = time;
  }
}

console.log(`${start.toFixed(2)}s  ...  ${current}`);
