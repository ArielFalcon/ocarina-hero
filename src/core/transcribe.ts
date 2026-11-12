import { groupPitchTrack } from './pitch-track';
import { detectPitch } from './pitch-detect';
import type { MelodyNote } from './project';

export interface Transcription {
  readonly notes: readonly MelodyNote[];
  readonly tempoBpm: number;
  /** Share of frames with usable, pitch-confident voicing, 0..1; not accuracy. */
  readonly quality: number;
}

/** Extract a clear monophonic line; this does not separate instruments in a mix. */
export function transcribeAudio(samples: Float32Array, sampleRate: number): Transcription | null {
  const factor = Math.max(1, Math.floor(sampleRate / 22000));
  const data = factor === 1 ? samples : decimate(samples, factor);
  const rate = sampleRate / factor;
  const windowSize = 1024;
  const hop = 256;
  const levels: number[] = [];
  for (let offset = 0; offset + windowSize <= data.length; offset += hop) {
    let sum = 0;
    for (let i = offset; i < offset + windowSize; i++) sum += data[i]! * data[i]!;
    levels.push(Math.sqrt(sum / windowSize));
  }
  const ordered = [...levels].sort((a, b) => a - b);
  const nonzero = ordered.filter(level => level > 0);
  const reference = ordered[Math.floor(ordered.length * 0.9)] || nonzero[Math.floor(nonzero.length / 2)] || 0;
  if (reference === 0) return null;
  const background = ordered[Math.floor(ordered.length * 0.1)] ?? 0;
  const voicingThreshold = background * 2 < reference
    ? Math.min(reference * 0.03, background * 2)
    : reference * 0.03;
  const frames: { pitch: number | null; time: number }[] = [];
  let usable = 0;
  let total = 0;
  for (let offset = 0; offset + windowSize <= data.length; offset += hop) {
    const frame = data.subarray(offset, offset + windowSize);
    const rms = levels[total]!;
    const result = rms >= reference * 0.03 ? detectPitch(frame, rate, { minHz: 50, maxHz: 4000 }) : { hz: 0, confidence: 0 };
    const pitch = result.confidence >= 0.75 && result.hz >= 50 && result.hz <= 4000
      ? 69 + 12 * Math.log2(result.hz / 440) : null;
    total++;
    if (pitch !== null) usable++;
    frames.push({ pitch, time: (offset + windowSize / 2) / rate });
  }
  const originalPitches = frames.map(frame => frame.pitch);
  const firstVoiced = frames.findIndex(frame => frame.pitch !== null);
  let lastVoiced = frames.length - 1;
  while (lastVoiced > firstVoiced && frames[lastVoiced]!.pitch === null) lastVoiced--;
  for (let i = firstVoiced + 1; firstVoiced >= 0 && i < lastVoiced; i++) {
    const rms = levels[i]!;
    if (rms === 0 || rms >= reference * 0.03 || rms < voicingThreshold) continue;
    const result = detectPitch(data.subarray(i * hop, i * hop + windowSize), rate, { minHz: 50, maxHz: 4000 });
    if (result.confidence < 0.75 || result.hz < 50 || result.hz > 4000) continue;
    frames[i]!.pitch = 69 + 12 * Math.log2(result.hz / 440);
    usable++;
  }
  const step = hop / rate;
  const segments = groupPitchTrack(frames.map(f => ({ timeSeconds: f.time, frequencyHz: f.pitch === null ? 0 : 440 * 2 ** ((f.pitch - 69) / 12) })), step, data.length / rate,
    { lookbackSeconds: 6 * step, lookaheadSeconds: 3 * step, minChangeSeconds: 3 * step })
    .map(event => ({ midi: event.midi, start: event.startSeconds, end: event.startSeconds + event.durationSeconds,
      frames: event.frameCount, stable: Math.round(event.stableSeconds / step) }));
  const candidates = segments.filter(segment => {
    if (segment.frames < 3 || segment.stable < 3) return false;
    const hasOriginalSupport = originalPitches.filter((pitch, index) => pitch !== null && Math.round(pitch) === segment.midi
      && frames[index]!.time >= segment.start && frames[index]!.time < segment.end).length >= 3;
    return segment.frames >= 7 && hasOriginalSupport || hasFundamentalEnergy(data, rate, windowSize, hop, segment);
  });
  for (let i = 1; i < candidates.length; i++) {
    const left = candidates[i - 1]!, right = candidates[i]!;
    if (left.midi !== right.midi || right.start - left.end > 0.1) continue;
    const width = Math.max(1, Math.round(rate * 0.003));
    const from = Math.max(0, Math.floor((left.end - 0.025) * rate));
    const to = Math.min(data.length - width, Math.ceil((right.start + 0.025) * rate));
    const energyAt = (pos: number) => {
      let sum = 0;
      for (let j = 0; j < width; j++) sum += data[pos + j]! ** 2;
      return Math.sqrt(sum / width);
    };
    let valley = from, min = Infinity, max = 0;
    for (let pos = from; pos <= to; pos += width) {
      const level = energyAt(pos);
      if (level < min) { min = level; valley = pos; }
      max = Math.max(max, level);
    }
    const threshold = max * 0.12;
    if (min >= threshold) continue;
    let lo = valley, hi = valley;
    while (lo > from && energyAt(lo) < threshold) lo -= width;
    while (hi < to && energyAt(hi) < threshold) hi += width;
    left.end = (lo + width / 2) / rate;
    right.start = (hi + width / 2) / rate;
  }
  const notes: MelodyNote[] = candidates.map(s => ({
    midi: s.midi, startBeat: Number(s.start.toFixed(3)), durationBeats: Number((s.end - s.start).toFixed(3)),
  }));
  return notes.length ? { notes, tempoBpm: 60, quality: usable / Math.max(1, total) } : null;
}

function decimate(samples: Float32Array, factor: number): Float32Array {
  const data = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += samples[i * factor + j] ?? 0;
    data[i] = sum / factor;
  }
  return data;
}

function hasFundamentalEnergy(
  data: Float32Array,
  rate: number,
  windowSize: number,
  hop: number,
  segment: { midi: number; start: number; end: number },
): boolean {
  const frequency = 440 * 2 ** ((segment.midi - 69) / 12);
  const first = Math.max(0, Math.round((segment.start * rate - windowSize / 2 + hop / 2) / hop));
  const last = Math.min(Math.floor((data.length - windowSize) / hop), Math.round((segment.end * rate - windowSize / 2 - hop / 2) / hop));
  for (let frame = first; frame <= last; frame++) {
    let real = 0, imaginary = 0, energy = 0;
    const offset = frame * hop;
    for (let i = 0; i < windowSize; i++) {
      const value = data[offset + i]!;
      const phase = 2 * Math.PI * frequency * i / rate;
      real += value * Math.cos(phase);
      imaginary += value * Math.sin(phase);
      energy += value * value;
    }
    if (2 * (real * real + imaginary * imaginary) >= 0.04 * windowSize * energy && energy > 0) return true;
  }
  return false;
}
