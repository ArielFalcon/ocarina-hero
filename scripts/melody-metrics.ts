/** Note-level evaluation helpers for the audio extraction benchmark. Times are seconds. */
export interface TimedNote { readonly start: number; readonly duration: number; readonly midi: number }
export interface Alignment { readonly offset: number; readonly scale: number; readonly shift: number }

const GRID = 0.01;

/** Places a source melody (seconds from its first beat) on the recording clock. */
export function alignReference(notes: readonly TimedNote[], alignment: Alignment, clipSeconds: number): TimedNote[] {
  return notes.flatMap((note) => {
    const start = alignment.offset + note.start * alignment.scale;
    if (start >= clipSeconds - 0.05) return [];
    return [{ start, duration: Math.min(note.duration * alignment.scale, clipSeconds - start), midi: note.midi + alignment.shift }];
  });
}

function roll(notes: readonly TimedNote[], seconds: number): Float64Array {
  const frames = new Float64Array(Math.ceil(seconds / GRID)).fill(Number.NaN);
  for (const note of notes) {
    const end = Math.min(frames.length, Math.round((note.start + note.duration) / GRID));
    for (let i = Math.max(0, Math.round(note.start / GRID)); i < end; i += 1) frames[i] = note.midi;
  }
  return frames;
}

/** Counts reference notes matched once each by an estimate with equal pitch and onset within tolerance. */
export function matchNotes(reference: readonly TimedNote[], estimate: readonly TimedNote[], tolerance: number,
  same: (a: TimedNote, b: TimedNote) => boolean = (a, b) => a.midi === b.midi): number {
  const used = new Set<number>();
  let hits = 0;
  for (const note of reference) {
    let best = -1;
    estimate.forEach((candidate, index) => {
      if (used.has(index) || Math.abs(candidate.start - note.start) > tolerance || !same(note, candidate)) return;
      if (best < 0 || Math.abs(candidate.start - note.start) < Math.abs(estimate[best]!.start - note.start)) best = index;
    });
    if (best >= 0) { used.add(best); hits += 1; }
  }
  return hits;
}

function levenshtein<T>(a: readonly T[], b: readonly T[]): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length]!;
}

export interface NoteScores { f1: number; precision: number; recall: number; pitchAccuracy: number; sequence: number; octave: number }

/** Scores an estimate after the single octave shift that best matches the reference frames. */
export function scoreNotes(reference: readonly TimedNote[], estimate: readonly TimedNote[], seconds: number): NoteScores {
  const ref = roll(reference, seconds);
  let best = { accuracy: -1, octave: 0 };
  for (let octave = -3; octave <= 3; octave += 1) {
    const est = roll(estimate.map((n) => ({ ...n, midi: n.midi + 12 * octave })), seconds);
    let voiced = 0, correct = 0;
    ref.forEach((value, i) => { if (!Number.isNaN(value)) { voiced += 1; if (Math.abs(est[i]! - value) < 0.5) correct += 1; } });
    const accuracy = voiced ? correct / voiced : 0;
    if (accuracy > best.accuracy) best = { accuracy, octave };
  }
  const shifted = estimate.map((n) => ({ ...n, midi: n.midi + 12 * best.octave }));
  const hits = matchNotes(reference, shifted, 0.1);
  const precision = shifted.length ? hits / shifted.length : 0;
  const recall = reference.length ? hits / reference.length : 0;
  const longest = Math.max(reference.length, shifted.length, 1);
  return { f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0, precision, recall,
    pitchAccuracy: best.accuracy, octave: best.octave,
    sequence: 1 - levenshtein(reference.map((n) => n.midi), shifted.map((n) => n.midi)) / longest };
}

/**
 * F1 of two adapted melodies by sounding pitch, after the single global transposition that matches best.
 * Different TAB transpositions of the same tune therefore score equally.
 */
export function scoreAdapted(reference: readonly TimedNote[], estimate: readonly TimedNote[]): number {
  let hits = 0;
  for (let shift = -24; shift <= 24; shift += 1) {
    hits = Math.max(hits, matchNotes(reference, estimate.map((n) => ({ ...n, midi: n.midi + shift })), 0.1));
  }
  const precision = estimate.length ? hits / estimate.length : 0, recall = reference.length ? hits / reference.length : 0;
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
}
