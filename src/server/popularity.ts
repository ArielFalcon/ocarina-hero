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
/** Most plays one request may carry, as `{ plays: { [song]: count } }`; it also bounds the D1 rows a request writes. */
export const MAX_BATCH_PLAYS = 5;
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

/** Plays per song from a batch, or from the single `{ song, action }` event that tabs on an older build still send; null when invalid. */
export function parsePlays(body: unknown, songIds: ReadonlySet<string>): Map<string, number> | null {
  if (typeof body !== 'object' || body === null) return null;
  const { plays, song, action } = body as Record<string, unknown>;
  if (plays === undefined) {
    if (typeof song !== 'string' || !songIds.has(song)) return null;
    if (typeof action !== 'string' || !(PLAY_ACTIONS as readonly string[]).includes(action)) return null;
    return new Map([[song, 1]]);
  }
  if (typeof plays !== 'object' || plays === null || Array.isArray(plays)) return null;
  const entries = Object.entries(plays);
  let total = 0;
  for (const [id, count] of entries) {
    if (!songIds.has(id) || !Number.isInteger(count) || (count as number) < 1) return null;
    total += count as number;
  }
  if (total === 0 || total > MAX_BATCH_PLAYS) return null;
  return new Map(entries as [string, number][]);
}

/** One upsert for the whole batch; each song writes two rows, its own and its ranking index entry. */
export async function recordPlays(db: Database, plays: ReadonlyMap<string, number>): Promise<void> {
  const rows = [...plays].map(() => '(?, ?)').join(', ');
  await db.prepare(`INSERT INTO song_popularity (song_id, plays) VALUES ${rows} ON CONFLICT (song_id) DO UPDATE SET plays = plays + excluded.plays`)
    .bind(...[...plays].flat()).run();
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
  const plays = parsePlays(read.body, ids);
  if (!plays) return empty(400);
  try { await recordPlays(env.DB, plays); } catch { return empty(503); }
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
