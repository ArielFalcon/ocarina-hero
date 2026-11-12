/**
 * Monophonic pitch detection, shared by the browser calibration and the
 * offline measurement scripts.
 *
 * Autocorrelation with a shortest-period preference, so a harmonic-rich tone
 * does not report an octave below the real pitch.
 */
export function detectPitch(
  segment: Float32Array,
  sampleRate: number,
  options: { minHz?: number; maxHz?: number } = {},
): { hz: number; confidence: number } {
  const n = segment.length;
  let mean = 0;
  for (const value of segment) mean += value;
  mean /= n;

  const signal = new Float32Array(n);
  for (let i = 0; i < n; i += 1) signal[i] = (segment[i] ?? 0) - mean;

  const minLag = Math.max(2, Math.floor(sampleRate / Math.min(options.maxHz ?? 1600, sampleRate / 2)));
  const maxLag = Math.min(Math.ceil(sampleRate / (options.minHz ?? 70)), Math.floor(n / 2));
  if (maxLag <= minLag) return { hz: 0, confidence: 0 };

  const correlation = new Float32Array(maxLag + 2);
  let best = -1;
  let bestLag = minLag;

  const extended = options.maxHz !== undefined || options.minHz !== undefined;
  for (let lag = extended ? minLag - 1 : minLag; lag <= (extended ? maxLag + 1 : maxLag); lag += 1) {
    let cross = 0;
    let energyA = 0;
    let energyB = 0;

    for (let i = 0; i + lag < n; i += 1) {
      const a = signal[i] ?? 0;
      const b = signal[i + lag] ?? 0;
      cross += a * b;
      energyA += a * a;
      energyB += b * b;
    }

    const value = cross / Math.sqrt(energyA * energyB + 1e-12);
    correlation[lag] = value;

    if (lag >= minLag && lag <= maxLag && value > best) {
      best = value;
      bestLag = lag;
    }
  }

  if (extended) {
    best = -1;
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      const value = correlation[lag] ?? 0;
      if (value >= (correlation[lag - 1] ?? 0) && value > (correlation[lag + 1] ?? 0) && value > best) {
        best = value;
        bestLag = lag;
      }
    }
    if (best < 0) return { hz: 0, confidence: 0 };
  }
  let chosen = bestLag;
  for (let lag = minLag + 1; lag < bestLag; lag += 1) {
    const value = correlation[lag] ?? 0;
    if (
      value >= 0.9 * best &&
      value >= (correlation[lag - 1] ?? 0) &&
      value >= (correlation[lag + 1] ?? 0)
    ) {
      chosen = lag;
      break;
    }
  }

  const a = correlation[chosen - 1] ?? correlation[chosen] ?? 0;
  const b = correlation[chosen] ?? 0;
  const c = correlation[chosen + 1] ?? 0;
  const denominator = 2 * (2 * b - a - c);
  const delta = denominator === 0 ? 0 : (c - a) / denominator;

  return { hz: sampleRate / (chosen + delta), confidence: Math.max(0, Math.min(1, extended ? b : best)) };
}

/** Cents from a frequency to the closest reference, considering octaves. */
export function nearestCents(hz: number, references: readonly number[]): number {
  let best = Number.POSITIVE_INFINITY;

  for (const reference of references) {
    const cents = 1200 * Math.log2(hz / reference);
    if (Math.abs(cents) < Math.abs(best)) best = cents;
  }

  return best;
}
