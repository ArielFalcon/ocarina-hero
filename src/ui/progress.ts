export const PROGRESS_STORAGE = 'ocarina.progress.v1';

export interface SongProgress {
  readonly completed: boolean;
  readonly bestCombo: number;
  /** Epoch milliseconds of the last time the lesson was opened; 0 when it never was. */
  readonly openedAt: number;
}

export type Progress = Readonly<Record<string, SongProgress>>;

const NEW_SONG: SongProgress = { completed: false, bestCombo: 0, openedAt: 0 };

function isSongProgress(value: unknown): value is SongProgress {
  if (typeof value !== 'object' || value === null) return false;
  const { completed, bestCombo, openedAt } = value as Record<string, unknown>;
  return typeof completed === 'boolean'
    && typeof bestCombo === 'number' && bestCombo >= 0
    && typeof openedAt === 'number' && openedAt >= 0;
}

export function readProgress(stored: unknown): Progress {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
  return Object.fromEntries(Object.entries(stored).filter(([, song]) => isSongProgress(song)));
}

export function markOpened(progress: Progress, id: string, now: number): Progress {
  return { ...progress, [id]: { ...(progress[id] ?? NEW_SONG), openedAt: now } };
}

/** Returns the same object when the attempt neither finishes the song nor beats its best combo. */
export function markPractice(progress: Progress, id: string, attempt: { finished: boolean; bestCombo: number }): Progress {
  const song = progress[id] ?? NEW_SONG;
  const completed = song.completed || attempt.finished;
  const bestCombo = Math.max(song.bestCombo, attempt.bestCombo);
  if (progress[id] && completed === song.completed && bestCombo === song.bestCombo) return progress;
  return { ...progress, [id]: { ...song, completed, bestCombo } };
}

export function lastOpened(progress: Progress, knownIds: ReadonlySet<string>): string | null {
  const opened = Object.entries(progress).filter(([id, song]) => song.openedAt > 0 && knownIds.has(id));
  return opened.sort(([, a], [, b]) => b.openedAt - a.openedAt)[0]?.[0] ?? null;
}

export function completedIds(progress: Progress): Set<string> {
  return new Set(Object.keys(progress).filter(id => progress[id]!.completed));
}
