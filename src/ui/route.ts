/**
 * Routes: `#catalog`, `#saved`, `#lesson`, `#free`, `#workshop` and `#settings` on the app root, and the path
 * `song/<id>/` for a song lesson. `#song/<id>` is the earlier form of a song link and still opens.
 */
export type Route =
  | { view: 'catalog' | 'saved' | 'lesson' | 'free' | 'workshop' | 'settings' }
  | { view: 'song'; songId: string };

const SONG_PREFIX = 'song/';

function decodeSongId(encoded: string): string | null {
  try { return decodeURIComponent(encoded) || null; }
  catch { return null; }
}

export function parseRoute(hash: string): Route {
  const route = hash.replace(/^#/, '');
  if (route.startsWith(SONG_PREFIX)) {
    const songId = decodeSongId(route.slice(SONG_PREFIX.length));
    return songId ? { view: 'song', songId } : { view: 'catalog' };
  }
  return route === 'saved' || route === 'lesson' || route === 'free' || route === 'workshop' || route === 'settings' ? { view: route } : { view: 'catalog' };
}

/** Path of a song lesson under the app base, which ends with a slash. */
export function songPath(base: string, songId: string): string {
  return `${base}${SONG_PREFIX}${encodeURIComponent(songId)}/`;
}

/** The route of a page address. A hash that names a route decides over the path; any other hash is an in-page anchor. */
export function parseLocation(base: string, pathname: string, hash: string): Route {
  const named = parseRoute(hash);
  if (named.view !== 'catalog' || hash === '#catalog') return named;
  if (!pathname.startsWith(base + SONG_PREFIX)) return { view: 'catalog' };
  const songId = decodeSongId(pathname.slice(base.length + SONG_PREFIX.length).split('/')[0]!);
  return songId ? { view: 'song', songId } : { view: 'catalog' };
}

/** Absolute link that opens a song directly, without the current query or hash. */
export function shareUrl(pageUrl: string, base: string, songId: string): string {
  return new URL(songPath(base, songId), pageUrl).href;
}

/** Document title of a song lesson, shared by the app and its prerendered page; `meta` tells apart songs that share a title. */
export function songDocumentTitle(title: string, meta: string): string {
  return `${title} (${meta}) ocarina tab · Ocarina Hero`;
}
