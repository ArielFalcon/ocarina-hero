/**
 * Monophonic melody decoding from Basic Pitch note posteriors.
 *
 * TypeScript counterpart of the Basic Pitch part of `scripts/melody_decoder.py`. Posteriors are used
 * as absolute probabilities (never normalized per clip), with a mild preference for higher voices.
 * A Viterbi pass finds one path that penalizes pitch changes and voicing switches. Notes shorter
 * than a minimum that follows the fragment's onset rate are then absorbed or removed, and held
 * notes are split where Basic Pitch reports a strong new onset of the same pitch.
 * Parameters were chosen on `scripts/instrument-benchmark.ts`; see docs/transcription.md.
 */

export const MIDI_LOW = 36;
export const MIDI_HIGH = 96;
const STATES = MIDI_HIGH - MIDI_LOW + 1;

export interface DecoderParameters {
  /** Multiplier of the note posterior in the voiced emission. */
  readonly scale: number;
  /** Relative preference per semitone above MIDI 60, floored at zero and normalized so it never exceeds 1 (it ranks pitches, never voicing). */
  readonly heightBias: number;
  /** Multiplier of (1 - strongest posterior) in the unvoiced emission. */
  readonly silence: number;
  readonly changePenalty: number;
  readonly distancePenalty: number;
  readonly voicingPenalty: number;
  /** Default and upper bound of the minimum note duration. */
  readonly minNoteSeconds: number;
  readonly minNoteFloorSeconds: number;
  /** Minimum duration = this fraction of the mean onset spacing while a note sounds. */
  readonly onsetSpacingFraction: number;
  readonly onsetThreshold: number;
  readonly onsetMinSpacingSeconds: number;
  readonly activeNoteThreshold: number;
  /** Onset posterior of the held pitch that splits a note into a repeat; above 1 disables splitting. */
  readonly repeatOnsetThreshold: number;
}

export const DEFAULT_DECODER: DecoderParameters = {
  scale: 2,
  heightBias: 0.04,
  silence: 0.5,
  changePenalty: 2,
  distancePenalty: 0.05,
  voicingPenalty: 2,
  minNoteSeconds: 0.06,
  minNoteFloorSeconds: 0.04,
  onsetSpacingFraction: 0.5,
  onsetThreshold: 0.5,
  onsetMinSpacingSeconds: 0.05,
  activeNoteThreshold: 0.3,
  repeatOnsetThreshold: 0.7,
};

const SCORE_FLOOR = 1e-4;

/** Semitone-by-frame posteriors: `values[frame * STATES + (midi - MIDI_LOW)]`. */
export interface PitchGrid { readonly frames: number; readonly values: Float32Array }

export function emptyGrid(frames: number): PitchGrid {
  return { frames, values: new Float32Array(frames * STATES) };
}

function at(grid: PitchGrid, frame: number, state: number): number {
  return grid.values[frame * STATES + state]!;
}

/** Returns the most likely state per frame: -1 for unvoiced, else the MIDI offset from MIDI_LOW. */
function viterbi(notes: PitchGrid, parameters: DecoderParameters): Int32Array {
  const { frames } = notes;
  const path = new Int32Array(frames).fill(-1);
  if (frames === 0) return path;
  const all = STATES + 1;
  const top = Math.max(0, 1 + parameters.heightBias * (MIDI_HIGH - 60));
  const bias = Float64Array.from({ length: STATES }, (_, s) => top > 0 ? Math.max(0, 1 + parameters.heightBias * (s + MIDI_LOW - 60)) / top : 1);
  const emission = (frame: number, out: Float64Array) => {
    let strongest = 0;
    for (let s = 0; s < STATES; s++) strongest = Math.max(strongest, at(notes, frame, s));
    out[0] = Math.log(parameters.silence * Math.min(1, Math.max(0, 1 - strongest)) + SCORE_FLOOR);
    for (let s = 0; s < STATES; s++) out[s + 1] = Math.log(parameters.scale * bias[s]! * at(notes, frame, s) + SCORE_FLOOR);
  };
  const back = new Int16Array(frames * all);
  let total = new Float64Array(all);
  let next = new Float64Array(all);
  const e = new Float64Array(all);
  emission(0, total);
  for (let j = 1; j < frames; j++) {
    emission(j, e);
    // Best voiced predecessor overall, used for the distance-penalized pitch change.
    for (let to = 0; to < all; to++) {
      let best = -Infinity;
      let from = 0;
      for (let k = 0; k < all; k++) {
        let transition: number;
        if (k === 0 && to === 0) transition = 0;
        else if (k === 0 || to === 0) transition = -parameters.voicingPenalty;
        else if (k === to) transition = 0;
        else transition = -parameters.changePenalty - parameters.distancePenalty * Math.abs(k - to);
        const candidate = total[k]! + transition;
        if (candidate > best) { best = candidate; from = k; }
      }
      next[to] = best + e[to]!;
      back[j * all + to] = from;
    }
    [total, next] = [next, total];
  }
  let state = 0;
  for (let k = 1; k < all; k++) if (total[k]! > total[state]!) state = k;
  for (let j = frames - 1; j >= 0; j--) {
    path[j] = state - 1;
    if (j > 0) state = back[j * all + state]!;
  }
  return path;
}

interface Run { state: number; start: number; end: number }

