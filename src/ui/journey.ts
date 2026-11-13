import { nextSong } from './featured';
import { completedIds, lastOpened, type Progress, type SongProgress } from './progress';

interface Song { readonly id: string; readonly difficulty: { readonly level: string } }

export const JOURNEY_SAVED_LIMIT = 3;

export interface Journey<T extends Song> {
  /** The last opened song, with its progress; null before any lesson was opened. */
  readonly resume: { readonly entry: T; readonly progress: SongProgress } | null;
  /** The next not yet completed song after the resumed one. */
  readonly next: T | null;
  readonly completed: number;
  readonly total: number;
  /** The first saved songs, in catalogue order. */
  readonly saved: readonly T[];
  readonly savedCount: number;
}

/** The Songbook's side panel: where the player left off and what comes next, from local progress only. */
export function journey<T extends Song>(entries: readonly T[], progress: Progress, savedIds: ReadonlySet<string>): Journey<T> {
  const known = new Set(entries.map(entry => entry.id));
  const completed = completedIds(progress);
  const resumeId = lastOpened(progress, known);
  const resumeEntry = resumeId === null ? undefined : entries.find(entry => entry.id === resumeId);
  const saved = entries.filter(entry => savedIds.has(entry.id));
  return {
    resume: resumeEntry ? { entry: resumeEntry, progress: progress[resumeEntry.id]! } : null,
    next: resumeEntry ? nextSong(entries, resumeEntry.id, completed) : null,
    completed: entries.filter(entry => completed.has(entry.id)).length,
    total: entries.length,
    saved: saved.slice(0, JOURNEY_SAVED_LIMIT),
    savedCount: saved.length,
  };
}

/** A first visit: nothing opened, completed or saved yet. */
export function isEmptyJourney(value: Journey<Song>): boolean {
  return value.resume === null && value.completed === 0 && value.savedCount === 0;
}
