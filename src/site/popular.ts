import { journey } from '../ui/journey';
import type { SongbookEntry } from '../ui/songbook';
import type { PopularEntry } from '../ui/popularity';
import type { PageHead } from './site';
import { popularUrl, songUrl } from './song-pages';
import { songRowHtml, type IconHtml } from './song-row';

export const POPULAR_TITLE = 'Most Popular Zelda Ocarina Songs | Ocarina Hero';
const DESCRIPTION = 'The Zelda ocarina songs players practice most on Ocarina Hero, ranked by plays. Open any song for its button tab, then listen and practice it. Free, in your browser.';

/** How long the build waits for the ranking before it builds the page with an empty list. */
export const SNAPSHOT_TIMEOUT_MS = 5000;

export interface PopularRow { readonly entry: SongbookEntry; readonly plays: number }

/** The ranking as the app shows it: best first, one row per song, limited to songs this build has. */
export function popularSnapshot(entries: readonly SongbookEntry[], ranking: readonly PopularEntry[]): PopularRow[] {
  return [...journey(entries, {}, ranking).popular];
}

/** The rows of the ranked list, the markup the app draws; `icon` draws the patch icons. */
export function popularRowsHtml(rows: readonly PopularRow[], base: string, icon: IconHtml): string {
  return rows.map(({ entry, plays }, index) => songRowHtml(entry, { base, icon, ranked: { rank: index + 1, plays } })).join('');
}

/**
 * The ranking at build time. It never throws or waits past `timeoutMs`: when the API cannot be read the page is built with an
 * empty list (the app fills it in the browser) and a warning says why.
 */
export async function fetchPopularSnapshot(url: string, { fetch: request = fetch, timeoutMs = SNAPSHOT_TIMEOUT_MS, warn = console.warn }: {
  fetch?: (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<Response>;
  timeoutMs?: number;
  warn?: (message: string) => void;
} = {}): Promise<PopularEntry[]> {
  // A plain timer, not AbortSignal.timeout(): that one does not keep Node alive, so a request holding no handle of its own let
  // the process exit before the timeout fired, with the build unfinished and the test cancelled.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException(`no answer within ${timeoutMs} ms`, 'TimeoutError')), timeoutMs);
  try {
    const response = await request(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { songs } = await response.json() as { songs?: unknown };
    if (!Array.isArray(songs)) throw new Error('the response has no songs list');
    return songs.flatMap(song => typeof song?.id === 'string' ? [{ id: song.id as string, plays: Number.isFinite(song.plays) ? Number(song.plays) : 0 }] : []);
  } catch (error) {
    warn(`[popular] could not read the ranking from ${url}; the page is built with an empty list (${error instanceof Error ? error.message : String(error)})`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** What the Popular page tells search engines and link previews. */
export function popularHead(siteUrl: string, rows: readonly PopularRow[]): PageHead {
  const url = popularUrl(siteUrl);
  return {
    title: POPULAR_TITLE, description: DESCRIPTION, url, shareTitle: POPULAR_TITLE,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage', url, name: POPULAR_TITLE, description: DESCRIPTION, inLanguage: 'en',
          isPartOf: { '@id': `${siteUrl}#website` },
          ...rows.length && { mainEntity: {
            '@type': 'ItemList', numberOfItems: rows.length,
            itemListElement: rows.map(({ entry }, index) => ({ '@type': 'ListItem', position: index + 1, url: songUrl(siteUrl, entry.id), name: entry.title })),
          } },
        },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ocarina Hero', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Most popular', item: url },
        ] },
      ],
    },
  };
}
