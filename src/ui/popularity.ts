import type { PopularityAction } from '../server/popularity';
import { createPlayThrottle } from './play-throttle';
import { createRankingCache } from './ranking-cache';

export interface PopularEntry { id: string; plays: number }

const ENDPOINT = '/api/popularity';
const REFRESH_MS = 60_000;
/** The Vite dev server has no Functions; only built pages (production or `wrangler pages dev`) talk to the API. */
const enabled = import.meta.env.PROD;

/** Each play is one D1 upsert (two rows written); the free plan allows 100k rows a day, so repeats are held back. */
const PLAY_WINDOW_MS = 5 * 60_000;
const allowPlay = createPlayThrottle(PLAY_WINDOW_MS);

/** Report one play for the shared ranking. Fire and forget: failures never reach the player. */
export function reportPlay(song: string, action: PopularityAction): void {
  if (!enabled || !allowPlay(song, action)) return;
  fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ song, action }), keepalive: true })
    .catch(() => {});
}

/** Report a search that found no song. Fire and forget, like plays. */
export function reportMissedSearch(query: string): void {
  if (!enabled) return;
  fetch('/api/missed-searches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }), keepalive: true })
    .catch(() => {});
}

/** The ranking, refreshed at most once a minute unless forced; the last good list, or none, when the API fails. */
const cachedRanking = createRankingCache(async (): Promise<PopularEntry[]> => {
  const response = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(String(response.status));
  const { songs } = await response.json() as { songs?: unknown };
  return Array.isArray(songs)
    ? songs.flatMap(song => typeof song?.id === 'string' ? [{ id: song.id as string, plays: Number.isFinite(song.plays) ? Number(song.plays) : 0 }] : [])
    : [];
}, REFRESH_MS);

export async function loadPopular(options: { force?: boolean } = {}): Promise<PopularEntry[]> {
  return enabled ? cachedRanking(options) : [];
}
