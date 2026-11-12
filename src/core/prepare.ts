import type { Note } from './ir';
import { projectMelody, type MelodyNote, type Projection } from './project';
import { reflowMelody, simplifyMelody } from './simplify';

export function prepareMelody(
  source: { melody: readonly MelodyNote[]; fixedNotes?: readonly Note[]; preserveTiming?: boolean },
  options: { simplify: boolean; maxBend: number },
): { notes: Note[]; removed: number; projection?: Projection } {
  if (source.fixedNotes !== undefined) {
    return { notes: source.fixedNotes.map((note) => ({ ...note })), removed: 0 };
  }

  if (source.preserveTiming || !options.simplify) {
    const projection = projectMelody(source.melody, { maxBend: options.maxBend });
    return { notes: projection.notes, removed: 0, projection };
  }

  const simplified = simplifyMelody(source.melody);
  const projection = projectMelody(reflowMelody(simplified.notes), { maxBend: options.maxBend });
  return { notes: projection.notes, removed: simplified.removed, projection };
}
