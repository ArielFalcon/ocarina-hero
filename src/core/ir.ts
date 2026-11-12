import type { PitchId } from './pitches';

/**
 * Canonical representation. Pitches, optional bend and beats only: buttons are
 * a render layer, so a control-scheme change never touches stored songs.
 */
export interface Note {
  readonly pitch: PitchId;
  /** Semitones of pitch bend applied to the note, -2..2. */
  readonly bend?: number;
  readonly startBeat: number;
  readonly durationBeats: number;
}

export interface Arrangement {
  readonly title: string;
  readonly tempoBpm: number;
  readonly notes: readonly Note[];
}
