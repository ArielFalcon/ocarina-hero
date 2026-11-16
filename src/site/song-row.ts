import type { DifficultyLevel } from '../core/difficulty';
import { playsLabel } from '../ui/journey';
import { songPath } from '../ui/route';
import { songMeta, type SongbookEntry } from '../ui/songbook';
import type { ThreadIcon } from '../ui/thread-icons';

/** Markup of a patch icon by name; the app draws it for the active theme, the server for the default one. */
export type IconHtml = (name: ThreadIcon) => string;

export const DIFFICULTY_NAMES: Record<DifficultyLevel | '', string> = { '': 'Any', easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

/** A song seal around an already drawn icon; its tier frame is a decorative overlay outside the slot. */
export function sealMarkup(iconHtml: string, level: DifficultyLevel | '', extraClass = ''): string {
  return `<span class="song-seal${extraClass ? ` ${extraClass}` : ''}"${level ? ` data-difficulty="${level}"` : ''} aria-hidden="true">${iconHtml}${level ? '<span class="seal-frame"></span>' : ''}</span>`;
}

/** The rank count badge: rust for the top three, forest cloth after. */
export function rankHtml(rank: number): string {
  return `<span class="count-badge popular-rank${rank > 3 ? ' is-trailing' : ''}" aria-hidden="true">${rank}</span>`;
}

export function playsHtml(plays: number): string {
  const label = playsLabel(plays);
  return label ? `<span class="popular-plays">${label}</span>` : '';
}

export interface SongRowOptions {
  /** Deployment base path, which ends with a slash. */
  readonly base: string;
  readonly icon: IconHtml;
  readonly completed?: boolean;
  readonly saved?: boolean;
  /** First letter anchor of the Songbook list. */
  readonly letter?: string;
  /** Place and plays of a row of the popular ranking. */
  readonly ranked?: { readonly rank: number; readonly plays: number };
}

/** One song of a list: the link to its lesson, quick play and save. The app and the prerendered Popular page share it. */
export function songRowHtml(entry: SongbookEntry, { base, icon, completed = false, saved = false, letter, ranked }: SongRowOptions): string {
  const title = escapeHtml(entry.title);
  const rank = ranked ? rankHtml(ranked.rank) : '';
  const plays = ranked && playsLabel(ranked.plays);
  return `<article class="song-row"${letter ? ` data-letter="${escapeHtml(letter)}"` : ''}>${rank}<a class="song-open" href="${escapeHtml(songPath(base, entry.id))}" data-song="${escapeHtml(entry.id)}">${ranked ? `<span class="visually-hidden">Number ${ranked.rank}: </span>` : ''}${sealMarkup(icon(entry.icon), entry.difficulty.level)}<span class="song-copy"><span class="song-title">${title}</span><span class="song-meta">${escapeHtml(songMeta(entry))}${plays ? ` · ${plays}` : ''}${completed ? '<span class="song-done"> · Completed</span>' : ''}<span class="visually-hidden"> · ${DIFFICULTY_NAMES[entry.difficulty.level]} difficulty</span></span></span></a><button class="patch-button quick-play" type="button" data-quick-play="${escapeHtml(entry.id)}" data-title="${title}"></button><button class="save-button" type="button" data-save="${escapeHtml(entry.id)}" aria-label="${saved ? 'Remove' : 'Save'} ${title}${saved ? ' from saved songs' : ''}" aria-pressed="${saved}">${icon(saved ? 'heart-filled' : 'heart-empty')}</button></article>`;
}
