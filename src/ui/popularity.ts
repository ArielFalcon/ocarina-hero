import type { PopularityAction } from '../server/popularity';
import { POPULAR_SEED } from '../core/popular-seed';

export interface PopularEntry { id: string; plays: number }

const ENDPOINT = '/api/popularity';
const REFRESH_MS = 60_000;
/** The Vite dev server has no Functions; only built pages (production or `wrangler pages dev`) talk to the API. */
const enabled = import.meta.env.PROD;

/** Actions already reported by this page load; the server deduplicates across loads. */
const reported = new Set<string>();

/** Report a play for the shared ranking. Fire and forget: failures never reach the player. */
export function reportPlay(song: string, action: PopularityAction): void {
  const key = `${action}:${song}`;
  if (!enabled || reported.has(key)) return;
  reported.add(key);
  fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ song, action }), keepalive: true })
    .catch(() => {});
}

/** What the list shows before or without the API: the seed, with no play counts. */
const SEEDED: PopularEntry[] = POPULAR_SEED.map(id => ({ id, plays: 0 }));
let latest: { at: number; songs: PopularEntry[] } | null = null;

/** The ranking, refreshed at most once a minute; the last good list, or the seed, when the API fails. */
export async function loadPopular(now = Date.now()): Promise<PopularEntry[]> {
  if (!enabled) return SEEDED;
  if (latest && now - latest.at < REFRESH_MS) return latest.songs;
  try {
    const response = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    const { songs } = await response.json() as { songs?: unknown };
    const parsed = Array.isArray(songs)
      ? songs.flatMap(song => typeof song?.id === 'string' ? [{ id: song.id as string, plays: Number.isFinite(song.plays) ? Number(song.plays) : 0 }] : [])
      : [];
    latest = { at: now, songs: parsed.length ? parsed : SEEDED };
    return latest.songs;
  } catch {
    latest = { at: now, songs: latest?.songs ?? SEEDED };
    return latest.songs;
  }
}
