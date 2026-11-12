import type { MelodyNote } from './project';

export interface SimplifyResult {
  readonly notes: MelodyNote[];
  readonly removed: number;
}

/** A note is decorative when it is far shorter than its neighbours. */
const SHORT_RATIO = 0.35;

/** Window used to find the local reference duration. */
const REFERENCE_WINDOW = 3;

/** Two notes belong to the same ornament when they are practically contiguous. */
const CONTIGUOUS_GAP = 0.12;

/** Stepwise approach into the target, in semitones. */
const STEP_LIMIT = 2;

/** Gap left between notes after reflowing, in beats. */
const ARTICULATION = 0.06;

/** Gaps longer than this are phrase breaks and stay silent. */
const MAX_FILL = 1.5;

function isContiguous(a: MelodyNote, b: MelodyNote): boolean {
  return b.startBeat - (a.startBeat + a.durationBeats) < CONTIGUOUS_GAP;
}

/**
 * Removes ornaments that a sequenced transcription wrote as very short notes.
 *
 * This is the difference between "every note in the file" and "the melody a
 * person plays". Three rules, applied by shape rather than by song:
 *
 * 1. Two contiguous short notes leading into a longer one are a slide: they
 *    are dropped, in either direction. This is the G-A before the repeated
 *    B-D-A in Zelda's Lullaby, and the C-B that slides into the A.
 * 2. A short run that alternates between two pitches is a trill: it collapses
 *    to its first note, holding the run's span.
 * 3. Any other short run (three or more distinct pitches) is a real fast
 *    passage and is left untouched.
 *
 * A single short note is always kept: it may simply be a short note.
 */
export function simplifyMelody(notes: readonly MelodyNote[]): SimplifyResult {
  if (notes.length < 3) return { notes: [...notes], removed: 0 };

  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  const reference = sorted.map((note, index) => {
    let max = note.durationBeats;
    for (let i = Math.max(0, index - REFERENCE_WINDOW); i <= Math.min(sorted.length - 1, index + REFERENCE_WINDOW); i += 1) {
      max = Math.max(max, sorted[i]?.durationBeats ?? 0);
    }
    return max;
  });

  const short = sorted.map(
    (note, index) => note.durationBeats < SHORT_RATIO * (reference[index] ?? note.durationBeats),
  );

  const kept: MelodyNote[] = [];
  let removed = 0;
  let index = 0;

  while (index < sorted.length) {
    const note = sorted[index];
    if (!note || !short[index]) {
      if (note) kept.push(note);
      index += 1;
      continue;
    }

    // Collect the contiguous run of short notes.
    let end = index;
    while (
      end + 1 < sorted.length &&
      short[end + 1] &&
      sorted[end] &&
      isContiguous(sorted[end] as MelodyNote, sorted[end + 1] as MelodyNote)
    ) {
      end += 1;
    }

    const run = sorted.slice(index, end + 1);
    const next = sorted[end + 1];
    const size = run.length;
    const distinct = new Set(run.map((item) => item.midi % 12)).size;

    if (size === 1) {
      kept.push(run[0] as MelodyNote);
    } else if (size === 2 && next && isAscendingPickup(run, next)) {
      removed += size;
    } else if (size >= 3 && distinct <= 2) {
      const first = run[0] as MelodyNote;
      const last = run[run.length - 1] as MelodyNote;
      const span = last.startBeat + last.durationBeats - first.startBeat;
      kept.push({ midi: first.midi, startBeat: first.startBeat, durationBeats: span });
      removed += size - 1;
    } else {
      kept.push(...run);
    }

    index = end + 1;
  }

  return { notes: kept, removed };
}

function isAscendingPickup(run: readonly MelodyNote[], target: MelodyNote): boolean {
  const first = run[0];
  if (!first) return false;

  const chain = [...run.map((note) => note.midi), target.midi];
  for (let i = 1; i < chain.length; i += 1) {
    const step = (chain[i] ?? 0) - (chain[i - 1] ?? 0);
    if (step < 1 || step > STEP_LIMIT) return false;
  }
  return true;
}

/**
 * Sustains each note up to the next one.
 *
 * Sequenced transcriptions write notes shorter than their slot, so the melody
 * plays with a gap on every note and can sound like a machine. Reflowing keeps
 * the rhythm but removes those holes, leaving only a small articulation gap.
 * Real phrase breaks (a long gap) stay silent.
 */
export function reflowMelody(notes: readonly MelodyNote[]): MelodyNote[] {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);

  return sorted.map((note, index) => {
    const next = sorted[index + 1];
    if (!next) return note;

    const gap = next.startBeat - (note.startBeat + note.durationBeats);
    if (gap > MAX_FILL) return note;

    return {
      ...note,
      durationBeats: Math.max(next.startBeat - note.startBeat - ARTICULATION, 0.1),
    };
  });
}
