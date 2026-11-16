import type { Note } from './ir';
import { BEND_LIMIT, SWITCH2_TUNING, pitchById, type TuningProfile } from './pitches';
import { projectMelody, type MelodyNote, type Projection } from './project';
import { reflowMelody, simplifyMelody } from './simplify';

const sounding = (note: Note): number => pitchById(note.pitch).midi + (note.bend ?? 0);

/**
 * Stored arrangements carry the Switch 2 fingering. Another console takes its own fingering of the
 * melody when every note keeps its sounding pitch and timing; a hand-made arrangement that differs
 * from the melody's projection keeps its notes.
 */
function fixedNotesFor(melody: readonly MelodyNote[], fixed: readonly Note[], tuning: TuningProfile): readonly Note[] {
  if (tuning === SWITCH2_TUNING || melody.length !== fixed.length) return fixed;
  const own = projectMelody(melody, { maxBend: BEND_LIMIT, tuning }).notes;
  const same = own.every((note, i) => {
    const stored = fixed[i]!;
    return sounding(note) === sounding(stored) && note.startBeat === stored.startBeat && note.durationBeats === stored.durationBeats;
  });
  return same ? own : fixed;
}

export function prepareMelody(
  source: { melody: readonly MelodyNote[]; fixedNotes?: readonly Note[]; preserveTiming?: boolean },
  options: { simplify: boolean; maxBend: number; tuning?: TuningProfile },
): { notes: Note[]; removed: number; projection?: Projection } {
  if (source.fixedNotes !== undefined) {
    const notes = fixedNotesFor(source.melody, source.fixedNotes, options.tuning ?? SWITCH2_TUNING);
    return { notes: notes.map((note) => ({ ...note })), removed: 0 };
  }

  if (source.preserveTiming || !options.simplify) {
    const projection = projectMelody(source.melody, { maxBend: options.maxBend, tuning: options.tuning });
    return { notes: projection.notes, removed: 0, projection };
  }

  const simplified = simplifyMelody(source.melody);
  const projection = projectMelody(reflowMelody(simplified.notes), { maxBend: options.maxBend, tuning: options.tuning });
  return { notes: projection.notes, removed: simplified.removed, projection };
}
