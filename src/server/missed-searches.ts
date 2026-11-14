/**
 * Searches that found no song, counted per normalized text so the catalogue can grow toward what players look for.
 * Runs in the Pages Function `functions/api/missed-searches.ts`; storage is `migrations/0003_missed_searches.sql`.
 */
import { MISSED_SEARCH_MAX_LENGTH, MISSED_SEARCH_MIN_LENGTH, normalizeSearch } from '../core/search-text';
import type { PopularityContext } from './popularity';
import { empty, readSameOriginJson } from './request';

/** New texts stop being stored past this many rows; counts of stored texts keep growing. */
export const MAX_MISSED_TEXTS = 5000;
const MAX_BODY_BYTES = 512;
/** Emails and long digit runs are personal data, not song titles. */
const PERSONAL = /@|\d{6,}/;

export function parseMissedSearch(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { query } = body as Record<string, unknown>;
  if (typeof query !== 'string') return null;
  const text = normalizeSearch(query);
  if (text.length < MISSED_SEARCH_MIN_LENGTH || text.length > MISSED_SEARCH_MAX_LENGTH || PERSONAL.test(text)) return null;
  return text;
}

export async function handlePost(context: PopularityContext, now = Date.now()): Promise<Response> {
  const { request, env } = context;
  const read = await readSameOriginJson(request, MAX_BODY_BYTES);
  if ('status' in read) return empty(read.status);
  if (!env.DB) return empty(503);
  const text = parseMissedSearch(read.body);
  if (!text) return empty(400);
  try {
    await env.DB.prepare(`INSERT INTO missed_searches (query, count, last_seen)
      SELECT ?1, 1, ?2 WHERE (SELECT COUNT(*) FROM missed_searches) < ?3 OR EXISTS (SELECT 1 FROM missed_searches WHERE query = ?1)
      ON CONFLICT (query) DO UPDATE SET count = count + 1, last_seen = excluded.last_seen`).bind(text, now, MAX_MISSED_TEXTS).run();
  } catch {
    return empty(503);
  }
  return empty(204);
}