function runs(path: Int32Array): Run[] {
  const out: Run[] = [];
  let start = 0;
  for (let i = 1; i <= path.length; i++) {
    if (i === path.length || path[i] !== path[start]) { out.push({ state: path[start]!, start, end: i }); start = i; }
  }
  return out;
}

/** Absorbs voiced runs shorter than minFrames into the longer touching voiced neighbour, else unvoices them. */
export function enforceMinimum(input: Int32Array, minFrames: number): Int32Array {
  const path = input.slice();
  for (;;) {
    const list = runs(path);
    let shortest = -1;
    list.forEach((run, i) => {
      if (run.state >= 0 && run.end - run.start < minFrames
        && (shortest < 0 || run.end - run.start < list[shortest]!.end - list[shortest]!.start)) shortest = i;
    });
    if (shortest < 0) return path;
    const run = list[shortest]!;
    const neighbours = [list[shortest - 1], list[shortest + 1]].filter((r): r is Run => r !== undefined && r.state >= 0);
    // On equal length the earlier neighbour wins, as in the Python decoder.
    const target = neighbours.reduce<Run | undefined>((best, r) => (!best || r.end - r.start > best.end - best.start ? r : best), undefined);
    path.fill(target ? target.state : -1, run.start, run.end);
  }
}

/** Indices of local maxima at or above `height`, thinned so kept peaks are at least `distance` frames apart (taller first). */
export function findPeaks(values: Float32Array | Float64Array, height: number, distance: number): number[] {
  const candidates: number[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i]! < height || values[i]! <= values[i - 1]!) continue;
    let j = i + 1;
    while (j < values.length - 1 && values[j] === values[i]) j++;
    if (values[j]! < values[i]!) candidates.push(Math.floor((i + j - 1) / 2));
    i = j - 1;
  }
  if (distance <= 1) return candidates;
  const keep = new Set(candidates);
  for (const peak of [...candidates].sort((a, b) => values[b]! - values[a]! || b - a)) {
    if (!keep.has(peak)) continue;
    for (const other of candidates) if (other !== peak && Math.abs(other - peak) < distance) keep.delete(other);
  }
  return candidates.filter(peak => keep.has(peak));
}

/** Minimum note duration: a fraction of the mean onset spacing while a note sounds, within the configured bounds. */
export function minimumNoteSeconds(onsets: PitchGrid, notes: PitchGrid, hopSeconds: number, parameters: DecoderParameters = DEFAULT_DECODER): number {
  if (onsets.frames === 0) return parameters.minNoteSeconds;
  const strongest = new Float64Array(onsets.frames);
  let sounding = 0;
  for (let j = 0; j < onsets.frames; j++) {
    let onset = 0;
    let note = 0;
    for (let s = 0; s < STATES; s++) { onset = Math.max(onset, at(onsets, j, s)); note = Math.max(note, at(notes, j, s)); }
    strongest[j] = onset;
    if (note > parameters.activeNoteThreshold) sounding++;
  }
  const peaks = findPeaks(strongest, parameters.onsetThreshold, Math.max(1, Math.floor(parameters.onsetMinSpacingSeconds / hopSeconds)));
  const rate = peaks.length / Math.max(1, sounding * hopSeconds);
  if (rate <= 0) return parameters.minNoteSeconds;
  return Math.min(parameters.minNoteSeconds, Math.max(parameters.minNoteFloorSeconds, parameters.onsetSpacingFraction / rate));
}

export interface DecodedNote { readonly midi: number; readonly startFrame: number; readonly endFrame: number }

/** Splits held notes where the onset posterior of their own pitch peaks above the repeat threshold. */
function splitRepeats(notes: DecodedNote[], onsets: PitchGrid, minFrames: number, threshold: number): DecodedNote[] {
  if (threshold > 1) return notes;
  return notes.flatMap(note => {
    const state = note.midi - MIDI_LOW;
    const own = new Float64Array(note.endFrame - note.startFrame);
    for (let j = note.startFrame; j < note.endFrame; j++) own[j - note.startFrame] = at(onsets, j, state);
    const cuts = findPeaks(own, threshold, minFrames).map(p => p + note.startFrame)
      .filter(cut => cut - note.startFrame >= minFrames && note.endFrame - cut >= minFrames);
    const bounds = [note.startFrame, ...cuts, note.endFrame];
    return bounds.slice(1).map((end, i) => ({ midi: note.midi, startFrame: bounds[i]!, endFrame: end }));
  });
}

/** Decodes one melody line from note and onset posteriors on a uniform frame clock. */
export function decodeMelody(notes: PitchGrid, onsets: PitchGrid, hopSeconds: number, parameters: DecoderParameters = DEFAULT_DECODER): DecodedNote[] {
  if (notes.frames === 0) return [];
  const minSeconds = minimumNoteSeconds(onsets, notes, hopSeconds, parameters);
  const minFrames = Math.max(1, Math.round(minSeconds / hopSeconds));
  const path = enforceMinimum(viterbi(notes, parameters), minFrames);
  const decoded = runs(path).filter(run => run.state >= 0)
    .map(run => ({ midi: run.state + MIDI_LOW, startFrame: run.start, endFrame: run.end }));
  return splitRepeats(decoded, onsets, minFrames, parameters.repeatOnsetThreshold);
}
