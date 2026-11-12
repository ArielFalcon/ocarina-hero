import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { PITCHES } from '../src/core/pitches';
import { detectPitch } from '../src/core/pitch-detect';

/**
 * Measures the tuning of each individual note.
 *
 * A single global offset is wrong: the reference recordings put D and A about
 * 20 cents sharp while F sits near zero. This aggregates frames that land
 * close to an unbent pitch and reports the median offset per note.
 */
const SR = 44100;
const files = process.argv.slice(2);
if (files.length === 0) throw new Error('Usage: tsx scripts/tune-per-note.ts <wav...>');

const sounding = PITCHES.map((pitch) => ({ id: pitch.id, hz: pitch.hz * 2 }));
const samples: Record<string, number[]> = {};
for (const pitch of sounding) samples[pitch.id] = [];

const size = 2048;
const hop = Math.floor(SR * 0.05);

for (const [index, file] of files.entries()) {
  mkdirSync('out', { recursive: true });
  const raw = `out/tune-${index}.f32`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', raw]);

  const buffer = readFileSync(raw);
  const data = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

  for (let offset = 0; offset + size < data.length; offset += hop) {
    const { hz, confidence } = detectPitch(data.subarray(offset, offset + size), SR);
    if (confidence < 0.9 || hz < 200 || hz > 1400) continue;

    let bestId = '';
    let bestCents = Number.POSITIVE_INFINITY;

    for (const pitch of sounding) {
      const cents = 1200 * Math.log2(hz / pitch.hz);
      if (Math.abs(cents) < Math.abs(bestCents)) {
        bestCents = cents;
        bestId = pitch.id;
      }
    }

    if (bestId && Math.abs(bestCents) <= 50) {
      samples[bestId]?.push(bestCents);
    }
  }
}

console.log('note   frames   median   iqr');
for (const pitch of sounding) {
  const values = (samples[pitch.id] ?? []).sort((a, b) => a - b);
  if (values.length === 0) {
    console.log(`${pitch.id.padEnd(6)} ${'0'.padStart(6)}      --      --`);
    continue;
  }

  const median = quantile(values, 0.5);
  const low = quantile(values, 0.25);
  const high = quantile(values, 0.75);

  console.log(
    `${pitch.id.padEnd(6)} ${String(values.length).padStart(6)} ${format(median).padStart(8)} ${format(low)} .. ${format(high)}`,
  );
}

function quantile(values: readonly number[], q: number): number {
  const position = (values.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const a = values[base] ?? 0;
  const b = values[base + 1] ?? a;
  return a + (b - a) * rest;
}

function format(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}
