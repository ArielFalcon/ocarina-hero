import type { Arrangement, Note } from '../core/ir';
import { pitchById, type ControllerButton } from '../core/pitches';
import { toTabPhrases, toTabRestGroups } from '../core/tab';

/** Divide source groups into display windows without changing the arrangement. */
export function createPassages(
  notes: readonly Note[],
  tempoBpm: number,
  phraseStarts?: readonly number[],
  maxNotes = 5,
): number[][] {
  if (!Number.isInteger(maxNotes) || maxNotes <= 0) {
    throw new RangeError(`Invalid maximum notes: ${maxNotes}`);
  }
  if (!notes.length) return [];

  const starts = phraseStarts?.length
    ? [...new Set([0, ...phraseStarts])].filter(start => Number.isInteger(start) && start >= 0 && start < notes.length).sort((a, b) => a - b)
    : undefined;
  const groups = starts ? toTabPhrases(notes, starts) : toTabRestGroups(notes, tempoBpm);
  const passages: number[][] = [];
  for (const group of groups) {
    for (let offset = 0; offset < group.tokens.length; offset += maxNotes) {
      passages.push(group.tokens.slice(offset, offset + maxNotes).map(token => token.noteIndex));
    }
  }
  return passages;
}

/** Advance at most one note when the complete controller gesture matches. */
export function advancePractice(notes: readonly Note[], cursor: number, button: ControllerButton, bend: number): number {
  const expected = notes[cursor];
  return expected && pitchById(expected.pitch).button === button && (expected.bend ?? 0) === bend
    ? cursor + 1
    : cursor;
}

/** Keep the timing within a passage while moving its first onset to beat zero. */
export function passageArrangement(arrangement: Arrangement, indices: readonly number[]): Arrangement {
  const selected = indices.map(index => arrangement.notes[index]!);
  const startBeat = selected[0]?.startBeat ?? 0;
  return {
    ...arrangement,
    notes: selected.map(note => ({ ...note, startBeat: note.startBeat - startBeat })),
  };
}

/** A passage is a display window; only explicit repeat limits playback to it. */
export function playbackSelection(arrangement: Arrangement, passage: readonly number[], cursor: number, repeat: boolean): { indices: number[]; arrangement: Arrangement } {
  const all = arrangement.notes.map((_, index) => index);
  const available = repeat && passage.length ? [...passage] : all;
  const offset = available.indexOf(cursor);
  const indices = offset >= 0 ? available.slice(offset) : available;
  return { indices, arrangement: !repeat && offset <= 0 ? arrangement : passageArrangement(arrangement, indices) };
}

export type StaffTransition = 'enter' | 'reflow' | 'forward' | 'backward';

/** Choose how the staff moves between two rendered windows of the same or another song. */
export function staffTransition(
  previous: { song: unknown; indices: readonly number[] } | null,
  next: { song: unknown; indices: readonly number[] },
): StaffTransition {
  if (!previous || previous.song !== next.song) return 'enter';
  const from = previous.indices[0] ?? 0;
  const to = next.indices[0] ?? 0;
  if (from === to) return 'reflow';
  return to > from ? 'forward' : 'backward';
}
