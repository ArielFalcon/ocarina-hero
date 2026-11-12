/**
 * Basic Pitch (spotify/basic-pitch v0.4.0, ICASSP 2022 model) framing and melody extraction.
 *
 * The model itself is injected as `BasicPitchModel` so the same code runs in the browser
 * (onnxruntime-web, see src/audio/basic-pitch-model.ts) and in Node benchmarks.
 */
import { DEFAULT_DECODER, MIDI_LOW, decodeMelody, emptyGrid, type DecoderParameters, type PitchGrid } from './melody-decoder';
import type { MelodyNote } from './project';

export const BASIC_PITCH_RATE = 22050;
const HOP = 256;
const FPS = Math.floor(BASIC_PITCH_RATE / HOP);
export const BASIC_PITCH_WINDOW_SAMPLES = BASIC_PITCH_RATE * 2 - HOP;
export const BASIC_PITCH_WINDOW_FRAMES = FPS * 2;
const OVERLAP_FRAMES = 30;
const LOWEST_MIDI = 21;
const KEYS = 88;
export const BASIC_PITCH_HOP_SECONDS = HOP / BASIC_PITCH_RATE;

/** Runs the model on one (1, BASIC_PITCH_WINDOW_SAMPLES, 1) window; returns frame-major (frames × 88) posteriors. */
export type BasicPitchModel = (window: Float32Array) => Promise<{ notes: Float32Array; onsets: Float32Array }>;

/** Band-limited resampling with a Blackman-windowed sinc; anti-aliased when downsampling. */
export function resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples.slice();
  const ratio = toRate / fromRate;
  const length = Math.floor(samples.length * ratio);
  const out = new Float32Array(length);
  const cutoff = Math.min(1, ratio) * 0.97;
  const zeros = 16;
  const half = Math.ceil(zeros / cutoff);
  for (let i = 0; i < length; i++) {
    const center = i / ratio;
    const first = Math.ceil(center - half);
    const last = Math.floor(center + half);
    let sum = 0;
    for (let k = Math.max(0, first); k <= Math.min(samples.length - 1, last); k++) {
      const x = k - center;
      const t = x * cutoff;
      const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
      const w = 0.42 + 0.5 * Math.cos(Math.PI * x / half) + 0.08 * Math.cos(2 * Math.PI * x / half);
      sum += samples[k]! * cutoff * sinc * w;
    }
    out[i] = sum;
  }
  return out;
}

export interface BasicPitchFrames { readonly times: Float64Array; readonly notes: PitchGrid; readonly onsets: PitchGrid }

/** Runs Basic Pitch over overlapping windows of 22.05 kHz mono audio and stitches the posteriors onto decoder rows. */
export async function basicPitchFrames(model: BasicPitchModel, audio: Float32Array): Promise<BasicPitchFrames> {
  const overlap = OVERLAP_FRAMES * HOP;
  const step = BASIC_PITCH_WINDOW_SAMPLES - overlap;
  const padded = new Float32Array(overlap / 2 + audio.length);
  padded.set(audio, overlap / 2);
  const half = OVERLAP_FRAMES / 2;
  const kept = BASIC_PITCH_WINDOW_FRAMES - 2 * half;
  const count = Math.floor(audio.length * FPS / BASIC_PITCH_RATE);
  const notes = emptyGrid(count);
  const onsets = emptyGrid(count);
  const states = notes.values.length / Math.max(1, count);
  let frame = 0;
  for (let start = 0; start < padded.length && frame < count; start += step) {
    const window = new Float32Array(BASIC_PITCH_WINDOW_SAMPLES);
    window.set(padded.subarray(start, start + BASIC_PITCH_WINDOW_SAMPLES));
    const output = await model(window);
    for (let j = half; j < half + kept && frame < count; j++, frame++) {
      for (let s = 0; s < states; s++) {
        const key = s + MIDI_LOW - LOWEST_MIDI;
        if (key < 0 || key >= KEYS) continue;
        notes.values[frame * states + s] = output.notes[j * KEYS + key]!;
        onsets.values[frame * states + s] = output.onsets[j * KEYS + key]!;
      }
    }
  }
  // Basic Pitch's per-window timing correction (basic_pitch/inference.py, v0.4.0).
  const offset = BASIC_PITCH_HOP_SECONDS * (BASIC_PITCH_WINDOW_FRAMES - BASIC_PITCH_WINDOW_SAMPLES / HOP) + 0.0018;
  const times = new Float64Array(count);
  for (let i = 0; i < count; i++) times[i] = i * BASIC_PITCH_HOP_SECONDS - offset * Math.floor(i / BASIC_PITCH_WINDOW_FRAMES);
  return { times, notes, onsets };
}

export interface BasicPitchTranscription {
  readonly notes: readonly MelodyNote[];
  /** Share of frames on the decoded melody path, 0..1; not accuracy. */
  readonly voicedFrameFraction: number;
}

/** Extracts the melody line of a mono clip: notes in seconds on the input clock. */
export async function transcribeWithBasicPitch(samples: Float32Array, sampleRate: number, model: BasicPitchModel,
  parameters: DecoderParameters = DEFAULT_DECODER): Promise<BasicPitchTranscription> {
  const frames = await basicPitchFrames(model, resample(samples, sampleRate, BASIC_PITCH_RATE));
  return decodeFrames(frames, samples.length / sampleRate, parameters);
}

/** Decodes stitched posteriors; separated from inference so benchmarks can reuse cached model output. */
export function decodeFrames(frames: BasicPitchFrames, durationSeconds: number, parameters: DecoderParameters = DEFAULT_DECODER): BasicPitchTranscription {
  const { times } = frames;
  const decoded = decodeMelody(frames.notes, frames.onsets, BASIC_PITCH_HOP_SECONDS, parameters);
  const edge = (frame: number) => frame < times.length ? Math.max(0, times[frame]!) : Math.min(durationSeconds, times[times.length - 1]! + BASIC_PITCH_HOP_SECONDS);
  const notes = decoded.map(note => {
    const start = edge(note.startFrame);
    return { midi: note.midi, startBeat: start, durationBeats: Math.max(0, edge(note.endFrame) - start) };
  }).filter(note => note.durationBeats > 0);
  const voiced = decoded.reduce((sum, note) => sum + note.endFrame - note.startFrame, 0);
  return { notes, voicedFrameFraction: voiced / Math.max(1, times.length) };
}
