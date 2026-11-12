import type { Note } from './ir';
import type { PitchId } from './pitches';

export interface ScheduledNote {
  readonly noteIndex: number;
  readonly pitch: PitchId;
  readonly bend: number;
  readonly startTime: number;
  readonly duration: number;
}

/** Shortest audible note, so a degenerate duration cannot produce a click. */
const MIN_DURATION_SECONDS = 0.05;

/**
 * Converts beats to seconds on a fixed clock.
 *
 * Kept pure and separate from Web Audio: timing is the part that must be
 * exact, and it is the only part that can be tested without a browser.
 */
export function buildSchedule(
  notes: readonly Note[],
  tempoBpm: number,
  startTime = 0,
): ScheduledNote[] {
  if (!Number.isFinite(tempoBpm) || tempoBpm <= 0) {
    throw new RangeError(`Invalid tempo: ${tempoBpm}`);
  }
  if (!Number.isFinite(startTime)) {
    throw new RangeError(`Invalid start time: ${startTime}`);
  }

  const secondsPerBeat = 60 / tempoBpm;

  return notes.map((note, noteIndex) => {
    if (!Number.isFinite(note.startBeat) || note.startBeat < 0) {
      throw new RangeError(`Invalid start beat: ${note.startBeat}`);
    }
    if (!Number.isFinite(note.durationBeats) || note.durationBeats <= 0) {
      throw new RangeError(`Invalid duration: ${note.durationBeats}`);
    }

    return {
      noteIndex,
      pitch: note.pitch,
      bend: note.bend ?? 0,
      startTime: startTime + note.startBeat * secondsPerBeat,
      duration: Math.max(note.durationBeats * secondsPerBeat, MIN_DURATION_SECONDS),
    };
  }).sort((a, b) => a.startTime - b.startTime);
}
