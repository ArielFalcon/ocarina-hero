import { PITCHES, frequencyOf, getTuning } from './pitches';
import { detectPitch, nearestCents } from './pitch-detect';

export interface CalibrationResult {
  readonly frames: number;
  readonly median: number;
  readonly tuningCents: number;
  readonly low: number;
  readonly high: number;
}

/** Measured base pitches across octaves, independent of the user's fine tuning. */
export function referenceFrequencies(): number[] {
  const references: number[] = [];
  const fineTuningRatio = 2 ** (getTuning() / 1200);
  for (const pitch of PITCHES) {
    const base = frequencyOf(pitch.id) / fineTuningRatio;
    for (let octave = -2; octave <= 2; octave += 1) {
      references.push(base * 2 ** octave);
    }
  }
  return references;
}

/**
 * Measures how far a recording sits from the app's tuning.
 *
 * Decimates to roughly 22 kHz (the instrument reaches approximately 1.34 kHz with bend), keeps
 * only confident, stable frames, and returns the median offset in cents. The
 * median rather than the mean, so a few noisy frames cannot drag the result.
 */
export function calibrate(
  samples: Float32Array,
  sampleRate: number,
  maxSeconds = 6,
): CalibrationResult | null {
  const prepared =
    sampleRate > 24000
      ? { data: decimate(samples, 2), rate: sampleRate / 2 }
      : { data: samples, rate: sampleRate };
  const data = prepared.data;
  const rate = prepared.rate;

  const windowSize = 1024;
  const hop = 1024;
  const tuning = getTuning();
  const references = referenceFrequencies();
  const limit = Math.min(data.length, Math.floor(maxSeconds * rate));
  const offsets: number[] = [];

  for (let start = 0; start + windowSize < limit; start += hop) {
    const segment = data.subarray(start, start + windowSize);
    const { hz, confidence } = detectPitch(segment, rate);
    if (confidence < 0.75 || hz < 150 || hz > 1600) continue;

    const cents = nearestCents(hz, references);
    if (Math.abs(cents) <= 50) offsets.push(cents);
  }

  if (offsets.length < 5) return null;

  offsets.sort((a, b) => a - b);

  return {
    frames: offsets.length,
    median: quantile(offsets, 0.5) - tuning,
    tuningCents: quantile(offsets, 0.5),
    low: quantile(offsets, 0.25) - tuning,
    high: quantile(offsets, 0.75) - tuning,
  };
}

function decimate(samples: Float32Array, factor: number): Float32Array {
  const length = Math.floor(samples.length / factor);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (let j = 0; j < factor; j += 1) sum += samples[i * factor + j] ?? 0;
    data[i] = sum / factor;
  }

  return data;
}

function quantile(values: readonly number[], q: number): number {
  const position = (values.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const a = values[base] ?? 0;
  const b = values[base + 1] ?? a;
  return a + (b - a) * rest;
}
