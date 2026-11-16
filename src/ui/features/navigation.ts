// Views and history: which view shows, the address it has and opening a song.
import type { DemoTrack } from '../../core/demo';
import { parseLocation, popularPath, songDocumentTitle, songPath } from '../route';
import { POPULAR_TITLE } from '../../site/popular';
import { songTitleQualifier, type SongbookEntry } from '../songbook';
import { reportPlay } from '../popularity';
import { markOpened } from '../progress';
import { APP_BASE, type AppView, state } from './state';
import { must } from './dom';
import { isImporting, loadWorkshopTools, setWorkshopStatus } from './workshop';
import { clearActive, controls, watchGamepads } from './pad';
import { cancelBinding } from './keyboard';
import { runDemo, updateLessonHeading } from './staff';
import { saveProgress } from './practice';
import { stopPlayback } from './playback';
import { catalogue, miniPlayer, refreshPopular, songOpening, trackLoader } from './songbook';

/** Songbook scroll position, kept while a lesson or the workshop is open so returning lands where the user left. */
let catalogScroll = 0;

/** The view the Settings gear returns to when it is pressed again. */
let settingsReturn: AppView = 'catalog';

export function showView(next: AppView, pushHistory = true): void {
  songOpening.cancel();
  if (next === 'settings' && state.view !== 'settings') settingsReturn = state.view;
  cancelBinding();
  const scroller = must('#main-content');
  const returningToCatalog = state.view !== next && next === 'catalog';
  if (state.view === 'catalog' && next !== 'catalog') catalogScroll = scroller.scrollTop;
  if (next !== 'catalog' && next !== 'popular') miniPlayer.close();
  if (state.view !== next) {
    stopPlayback();
    controls.reset();
    clearActive();
    state.editor?.stopPreview();
    if (state.view === 'workshop' && isImporting()) {
      state.audioLoadVersion++;
      state.importer?.invalidate();
      setWorkshopStatus('Analysis cancelled. Choose Analyze fragment to try again.');
    }
  }
  state.view = next;
  if (next === 'workshop') void loadWorkshopTools();
  must('.app').classList.toggle('is-lesson', next === 'lesson');
  for (const name of ['catalog', 'popular', 'lesson', 'workshop', 'settings'] as const) {
    must(`#${name}-view`).hidden = next !== name;
  }
  syncRoute(pushHistory);
  if (next === 'lesson') updateLessonHeading();
  if (next === 'lesson') watchGamepads();
  if (returningToCatalog) catalogue.refresh();
  if (next === 'catalog' || next === 'popular') refreshPopular();
  document.title = next === 'popular' ? POPULAR_TITLE : next !== 'lesson' || !state.current ? 'Ocarina Hero' : state.selectedEntry ? songDocumentTitle(state.selectedEntry.title, songTitleQualifier(state.selectedEntry)) : `${state.current.title} · Ocarina Hero`;
  scroller.scrollTop = returningToCatalog ? catalogScroll : 0;
}

/** Mark the current destination in the navigation and, optionally, record it in the history. */
export function syncRoute(pushHistory: boolean): void {
  const route = state.view === 'lesson' && !state.current ? 'free' : state.view === 'catalog' && catalogue.showingSaved ? 'saved' : state.view;
  for (const link of document.querySelectorAll<HTMLElement>('.app-nav [data-view-link], .settings-link')) {
    if (link.dataset.viewLink === route || state.view === 'lesson' && state.current && link.dataset.viewLink === 'catalog') link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const address = state.view === 'lesson' && state.selectedEntry ? songPath(APP_BASE, state.selectedEntry.id) : state.view === 'popular' ? popularPath(APP_BASE) : `${APP_BASE}#${route}`;
  if (pushHistory && location.pathname + location.hash !== address) history.pushState(null, '', address);
}

/** Opens the lesson once the song's notes are in; a newer choice, or leaving the lesson, drops a slower earlier one. */
export function openSong(entry: SongbookEntry, pushHistory = true): void {
  const latest = songOpening.begin();
  const begin = (track: DemoTrack): void => {
    if (!latest()) return;
    state.selectedEntry = entry;
    state.practiceMode = false;
    saveProgress(markOpened(state.progress, entry.id, Date.now()));
    reportPlay(entry.id, 'open');
    runDemo(track);
    showView('lesson', pushHistory);
  };
  const ready = trackLoader.cached(entry.id);
  if (ready) { begin(ready); return; }
  trackLoader.load(entry.id).then(begin, error => {
    if (latest()) console.error(`Could not load ${entry.title}`, error);
  });
}

function openFreePlay(): void {
  if (state.current) must<HTMLButtonElement>('#clear').click();
  else { state.practiceMode = false; showView('lesson'); }
}

export function restoreView(): void {
  const route = parseLocation(APP_BASE, location.pathname, location.hash);
  if (route.view === 'song') {
    const entry = catalogue.entries.find(item => item.id === route.songId);
    if (!entry) { history.replaceState(null, '', `${APP_BASE}#catalog`); showView('catalog', false); return; }
    if (entry === state.selectedEntry && state.current) showView('lesson', false);
    else openSong(entry, false);
    const address = songPath(APP_BASE, entry.id);
    if (location.pathname !== address || location.hash) history.replaceState(null, '', address + location.search);
    return;
  }
  if (route.view === 'popular') {
    // The page's own address; an earlier `#popular` link moves to it (a hash cannot be redirected by the server).
    const address = popularPath(APP_BASE);
    if (location.pathname !== address || location.hash) history.replaceState(null, '', address + location.search);
  } else if (location.pathname !== APP_BASE) history.replaceState(null, '', APP_BASE + location.search + location.hash);
  if (route.view === 'free') openFreePlay();
  else if (route.view === 'saved' || route.view === 'catalog') {
    catalogue.showSaved(route.view === 'saved');
    showView('catalog', false);
  } else showView(route.view, false);
}

export function bindNavigation(): void {
  document.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLElement>('[data-view-link], .brand');
    if (!link) return;
    event.preventDefault();
    const next = link.dataset.viewLink ?? 'catalog';
    if (next === 'free') openFreePlay();
    else if (next === 'saved') { catalogue.showSaved(true); showView('catalog'); }
    else if (next === 'settings' && state.view === 'settings') showView(settingsReturn);
    else if (['catalog', 'popular', 'lesson', 'workshop', 'settings'].includes(next)) {
      if (next === 'catalog' && link.closest('.app-nav')) catalogue.showSaved(false);
      showView(next as AppView);
    }
  });

  window.addEventListener('popstate', restoreView);

  window.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopPlayback(); miniPlayer.pause(); controls.reset(); clearActive(); state.editor?.stopPreview(); }
    else watchGamepads();
  });
}
