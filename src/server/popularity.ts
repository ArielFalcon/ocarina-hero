/**
 * Song popularity: weighted, decaying play counts behind the Songbook's "Most popular" list.
 * Runs in the Pages Function `functions/api/popularity.ts`; storage is the D1 schema in
 * `migrations/0001_popularity.sql`. Only structural types are used so the code also runs under Node tests.
 */
import { POPULAR_SEED, SEED_BASE_SCORE } from '../core/popular-seed';

/** Points per action: a lesson opened shows more interest than a preview, a finished song the most. */
export const POPULARITY_POINTS = { 'quick-play': 1, open: 2, complete: 5 } as const;
export type PopularityAction = keyof typeof POPULARITY_POINTS;

/** Scores halve every two weeks, so the list follows what people play now, not what they played at launch. */
export const HALF_LIFE_DAYS = 14;
export const SCORE_EPOCH = Date.UTC(2026, 10, 1);
/** Rows returned to clients: more than the twenty shown, so songs removed from the catalogue can be skipped. */
export const POPULAR_LIMIT = 30;
/** Actions that count as a play in the public play count; finishing a practice is a score bonus only. */
const PLAY_ACTIONS: ReadonlySet<PopularityAction> = new Set(['quick-play', 'open']);
/** Distinct songs and actions one visitor can score per day; a script touching the whole catalogue stops here. */
export const VISITOR_DAILY_CAP = 60;
export const POPULAR_CACHE_SECONDS = 60;
const MAX_BODY_BYTES = 512;
const DAY_MS = 86_400_000;

export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface Database { prepare(sql: string): Statement }
export interface PopularityEnv {
  DB?: Database;
  ASSETS?: { fetch(input: string | URL | Request): Promise<Response> };
  /** Secret mixed into visitor hashes; without it a stored hash could be matched against guessed addresses. */
  POPULARITY_SALT?: string;
}
export interface PopularityContext {
  request: Request;
  env: PopularityEnv;
  waitUntil(promise: Promise<unknown>): void;
}
export interface PopularSong { id: string; score: number; plays: number }

const growth = (now: number) => 2 ** ((now - SCORE_EPOCH) / (HALF_LIFE_DAYS * DAY_MS));
export const storedPoints = (action: PopularityAction, now: number) => POPULARITY_POINTS[action] * growth(now);
export const currentScore = (stored: number, now: number) => stored / growth(now);
export const utcDay = (now: number) => Math.floor(now / DAY_MS);

export function parseEvent(body: unknown, songIds: ReadonlySet<string>): { song: string; action: PopularityAction } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { song, action } = body as Record<string, unknown>;
  if (typeof song !== 'string' || !songIds.has(song)) return null;
  if (typeof action !== 'string' || !Object.hasOwn(POPULARITY_POINTS, action)) return null;
  return { song, action: action as PopularityAction };
}

/** IPv6 hosts often hold a whole /64, so the visitor is the network, not the single address. */
export function networkOf(ip: string): string {
  if (!ip.includes(':')) return ip;
  const [head = '', tail = ''] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return groups.slice(0, 4).map(group => group.replace(/^0+(?=.)/, '')).join(':');
}

export async function visitorKey(ip: string, day: number, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}|${salt}|${networkOf(ip)}`));
  return [...new Uint8Array(digest).slice(0, 12)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export type RecordResult = 'recorded' | 'duplicate' | 'capped';

export async function recordEvent(db: Database, event: { song: string; action: PopularityAction }, visitor: string, now: number): Promise<RecordResult> {
  const day = utcDay(now);
  const used = await db.prepare('SELECT COUNT(*) AS n FROM popularity_marks WHERE day = ? AND visitor = ?').bind(day, visitor).first<{ n: number }>();
  if ((used?.n ?? 0) >= VISITOR_DAILY_CAP) return 'capped';
  const mark = await db.prepare('INSERT OR IGNORE INTO popularity_marks (day, visitor, song_id, action) VALUES (?, ?, ?, ?)').bind(day, visitor, event.song, event.action).run();
  if (mark.meta.changes === 0) return 'duplicate';
  await db.prepare('INSERT INTO song_popularity (song_id, score, plays) VALUES (?, ?, ?) ON CONFLICT (song_id) DO UPDATE SET score = score + excluded.score, plays = plays + excluded.plays')
    .bind(event.song, storedPoints(event.action, now), PLAY_ACTIONS.has(event.action) ? 1 : 0).run();
  return 'recorded';
}

/** Marks only guard the current day; yesterday's stay so an event near midnight is not counted twice. */
export async function pruneMarks(db: Database, now: number): Promise<void> {
  await db.prepare('DELETE FROM popularity_marks WHERE day < ?').bind(utcDay(now) - 1).run();
}

/**
 * The ranking: real current scores plus the seed's baseline, best first. A seeded song outside the stored
 * top rows keeps only its baseline, which can only understate it.
 */
export async function topSongs(db: Database, now: number): Promise<PopularSong[]> {
  const { results } = await db.prepare('SELECT song_id, score, plays FROM song_popularity ORDER BY score DESC LIMIT ?').bind(POPULAR_LIMIT).all<{ song_id: string; score: number; plays: number }>();
  const songs = new Map(results.map(row => [row.song_id, { id: row.song_id, score: currentScore(row.score, now), plays: row.plays }]));
  POPULAR_SEED.forEach((id, index) => {
    const song = songs.get(id) ?? { id, score: 0, plays: 0 };
    songs.set(id, { ...song, score: song.score + SEED_BASE_SCORE - index * 0.01 });
  });
  return [...songs.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, POPULAR_LIMIT)
    .map(song => ({ ...song, score: Math.round(song.score * 100) / 100 }));
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

const empty = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function handlePost(context: PopularityContext, now = Date.now()): Promise<Response> {
  const { request, env } = context;
  const origin = request.headers.get('Origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) return empty(403);
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return empty(413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return empty(413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return empty(400); }
  if (!env.DB || !env.ASSETS) return empty(503);
  let ids: Set<string>;
  try { ids = await knownSongs(env); } catch { return empty(503); }
  const event = parseEvent(body, ids);
  if (!event) return empty(400);
  const visitor = await visitorKey(request.headers.get('CF-Connecting-IP') ?? '', utcDay(now), env.POPULARITY_SALT ?? '');
  try {
    const result = await recordEvent(env.DB, event, visitor, now);
    if (result === 'recorded' && Math.random() < 0.01) context.waitUntil(pruneMarks(env.DB, now).catch(() => {}));
  } catch {
    return empty(503);
  }
  return empty(204);
}

export async function handleGet(context: PopularityContext, now = Date.now(), cache: Cache | null = edgeCache()): Promise<Response> {
  const { request, env } = context;
  const key = new Request(new URL('/api/popularity', request.url));
  const cached = await cache?.match(key);
  if (cached) return cached;
  if (!env.DB) return empty(503);
  let songs: PopularSong[];
  try { songs = await topSongs(env.DB, now); } catch { return empty(503); }
  const response = Response.json({ songs }, { headers: { 'Cache-Control': `public, max-age=${POPULAR_CACHE_SECONDS}` } });
  if (cache) context.waitUntil(cache.put(key, response.clone()).catch(() => {}));
  return response;
}

function edgeCache(): Cache | null {
  return (globalThis.caches as unknown as { default?: Cache } | undefined)?.default ?? null;
}
