import { lastOpened, type Progress, type SongProgress } from './progress';

interface Song { readonly id: string }

export const POPULAR_SHOWN = 20;

export interface Journey<T extends Song> {
  /** The last opened song, with its progress; null before any lesson was opened. */
  readonly resume: { readonly entry: T; readonly progress: SongProgress } | null;
  /** The shared ranking, limited to songs still in the catalogue. */
  readonly popular: readonly { readonly entry: T; readonly plays: number }[];
}

/** The Songbook's side panel: where this player left off and what everyone plays most. */
export function journey<T extends Song>(entries: readonly T[], progress: Progress, ranking: readonly { id: string; plays: number }[]): Journey<T> {
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const resumeId = lastOpened(progress, new Set(byId.keys()));
  const resumeEntry = resumeId === null ? undefined : byId.get(resumeId);
  const seen = new Set<string>();
  const popular = ranking.flatMap(({ id, plays }) => {
    const entry = byId.get(id);
    if (!entry || seen.has(id)) return [];
    seen.add(id);
    return [{ entry, plays }];
  }).slice(0, POPULAR_SHOWN);
  return {
    resume: resumeEntry ? { entry: resumeEntry, progress: progress[resumeEntry.id]! } : null,
    popular,
  };
}

/** "1 play", "15 plays", "1.2K plays"; null before the first play. */
export function playsLabel(plays: number): string | null {
  if (plays <= 0) return null;
  if (plays === 1) return '1 play';
  return `${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(plays)} plays`;
}
