/**
 * Routes: `#catalog`, `#saved`, `#lesson`, `#free`, `#workshop` and `#settings` on the app root, and the paths
 * `song/<id>/` for a song lesson and `popular/` for the ranking. `#song/<id>` and `#popular` are the earlier forms of those links
 * and still open (the app moves them to their path).
 */
export type Route =
  | { view: 'catalog' | 'saved' | 'popular' | 'lesson' | 'free' | 'workshop' | 'settings' }
  | { view: 'song'; songId: string };

const SONG_PREFIX = 'song/';
const POPULAR_SEGMENT = 'popular';

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
  return route === 'saved' || route === 'popular' || route === 'lesson' || route === 'free' || route === 'workshop' || route === 'settings' ? { view: route } : { view: 'catalog' };
}

/** Path of a song lesson under the app base, which ends with a slash. */
export function songPath(base: string, songId: string): string {
  return `${base}${SONG_PREFIX}${encodeURIComponent(songId)}/`;
}

/** Path of the Popular page under the app base, which ends with a slash. */
export function popularPath(base: string): string {
  return `${base}${POPULAR_SEGMENT}/`;
}

/** The route of a page address. A hash that names a route decides over the path; any other hash is an in-page anchor. */
export function parseLocation(base: string, pathname: string, hash: string): Route {
  const named = parseRoute(hash);
  if (named.view !== 'catalog' || hash === '#catalog') return named;
  if (pathname === popularPath(base) || pathname === base + POPULAR_SEGMENT) return { view: 'popular' };
  if (!pathname.startsWith(base + SONG_PREFIX)) return { view: 'catalog' };
  const songId = decodeSongId(pathname.slice(base.length + SONG_PREFIX.length).split('/')[0]!);
  return songId ? { view: 'song', songId } : { view: 'catalog' };
}

/** Absolute link that opens a song directly, without the current query or hash. */
export function shareUrl(pageUrl: string, base: string, songId: string): string {
  return new URL(songPath(base, songId), pageUrl).href;
}

/** Document title of a song lesson, shared by the app and its prerendered page; `qualifier` tells apart songs that share a title. */
export function songDocumentTitle(title: string, qualifier: string): string {
  return `${title} (${qualifier}) | Ocarina of Time Button Tabs`;
}
