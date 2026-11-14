/**
 * Song popularity: all-time play counts behind the Songbook's "Most popular" list.
 * Runs in the Pages Function `functions/api/popularity.ts`; storage is the D1 schema in `migrations/`.
 * Only structural types are used so the code also runs under Node tests.
 */
import { empty, readSameOriginJson } from './request';

/** Actions that count as one play each: a quick-player play and a lesson opened. */
export const PLAY_ACTIONS = ['quick-play', 'open'] as const;
export type PopularityAction = typeof PLAY_ACTIONS[number];

/** Rows returned to clients: more than the twenty shown, so songs removed from the catalogue can be skipped. */
export const POPULAR_LIMIT = 30;
export const POPULAR_CACHE_SECONDS = 60;
const MAX_BODY_BYTES = 512;

export interface Statement {
  bind(...values: unknown[]): Statement;
  run(): Promise<{ meta: { changes: number } }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface Database { prepare(sql: string): Statement }
export interface PopularityEnv {
  DB?: Database;
  ASSETS?: { fetch(input: string | URL | Request): Promise<Response> };
}
export interface PopularityContext {
  request: Request;
  env: PopularityEnv;
  waitUntil(promise: Promise<unknown>): void;
}
export interface PopularSong { id: string; plays: number }

export function parseEvent(body: unknown, songIds: ReadonlySet<string>): { song: string; action: PopularityAction } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { song, action } = body as Record<string, unknown>;
  if (typeof song !== 'string' || !songIds.has(song)) return null;
  if (typeof action !== 'string' || !(PLAY_ACTIONS as readonly string[]).includes(action)) return null;
  return { song, action: action as PopularityAction };
}

export async function recordEvent(db: Database, event: { song: string; action: PopularityAction }): Promise<void> {
  await db.prepare('INSERT INTO song_popularity (song_id, plays) VALUES (?, 1) ON CONFLICT (song_id) DO UPDATE SET plays = plays + 1').bind(event.song).run();
}

/** The ranking: all-time plays, most played first; ties keep a stable order by id. */
export async function topSongs(db: Database): Promise<PopularSong[]> {
  const { results } = await db.prepare('SELECT song_id, plays FROM song_popularity ORDER BY plays DESC, song_id LIMIT ?').bind(POPULAR_LIMIT).all<{ song_id: string; plays: number }>();
  return results.map(row => ({ id: row.song_id, plays: row.plays }));
}

let songIds: Promise<Set<string>> | null = null;

/** The catalogue ids the build publishes; loaded once per isolate and retried after a failure. */
async function knownSongs(env: PopularityEnv): Promise<Set<string>> {
  songIds ??= (async () => {
    const response = await env.ASSETS!.fetch('https://assets.local/song-ids.json');
    if (!response.ok) throw new Error(`song-ids.json: ${response.status}`);
    const ids: unknown = await response.json();
    if (!Array.isArray(ids)) throw new Error('song-ids.json: not a list');
    return new Set(ids.filter((id): id is string => typeof id === 'string'));
  })();
  try { return await songIds; } catch (error) { songIds = null; throw error; }
}

/** Test hook: forget the cached catalogue ids. */
export function resetSongIds(): void { songIds = null; }

export async function handlePost(context: PopularityContext): Promise<Response> {
  const { request, env } = context;
  const read = await readSameOriginJson(request, MAX_BODY_BYTES);
  if ('status' in read) return empty(read.status);
  if (!env.DB || !env.ASSETS) return empty(503);
  let ids: Set<string>;
  try { ids = await knownSongs(env); } catch { return empty(503); }
  const event = parseEvent(read.body, ids);
  if (!event) return empty(400);
  try { await recordEvent(env.DB, event); } catch { return empty(503); }
  return empty(204);
}

export async function handleGet(context: PopularityContext, cache: Cache | null = edgeCache()): Promise<Response> {
  const { request, env } = context;
  const key = new Request(new URL('/api/popularity', request.url));
  const cached = await cache?.match(key);
  if (cached) return cached;
  if (!env.DB) return empty(503);
  let songs: PopularSong[];
  try { songs = await topSongs(env.DB); } catch { return empty(503); }
  const response = Response.json({ songs }, { headers: { 'Cache-Control': `public, max-age=${POPULAR_CACHE_SECONDS}` } });
  if (cache) context.waitUntil(cache.put(key, response.clone()).catch(() => {}));
  return response;
}

function edgeCache(): Cache | null {
  return (globalThis.caches as unknown as { default?: Cache } | undefined)?.default ?? null;
}
