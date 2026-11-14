import type { PopularityAction } from '../server/popularity';

export interface PopularEntry { id: string; plays: number }

const ENDPOINT = '/api/popularity';
const REFRESH_MS = 60_000;
/** The Vite dev server has no Functions; only built pages (production or `wrangler pages dev`) talk to the API. */
const enabled = import.meta.env.PROD;

/** Report one play for the shared ranking. Fire and forget: failures never reach the player. */
export function reportPlay(song: string, action: PopularityAction): void {
  if (!enabled) return;
  fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ song, action }), keepalive: true })
    .catch(() => {});
}

let latest: { at: number; songs: PopularEntry[] } | null = null;

/** The ranking, refreshed at most once a minute; the last good list, or none, when the API fails. */
export async function loadPopular(now = Date.now()): Promise<PopularEntry[]> {
  if (!enabled) return [];
  if (latest && now - latest.at < REFRESH_MS) return latest.songs;
  try {
    const response = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    const { songs } = await response.json() as { songs?: unknown };
    const parsed = Array.isArray(songs)
      ? songs.flatMap(song => typeof song?.id === 'string' ? [{ id: song.id as string, plays: Number.isFinite(song.plays) ? Number(song.plays) : 0 }] : [])
      : [];
    latest = { at: now, songs: parsed };
    return latest.songs;
  } catch {
    latest = { at: now, songs: latest?.songs ?? [] };
    return latest.songs;
  }
}
