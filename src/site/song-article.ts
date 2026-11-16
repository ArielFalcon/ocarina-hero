import type { DifficultyLevel } from '../core/difficulty';
import { songPath } from '../ui/route';
import { hubName, hubPath } from './hubs';
import { escapeHtml, type SongLink } from './song-pages';

/** What a song page states in words below the player. */
export interface SongArticle {
  readonly title: string;
  readonly universe: string;
  readonly version?: string;
  readonly noteCount: number;
  readonly passageCount: number;
  readonly difficulty: DifficultyLevel;
  /** Button tab of the arrangement shown. */
  readonly tab: string;
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** One factual line built only from the song's own data. */
export function songSummary(song: SongArticle): string {
  const level = song.difficulty[0]!.toUpperCase() + song.difficulty.slice(1);
  return `${song.title}${song.version ? ` (${song.version})` : ''} from ${song.universe}: ${plural(song.noteCount, 'note')} in ${plural(song.passageCount, 'passage')}, ${level} difficulty.`;
}

/** Related songs shown as cards before the rest fold away under "Show N more". */
export const RELATED_SHOWN = 6;

/**
 * The visible content of a song page: its text tab, a summary and the other songs of its universe.
 * It sits folded under one disclosure, so the lesson stays a single screen on a phone; the text is still
 * in the page for search engines, which read folded content like open content.
 * The page renders it on the server; the app renders it again with the same function when another song opens.
 * `base` is the deployment base path, which ends with a slash.
 */
export function songArticleHtml(song: SongArticle, related: readonly SongLink[], base: string): string {
  const card = (link: SongLink) => `<li><a class="song-card" href="${escapeHtml(songPath(base, link.id))}" data-song-link="${escapeHtml(link.id)}"><span class="song-card-title">${escapeHtml(link.title)}</span><span class="song-card-meta">${escapeHtml(link.meta)}</span></a></li>`;
  const cards = (links: readonly SongLink[]) => `<ul class="song-cards">${links.map(card).join('')}</ul>`;
  const rest = related.slice(RELATED_SHOWN);
  const more = related.length
    ? `<h2 class="stitched-label">More ${escapeHtml(song.universe)} songs</h2>${cards(related.slice(0, RELATED_SHOWN))}`
      + (rest.length ? `<details class="song-cards-more"><summary>Show ${rest.length} more</summary>${cards(rest)}</details>` : '')
    : '';
  const hint = related.length ? `Button tab and ${plural(related.length, 'related song')}` : 'Button tab';
  return `<details class="song-about"><summary><span class="song-about-title">About this song</span><span class="song-about-hint">${hint}</span></summary><div class="song-about-body">`
    + `<h2 class="stitched-label">Ocarina tab</h2><p class="song-summary">${escapeHtml(songSummary(song))}</p><p id="tab-text" class="tab-text">${escapeHtml(song.tab)}</p>${more}`
    + `<p class="song-home"><a href="${escapeHtml(base + hubPath(song.universe))}">All ${escapeHtml(hubName(song.universe))}</a> · <a href="${escapeHtml(base)}" data-view-link="catalog">Every song in the Ocarina Hero songbook</a></p></div></details>`;
}
