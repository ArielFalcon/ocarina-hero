/** Hash routes: `#catalog`, `#lesson`, `#free`, `#workshop`, and `#song/<id>` for a shareable song lesson. */
export type Route =
  | { view: 'catalog' | 'lesson' | 'free' | 'workshop' }
  | { view: 'song'; songId: string };

const SONG_PREFIX = 'song/';

export function parseRoute(hash: string): Route {
  const route = hash.replace(/^#/, '');
  if (route.startsWith(SONG_PREFIX)) {
    const songId = decodeURIComponent(route.slice(SONG_PREFIX.length));
    return songId ? { view: 'song', songId } : { view: 'catalog' };
  }
  return route === 'lesson' || route === 'free' || route === 'workshop' ? { view: route } : { view: 'catalog' };
}

export function routeHash(route: Route): string {
  return route.view === 'song' ? `#${SONG_PREFIX}${encodeURIComponent(route.songId)}` : `#${route.view}`;
}

/** Absolute link that opens a song directly, keeping the deployment's path (e.g. a GitHub Pages subfolder). */
export function shareUrl(pageUrl: string, songId: string): string {
  const url = new URL(pageUrl);
  url.hash = routeHash({ view: 'song', songId });
  return url.href;
}
