// The Songbook, its quick player and the shared Popular ranking.
import { LISTING, type SongData } from '../../core/demo';
import { createTrackLoader, latestRequest, sourcesByFile } from '../../core/track-loader';
import { MiniPlayer } from '../mini-player';
import { SongbookView } from '../songbook-view';
import { loadPopular, reportPlay } from '../popularity';
import { bindPullToRefresh } from '../pull-refresh';
import { engine, state } from './state';
import { must } from './dom';
import { updateLessonHeading } from './staff';
import { openSong, syncRoute } from './navigation';

/** Notes of curated songs are separate files, fetched on demand and warmed when a song is likely to open. */
export const trackLoader = createTrackLoader(LISTING, sourcesByFile(import.meta.glob<SongData>('../../core/songs/catalogue/*.json', { import: 'default' })));

export const songOpening = latestRequest();

export const catalogue = new SongbookView(must('#catalog-view'), LISTING, {
  select: entry => openSong(entry),
  prefetch: entry => trackLoader.prefetch(entry.id),
  quickPlay: entry => {
    reportPlay(entry.id, 'quick-play');
    miniPlayer.toggle(entry);
  },
  savedChanged: updateLessonHeading,
  savedFilterChanged: () => { if (state.view === 'catalog') syncRoute(true); },
  progress: () => state.progress,
});

/** The shared ranking is fetched when the Songbook shows, at most once a minute. */
export function refreshPopular(): void {
  void loadPopular().then(ids => catalogue.setPopular(ids));
}

let popularReload: Promise<void> | null = null;

/** Fetch the ranking now, past the once-a-minute cache: the pull gesture and the Refresh button share one request. */
function reloadPopular(): Promise<void> {
  popularReload ??= (async () => {
    const button = must<HTMLButtonElement>('#refresh-popular');
    const status = must('#popular-status');
    button.disabled = true;
    status.textContent = '';
    try {
      catalogue.setPopular(await loadPopular({ force: true }));
      status.textContent = 'Ranking updated.';
    } catch {
      status.textContent = 'Could not refresh the ranking. Try again later.';
    } finally {
      button.disabled = false;
      popularReload = null;
    }
  })();
  return popularReload;
}

export const miniPlayer = new MiniPlayer(must('#mini-player'), engine, trackLoader, {
  open: entry => openSong(entry),
  changed: (id, playing) => catalogue.setNowPlaying(id, playing),
});

export function bindSongbook(): void {
  must('#refresh-popular').addEventListener('click', () => void reloadPopular());

  bindPullToRefresh(must('#main-content'), must('#popular-pull'), { active: () => state.view === 'popular', refresh: reloadPopular });
}
