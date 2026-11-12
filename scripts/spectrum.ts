import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

/**
 * Prints the dominant spectral peaks of a few windows, so a reference
 * recording can be read without guessing from a spectrogram image.
 */
const SR = 44100;
const input = process.argv[2];
if (!input) throw new Error('Usage: tsx scripts/spectrum.ts <audio>');

mkdirSync('out', { recursive: true });
const raw = 'out/spectrum.f32';
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-ac', '1', '-ar', String(SR), '-f', 'f32le', raw]);

const buffer = readFileSync(raw);
const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

const size = 8192;
const hop = 4096;
const windows = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5];

for (const time of windows) {
  const offset = Math.floor(time * SR);
  if (offset + size > samples.length) continue;

  const re = new Float64Array(size);
  const im = new Float64Array(size);

  for (let i = 0; i < size; i += 1) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    re[i] = (samples[offset + i] ?? 0) * hann;
  }

  fft(re, im);

  const magnitudes = new Float64Array(size / 2);
  let max = 1e-12;
  for (let i = 1; i < size / 2; i += 1) {
    const value = Math.hypot(re[i] ?? 0, im[i] ?? 0);
    magnitudes[i] = value;
    if (value > max) max = value;
  }

  const peaks: { hz: number; db: number }[] = [];
  for (let i = 2; i < size / 2 - 1; i += 1) {
    const value = magnitudes[i] ?? 0;
    if (value < (magnitudes[i - 1] ?? 0) || value < (magnitudes[i + 1] ?? 0)) continue;
    const db = 20 * Math.log10(value / max);
    if (db < -35) continue;
    peaks.push({ hz: (i * SR) / size, db });
  }

  peaks.sort((a, b) => b.db - a.db);
  console.log(
    `${time.toFixed(1)}s  ${peaks
      .slice(0, 7)
      .map((peak) => `${peak.hz.toFixed(0)}Hz(${peak.db.toFixed(0)}dB)`)
      .join(' ')}`,
  );
}

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] as number, re[i] as number];
      [im[i], im[j]] = [im[j] as number, im[i] as number];
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let i = 0; i < n; i += length) {
      let curRe = 1;
      let curIm = 0;

      for (let j = 0; j < length / 2; j += 1) {
        const aRe = re[i + j] ?? 0;
        const aIm = im[i + j] ?? 0;
        const bRe = re[i + j + length / 2] ?? 0;
        const bIm = im[i + j + length / 2] ?? 0;

        const tRe = bRe * curRe - bIm * curIm;
        const tIm = bRe * curIm + bIm * curRe;

        re[i + j] = aRe + tRe;
        im[i + j] = aIm + tIm;
        re[i + j + length / 2] = aRe - tRe;
        im[i + j + length / 2] = aIm - tIm;

        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}
