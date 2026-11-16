import { threadIcon, type ThreadIcon } from './thread-icons';
import { createSongbookEntries, filterSongbook, letterAnchors, listPatch, listUniverses, songMeta, universeLabel, type ListMarkup, type SongbookEntry, type SongCategory } from './songbook';
import type { DemoTrack, TrackSummary } from '../core/demo';
import { DIFFICULTY_LEVELS, type DifficultyLevel } from '../core/difficulty';
import { gameSongs } from './featured';
import { completedIds, lastOpened, type Progress } from './progress';
import { journey } from './journey';
import { missedSearchNoter, normalizeSearch } from '../core/search-text';
import { reportMissedSearch, type PopularEntry } from './popularity';
import { SAVED_STORAGE } from './local-data';
import { readStored, writeStored } from './storage';
import { DIFFICULTY_NAMES, escapeHtml, playsHtml, rankHtml, sealMarkup, songRowHtml } from '../site/song-row';

/** Below this many results the list is short enough to scan, so the letter rail is hidden. */
const RAIL_MIN_RESULTS = 12;
/** Every control in a song row: the title link, quick play and save. */
const FOCUSABLE_ROW_CONTROLS = 'button, a[href]';
/** Frames a letter jump keeps its row aligned while the rows around it are drawn for the first time. */
const JUMP_SETTLE_FRAMES = 6;
/** Range steps: 0 is every difficulty, then one step per tier. */
const DIFFICULTY_STEPS = ['', ...DIFFICULTY_LEVELS] as const;

/** A song seal; its tier frame is a decorative overlay outside the slot. */
function sealHtml(icon: ThreadIcon, level: DifficultyLevel | '', extraClass = ''): string {
  return sealMarkup(threadIcon(icon), level, extraClass);
}

const CATEGORY_ICONS: Record<SongCategory, ThreadIcon> = { All: 'songbook', Games: 'gamepad', Anime: 'anime', Film: 'film', Pop: 'microphone', Classics: 'lyre', Other: 'collection' };

/** A visible count badge; the noun stays available to assistive technology only. */
function countHtml(count: number, noun: string): string {
  return `<span class="count-badge" aria-hidden="true">${count}</span><span class="visually-hidden">${count} ${noun}</span>`;
}

/** A click the browser would follow as a link in place, not into a new tab or window. */
function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function shelfTitle(text: string): string {
  return `<h2 class="shelf-title eyebrow stitched-label">${text}</h2>`;
}

/**
 * A field-like toggle that opens its panel below it. Folded, the panel is inert;
 * opening scrolls only as much as needed to show it below the toggle.
 */
/** Below this height a floating panel is too cramped, so the page scrolls to make room instead. */
const MIN_FLOATING_PANEL_PX = 240;
/** Upward scroll, in one run, that brings the search and filters back over the list on a phone: a small
 *  correction while reading never does, a deliberate swipe back up does. */
const CONTROLS_REVEAL_PX = 96;
/** Downward scroll, in one run, that tucks them away again. */
const CONTROLS_TUCK_PX = 24;

class Fold {
  constructor(readonly toggle: HTMLButtonElement, readonly panel: HTMLElement, private content: HTMLElement, focusSelector: string, private onOpen = (): void => {}) {
    toggle.addEventListener('click', () => {
      const open = !this.isOpen();
      this.setOpen(open);
      if (!open) return;
      this.onOpen();
      content.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
      this.reveal();
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.fold(); }
    });
  }

  isOpen(): boolean { return this.toggle.getAttribute('aria-expanded') === 'true'; }

  setOpen(open: boolean): void {
    this.toggle.setAttribute('aria-expanded', String(open));
    this.panel.classList.toggle('is-open', open);
    this.panel.inert = !open;
  }

  /** Fold and return focus to the toggle. */
  fold(): void {
    this.setOpen(false);
    this.toggle.focus();
  }

  private reveal(): void {
    const scroller = this.toggle.closest('main') ?? document.scrollingElement!;
    const nav = document.querySelector('.app-nav')?.getBoundingClientRect();
    const bottomEdge = nav && nav.top > innerHeight / 2 ? nav.top : innerHeight;
    const toggle = this.toggle.getBoundingClientRect();
    const room = Math.max(MIN_FLOATING_PANEL_PX, bottomEdge - toggle.bottom - 24);
    // A floating panel (desktop) fits the room below its toggle and scrolls inside, so the page stays put;
    // so does a panel of the controls pinned over the list on a phone, where scrolling the page would not move it.
    const pinned = this.toggle.closest('.catalog-controls.is-floating') !== null;
    if (getComputedStyle(this.panel).position === 'absolute') {
      this.panel.style.maxHeight = `min(62vh, 560px, ${room}px)`;
    } else if (pinned) {
      this.panel.style.maxHeight = `min(60dvh, 480px, ${room}px)`;
      return;
    } else {
      this.panel.style.removeProperty('max-height');
    }
    const overflow = toggle.bottom + this.panel.offsetHeight - bottomEdge;
    if (overflow <= 0) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollBy({ top: Math.min(overflow + 16, toggle.top - 72), behavior: smooth ? 'smooth' : 'auto' });
  }
}

/** The ranking the Popular page was built with, so its rows stay on screen (and take the player's saved state) until the live ranking arrives. */
function builtRanking(list: HTMLElement | null): PopularEntry[] {
  try {
    const parsed: unknown = JSON.parse(list?.dataset.ranking ?? '[]');
    return Array.isArray(parsed) ? parsed.flatMap(song => typeof song?.id === 'string' && Number.isFinite(song.plays) ? [{ id: song.id as string, plays: Number(song.plays) }] : []) : [];
  } catch { return []; }
}

function idle(run: () => void): void {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1500 });
  else window.setTimeout(run, 50);
}

export class SongbookView {
  readonly entries: SongbookEntry[];
  private category: SongCategory = 'All';
  private saved = new Set<string>();
  private onlySaved = false;
  private sessionOnly = false;
  private search: HTMLInputElement;
  private universe = '';
  private universes: HTMLElement;
  private universeFold: Fold;
  private categoryFold: Fold;
  private difficultyFold: Fold;
  private list: HTMLElement;
  private journey: HTMLElement;
  private popular: readonly PopularEntry[] = builtRanking(document.querySelector('#popular-list'));
  /** The ranking on screen is the one the page was built with: a live ranking that comes back empty (API down) does not replace it. */
  private builtRankingShown = this.popular.length > 0;
  private filterFrame = 0;
  private readonly noteSearch = missedSearchNoter(reportMissedSearch);
  /** The phone "Popular" view's list; it shares the row markup and actions with the Songbook list. */
  private popularList: HTMLElement | null = document.querySelector('#popular-list');
  private categories: HTMLElement;
  private count: HTMLElement;
  private rail: HTMLElement;
  private bubble: HTMLElement;
  private scroller: HTMLElement;
  private railFrame = 0;
  private jumpFrame = 0;
  /** The markup the list and the letter rail show. */
  private shownList: ListMarkup | null = null;
  private shownRail = '';
  private reset: HTMLButtonElement;
  private filters: HTMLElement;
  /** The search and the filters, which a phone pins over the list on a swipe back up. */
  private controls: HTMLElement;
  private controlsHeldUntil = 0;
  private universeSearch: HTMLInputElement;
  /** Universe groups the player unfolded; the rest stay folded so the panel opens short. */
  private openGroups = new Set<string>();
  private difficulty: DifficultyLevel | '' = '';
  private difficultyRange: HTMLInputElement;
  private nowPlaying: { id: string | null; playing: boolean } = { id: null, playing: false };
  /** Rows that scroll into view warm their notes while the browser is idle. */
  private visibility = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(rows => {
    for (const row of rows) {
      if (!row.isIntersecting) continue;
      this.visibility!.unobserve(row.target);
      const id = (row.target as HTMLElement).dataset.song;
      const entry = id && this.entries.find(item => item.id === id);
      if (entry) idle(() => this.callbacks.prefetch(entry));
    }
  }, { rootMargin: '120px 0px' });

  constructor(private root: HTMLElement, tracks: readonly (DemoTrack | TrackSummary)[], private callbacks: {
    select(entry: SongbookEntry): void;
    quickPlay(entry: SongbookEntry): void;
    /** Warm the notes of a song the player is likely to open next. */
    prefetch(entry: SongbookEntry): void;
    savedChanged(): void;
    savedFilterChanged(): void;
    progress(): Progress;
  }) {
    this.entries = createSongbookEntries(tracks).sort((a, b) => a.title.localeCompare(b.title, 'en') || a.id.localeCompare(b.id, 'en'));
    this.search = root.querySelector('#song-search')!;
    this.universes = root.querySelector('#universes')!;
    this.list = root.querySelector('#demos')!;
    this.journey = root.querySelector('#journey')!;
    this.categories = root.querySelector('#categories')!;
    this.universeSearch = root.querySelector('#universe-search')!;
    this.universeSearch.addEventListener('input', () => this.filterUniverseChips());
    this.universeFold = new Fold(root.querySelector('#universe-toggle')!, root.querySelector('#universe-panel')!, this.universes, 'input:checked', () => {
      this.foldOthers(this.universeFold);
      this.universeSearch.value = '';
      this.filterUniverseChips();
    });
    this.categoryFold = new Fold(root.querySelector('#category-toggle')!, root.querySelector('#category-panel')!, this.categories, '[aria-pressed="true"]', () => this.foldOthers(this.categoryFold));
    this.count = root.querySelector('#catalog-count')!;
    this.rail = root.querySelector('#letter-rail')!;
    this.bubble = root.querySelector('#letter-bubble')!;
    this.scroller = root.closest<HTMLElement>('main') ?? document.documentElement;
    this.reset = root.querySelector('#reset-search')!;
    this.filters = root.querySelector('#catalog-filters')!;
    this.controls = root.querySelector('#catalog-controls')!;
    document.addEventListener('pointerdown', event => {
      if (event.target instanceof Node && this.filters.contains(event.target)) return;
      for (const fold of this.folds()) fold.setOpen(false);
    });
    this.difficultyRange = root.querySelector('#difficulty-range')!;
    const steps = root.querySelector<HTMLElement>('#difficulty-steps')!;
    steps.innerHTML = DIFFICULTY_STEPS.map((level, index) => `<span class="difficulty-step" data-step="${index}">${sealHtml(level ? 'music' : 'songbook', level, 'mini-seal')}<span class="difficulty-name stitched-label">${DIFFICULTY_NAMES[level]}</span></span>`).join('');
    this.difficultyFold = new Fold(root.querySelector('#difficulty-toggle')!, root.querySelector('#difficulty-panel')!, root.querySelector('#difficulty-scale')!, '#difficulty-range', () => this.foldOthers(this.difficultyFold));
    this.difficultyRange.addEventListener('input', () => this.setDifficulty(Number(this.difficultyRange.value)));
    this.difficultyRange.addEventListener('pointerup', () => this.difficultyFold.fold());
    this.difficultyFold.panel.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.difficultyFold.fold();
    });
    steps.addEventListener('click', event => {
      const step = (event.target as Element).closest<HTMLElement>('[data-step]');
      if (!step) return;
      this.setDifficulty(Number(step.dataset.step));
      this.difficultyFold.fold();
    });
    const stored = readStored(SAVED_STORAGE, value => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
    this.saved = new Set(stored.value);
    if (!stored.readable) this.sessionOnly = true;
    this.search.addEventListener('input', () => this.filterAfterPaint());
    // Pointer picks fold the panel; arrow keys only browse, so keyboard users fold with Enter or Space.
    let pointerPick = false;
    this.universes.addEventListener('pointerdown', event => { pointerPick = (event.target as Element).closest('.universe-chip') !== null; });
    this.universes.addEventListener('change', event => {
      this.universe = (event.target as HTMLInputElement).value;
      this.filterChanged();
    });
    this.universes.addEventListener('click', event => {
      const group = (event.target as Element).closest<HTMLElement>('.universe-group');
      if (group) {
        const name = group.dataset.group!;
        if (!this.openGroups.delete(name)) this.openGroups.add(name);
        this.filterUniverseChips();
        return;
      }
      if (!(event.target instanceof HTMLInputElement) || !pointerPick) return;
      pointerPick = false;
      this.universeFold.fold();
    });
    this.universeFold.panel.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ' || !(event.target instanceof HTMLInputElement && event.target.type === 'radio')) return;
      event.preventDefault();
      this.universeFold.fold();
    });
    this.bindRail();
    this.bindFloatingControls();
    this.reset.addEventListener('click', () => {
      this.applyUserFilter(() => {
        this.search.value = '';
        this.universe = '';
        this.onlySaved = false;
        this.category = 'All';
        this.difficulty = '';
      });
      this.search.focus();
    });
    this.categories.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-category], [data-saved-filter]');
      if (!button) return;
      this.applyUserFilter(() => {
        this.onlySaved = button.dataset.savedFilter !== undefined;
        this.category = this.onlySaved ? 'All' : button.dataset.category as SongCategory;
      });
      this.categoryFold.fold();
    });
    const onRowClick = (event: MouseEvent) => {
      const button = (event.target as Element).closest<HTMLElement>('[data-song], [data-save], [data-quick-play]');
      if (button?.dataset.save) { this.toggleSaved(button.dataset.save); return; }
      const id = button?.dataset.quickPlay ?? button?.dataset.song;
      const entry = id && this.entries.find(item => item.id === id);
      if (!entry) return;
      if (button!.dataset.quickPlay) { this.callbacks.quickPlay(entry); return; }
      if (!isPlainClick(event)) return;
      event.preventDefault();
      this.callbacks.select(entry);
    };
    this.list.addEventListener('click', onRowClick);
    this.popularList?.addEventListener('click', onRowClick);
    // Pointing at a row, pressing it or tabbing to it is the strongest hint that its song opens next.
    const onRowIntent = (event: Event) => {
      const id = (event.target as Element).closest<HTMLElement>('[data-song], [data-quick-play]')?.dataset;
      const entry = id && this.entries.find(item => item.id === (id.quickPlay ?? id.song));
      if (entry) this.callbacks.prefetch(entry);
    };
    for (const list of [this.list, this.popularList, this.journey]) {
      for (const type of ['pointerover', 'pointerdown', 'focusin']) list?.addEventListener(type, onRowIntent);
    }
    this.journey.addEventListener('click', event => {
      const id = (event.target as Element).closest<HTMLButtonElement>('[data-song]')?.dataset.song;
      const entry = id && this.entries.find(item => item.id === id);
      if (entry) this.callbacks.select(entry);
    });
    this.filterChanged();
  }

  private folds(): Fold[] { return [this.categoryFold, this.universeFold, this.difficultyFold]; }

  /** The panels share the space under the toggles, so opening one folds the rest. */
  private foldOthers(opened: Fold): void {
    for (const fold of this.folds()) if (fold !== opened) fold.setOpen(false);
  }

  /**
   * Shows the universe chips whose name matches the panel's search and whose group is unfolded; a search
   * unfolds every group, and a group with no match hides its heading.
   */
  private filterUniverseChips(): void {
    const query = normalizeSearch(this.universeSearch.value);
    let anyShown = false;
    let group: HTMLElement | null = null;
    let groupShown = false;
    let groupOpen = true;
    for (const element of this.universes.children as HTMLCollectionOf<HTMLElement>) {
      if (element.classList.contains('universe-group')) {
        if (group) group.hidden = !groupShown;
        group = element;
        groupShown = false;
        groupOpen = !!query || this.openGroups.has(element.dataset.group!);
        element.setAttribute('aria-expanded', String(groupOpen));
        continue;
      }
      const matches = !query || normalizeSearch(element.querySelector('.universe-name')?.textContent ?? '').includes(query);
      element.hidden = !matches || !groupOpen;
      groupShown ||= matches;
      anyShown ||= matches;
    }
    if (group) group.hidden = !groupShown;
    this.root.querySelector<HTMLElement>('#universe-empty')!.hidden = anyShown;
  }

  private setDifficulty(step: number): void {
    this.difficulty = DIFFICULTY_STEPS[step] ?? '';
    this.filterChanged();
  }

  isSaved(id: string): boolean { return this.saved.has(id); }

  get showingSaved(): boolean { return this.onlySaved; }

  /** Redraw the list after progress changed elsewhere. */
  refresh(): void { this.renderResults(); }

  /** Browser storage rejected a write: the count line tells the user nothing will be kept. */
  noteSessionOnly(): void {
    this.sessionOnly = true;
    this.renderResults();
  }

  /** Enter or leave the Saved list from outside the Songbook; the other filters are kept. */
  showSaved(only: boolean): void {
    if (this.onlySaved === only) return;
    this.onlySaved = only;
    if (only) this.category = 'All';
    this.filterChanged();
  }

  /** Apply a filter change made inside the Songbook and report when it enters or leaves Saved. */
  private applyUserFilter(change: () => void): void {
    const wasSaved = this.onlySaved;
    change();
    this.filterChanged();
    if (wasSaved !== this.onlySaved) this.callbacks.savedFilterChanged();
  }

  /** Mark the song loaded in the quick player; its row button switches between play and pause. */
  setNowPlaying(id: string | null, playing: boolean): void {
    this.nowPlaying = { id, playing };
    this.paintQuickPlays();
  }

  private paintQuickPlays(): void {
    for (const list of [this.list, this.popularList]) {
      for (const button of list?.querySelectorAll<HTMLButtonElement>('[data-quick-play]') ?? []) this.paintQuickPlay(button);
    }
  }

  private paintQuickPlay(button: HTMLButtonElement): void {
    const sounding = this.nowPlaying.playing && button.dataset.quickPlay === this.nowPlaying.id;
    const state = sounding ? 'playing' : button.dataset.quickPlay === this.nowPlaying.id ? 'paused' : 'idle';
    if (button.dataset.state === state) return;
    button.dataset.state = state;
    button.innerHTML = threadIcon(sounding ? 'pause' : 'play');
    button.setAttribute('aria-label', `${sounding ? 'Pause' : 'Play'} ${button.dataset.title}`);
  }

  toggleSaved(id: string): void {
    if (this.saved.has(id)) this.saved.delete(id);
    else this.saved.add(id);
    this.savedEdited();
  }

  savedIds(): string[] { return this.entries.filter(entry => this.saved.has(entry.id)).map(entry => entry.id); }

  /** Adds imported songs to Saved and returns how many were not saved yet. */
  importSaved(ids: readonly string[]): number {
    const before = this.saved.size;
    for (const id of ids) this.saved.add(id);
    this.savedEdited();
    return this.saved.size - before;
  }

  private savedEdited(): void {
    if (!writeStored(SAVED_STORAGE, [...this.saved])) this.sessionOnly = true;
    this.updateSavedCard();
    this.renderCategoryToggle();
    this.renderResults();
    this.callbacks.savedChanged();
  }

  private savedCount(): number {
    return this.entries.filter(entry => this.saved.has(entry.id)).length;
  }

  private updateSavedCard(): void {
    const count = this.savedCount();
    const label = this.categories.querySelector('[data-saved-filter] .category-count');
    if (label) label.innerHTML = countHtml(count, count === 1 ? 'song' : 'songs');
  }

  /** Chips for the current category's universes; a universe outside it resets to Every universe. */
  private renderUniverses(): void {
    const groups = listUniverses(this.entries, this.category);
    if (this.universe && !groups.some(group => group.universes.some(option => option.name === this.universe))) this.universe = '';
    const showGroups = this.category === 'All';
    const face = (label: string, icon: ThreadIcon, count: number) => `<span class="universe-icon" aria-hidden="true">${threadIcon(icon)}</span><span class="universe-name">${escapeHtml(label)}</span>${countHtml(count, count === 1 ? 'melody' : 'melodies')}`;
    const chip = (value: string, label: string, icon: ThreadIcon, count: number) => `<label class="universe-chip"><input class="visually-hidden" type="radio" name="universe" value="${escapeHtml(value)}"${value === this.universe ? ' checked' : ''}>${face(label, icon, count)}</label>`;
    const total = groups.reduce((sum, group) => sum + group.universes.reduce((n, option) => n + option.count, 0), 0);
    const focused = this.universes.contains(document.activeElement);
    const chosen = groups.flatMap(group => group.universes).find(option => option.name === this.universe);
    const optionChip = (option: (typeof groups)[number]['universes'][number]) => chip(option.name, universeLabel(option.name), option.icon, option.count);
    this.universes.innerHTML = chip('', 'Every universe', 'songbook', total) + (chosen ? optionChip(chosen) : '') + groups.map(group => {
      const rest = group.universes.filter(option => option.name !== chosen?.name);
      const heading = `<button class="universe-group" type="button" data-group="${group.category}" aria-expanded="false"><span>${group.category}</span><span class="universe-group-count">${rest.length}</span><span class="universe-chevron" aria-hidden="true"></span></button>`;
      return rest.length ? (showGroups ? heading : '') + rest.map(optionChip).join('') : '';
    }).join('');
    this.filterUniverseChips();
    const checked = this.universes.querySelector<HTMLInputElement>('input:checked');
    if (focused) checked?.focus({ preventScroll: true });
    this.universeFold.toggle.innerHTML = (chosen
      ? face(universeLabel(chosen.name), chosen.icon, chosen.count)
      : face('Every universe', 'songbook', total)) + '<span class="universe-chevron" aria-hidden="true"></span><span class="visually-hidden">, change universe</span>';
  }

  /** The folded category field shows the chosen card's icon, name and count. */
  private renderCategoryToggle(): void {
    const chosen = this.categories.querySelector('[aria-pressed="true"]');
    this.categoryFold.toggle.innerHTML = `<span class="universe-icon" aria-hidden="true">${chosen?.querySelector('.category-symbol')?.innerHTML ?? ''}</span><span class="universe-name">${chosen?.querySelector('.category-name')?.textContent ?? 'All songs'}</span>${chosen?.querySelector('.category-count')?.innerHTML ?? ''}<span class="universe-chevron" aria-hidden="true"></span><span class="visually-hidden">, change category</span>`;
  }

  /** Typing paints its character first; the list follows in the next task, once for a burst of keystrokes. */
  private filterAfterPaint(): void {
    if (this.filterFrame) return;
    this.filterFrame = requestAnimationFrame(() => setTimeout(() => { this.filterFrame = 0; this.filterChanged(); }));
  }

  private filterChanged(): void {
    if (!this.categories.childElementCount) this.categories.innerHTML = (Object.keys(CATEGORY_ICONS) as SongCategory[]).map(category => {
      const count = filterSongbook(this.entries, { category }).length;
      if (category === 'Other' && !count) return '';
      const card = `<button class="category-card" type="button" data-category="${category}" aria-pressed="false"><span class="category-symbol" aria-hidden="true">${threadIcon(CATEGORY_ICONS[category])}</span><span class="category-name stitched-label">${category === 'All' ? 'All songs' : category}</span><span class="category-count">${countHtml(count, count === 1 ? 'melody' : 'melodies')}</span></button>`;
      return category === 'All'
        ? card + `<button class="category-card saved-card" type="button" data-saved-filter aria-pressed="false"><span class="category-symbol" aria-hidden="true">${threadIcon('heart')}</span><span class="category-name stitched-label">Saved</span><span class="category-count"></span></button>`
        : card;
    }).join('');
    this.updateSavedCard();
    for (const button of this.categories.querySelectorAll<HTMLButtonElement>('[data-category]')) {
      button.setAttribute('aria-pressed', String(!this.onlySaved && button.dataset.category === this.category));
    }
    this.categories.querySelector('[data-saved-filter]')?.setAttribute('aria-pressed', String(this.onlySaved));
    this.renderCategoryToggle();
    this.renderUniverses();
    this.renderResults();
  }

  private renderResults(): void {
    const focused = this.list.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    const focusedIndex = focused ? [...this.list.querySelectorAll(FOCUSABLE_ROW_CONTROLS)].indexOf(focused) : -1;
    const focusedId = focused?.dataset.save ?? focused?.dataset.quickPlay ?? focused?.dataset.song;
    this.root.classList.toggle('has-query', !!this.search.value.trim());
    const step = DIFFICULTY_STEPS.indexOf(this.difficulty);
    this.difficultyRange.value = String(step);
    this.difficultyRange.setAttribute('aria-valuetext', this.difficulty ? DIFFICULTY_NAMES[this.difficulty] : 'Any difficulty');
    for (const element of this.root.querySelectorAll<HTMLElement>('.difficulty-step')) element.classList.toggle('is-current', Number(element.dataset.step) === step);
    const name = DIFFICULTY_NAMES[this.difficulty];
    this.difficultyFold.toggle.innerHTML = `${sealHtml(this.difficulty ? 'music' : 'songbook', this.difficulty, 'mini-seal')}<span class="universe-name">${this.difficulty ? name : 'Any difficulty'}</span><span class="universe-chevron" aria-hidden="true"></span><span class="visually-hidden">, change difficulty</span>`;
    const result = filterSongbook(this.entries, { query: this.search.value, category: this.category, universe: this.universe, onlySaved: this.onlySaved, savedIds: this.saved, difficulty: this.difficulty || undefined });
    this.noteSearch(this.search.value, !result.length && !this.universe && !this.onlySaved && this.category === 'All' && !this.difficulty);
    this.count.textContent = `${result.length} ${result.length === 1 ? 'melody' : 'melodies'}${this.sessionOnly ? ' · Saves last for this session only' : ''}`;
    this.reset.hidden = !this.search.value && !this.universe && !this.onlySaved && this.category === 'All' && !this.difficulty;
    const anchors = new Map(letterAnchors(result).map(anchor => [anchor.id, anchor.letter]));
    const progress = this.callbacks.progress();
    const completed = completedIds(progress);
    const shelves = this.reset.hidden && result.length > 0;
    this.writeList({
      resume: shelves ? this.resumeShelfHtml(progress, completed) : null,
      rows: result.length ? [...shelves ? this.featuredShelvesHtml(completed) : [], ...result.map(entry => this.rowHtml(entry, completed, anchors.get(entry.id)))] : [`<p class="empty">${this.onlySaved && !this.savedCount() ? `No saved songs yet. Tap ${threadIcon('heart-empty', 'inline-icon')}<span class="visually-hidden">the heart</span> next to a song to keep it here.` : 'No melodies found. Try another title or clear your filters.'}</p>`],
    });
    if (focused && !focused.isConnected) {
      const buttons = [...this.list.querySelectorAll<HTMLElement>(FOCUSABLE_ROW_CONTROLS)];
      const key = focused.dataset.save ? 'save' : focused.dataset.quickPlay ? 'quickPlay' : 'song';
      const sameSpot = buttons[focusedIndex]?.dataset[key] === focusedId ? buttons[focusedIndex] : undefined;
      const replacement = sameSpot ?? buttons.find(button => button.dataset[key] === focusedId);
      (replacement ?? buttons[Math.min(focusedIndex, buttons.length - 1)] ?? this.reset).focus({ preventScroll: true });
    }
    this.paintQuickPlays();
    this.renderRail([...anchors.values()], result.length);
    this.renderJourney(progress);
    this.renderPopularView(progress, completed);
    this.watchRows();
  }

  private writeList(next: ListMarkup): void {
    const patch = listPatch(this.shownList, next);
    this.shownList = next;
    if (patch.full) {
      this.list.innerHTML = (next.resume === null ? '' : `<div class="resume-shelf">${next.resume}</div>`) + next.rows.join('');
      return;
    }
    if (patch.resume) this.list.querySelector('.resume-shelf')!.innerHTML = next.resume!;
    const first = next.resume === null ? 0 : 1;
    for (const index of patch.rows) this.list.children[first + index]!.outerHTML = next.rows[index]!;
  }

  /** Observes the rows of the list so the ones on screen prefetch their notes. */
  private watchRows(): void {
    if (!this.visibility) return;
    this.visibility.disconnect();
    for (const list of [this.list, this.popularList]) {
      for (const row of list?.querySelectorAll('[data-song]') ?? []) this.visibility.observe(row);
    }
  }

  /** Show the shared ranking; it arrives best first and may name songs this build no longer has. */
  setPopular(ranking: readonly PopularEntry[]): void {
    if (this.builtRankingShown && !ranking.length) return;
    this.builtRankingShown = false;
    const same = ranking.length === this.popular.length && ranking.every((song, index) => song.id === this.popular[index]!.id && song.plays === this.popular[index]!.plays);
    if (same) return;
    this.popular = ranking;
    const progress = this.callbacks.progress();
    this.renderJourney(progress);
    this.renderPopularView(progress, completedIds(progress));
    this.watchRows();
  }

  /** The phone "Popular" view: the same ranking as full Songbook rows, with quick play and save. */
  private renderPopularView(progress: Progress, completed: ReadonlySet<string>): void {
    if (!this.popularList) return;
    const { popular } = journey(this.entries, progress, this.popular);
    this.popularList.innerHTML = popular.map(({ entry, plays }, index) => this.rowHtml(entry, completed, undefined, { rank: index + 1, plays })).join('');
    this.paintQuickPlays();
  }

  /** The desktop side panel: the song to resume, then what everyone plays most (or the welcome copy before any ranking). */
  private renderJourney(progress: Progress): void {
    const { resume, popular } = journey(this.entries, progress, this.popular);
    const resumeMeta = resume && [songMeta(resume.entry), resume.progress.completed && 'Completed', resume.progress.bestCombo > 1 && `Best combo ×${resume.progress.bestCombo}`].filter(Boolean).join(' · ');
    const resumeHtml = resume ? `<section class="journey-section"><p class="eyebrow stitched-label">Continue</p><button class="song-open" type="button" data-song="${escapeHtml(resume.entry.id)}">${sealHtml(resume.entry.icon, resume.entry.difficulty.level)}<span class="song-copy"><span class="song-title">${escapeHtml(resume.entry.title)}</span><span class="song-meta">${escapeHtml(resumeMeta || '')}<span class="visually-hidden"> · ${DIFFICULTY_NAMES[resume.entry.difficulty.level]} difficulty</span></span></span></button></section>` : '';
    const body = popular.length
      ? `<section class="journey-section"><h2 id="journey-title" class="embroidered">Most popular</h2><p class="journey-note">What players have been playing lately.</p><ol class="popular-list">${popular.map(({ entry, plays }, index) => `<li><button class="popular-song" type="button" data-song="${escapeHtml(entry.id)}" title="${escapeHtml(entry.title)} · ${escapeHtml(universeLabel(entry.universe))}">${rankHtml(index + 1)}<span class="popular-copy"><span class="popular-title">${escapeHtml(entry.title)}</span><span class="popular-meta">${escapeHtml(universeLabel(entry.universe))}</span></span>${playsHtml(plays)}</button></li>`).join('')}</ol></section>`
      : '<h2 id="journey-title" class="embroidered">One passage<br>at a time.</h2><p>Listen to a melody, follow the staff and make it yours on the controller.</p>';
    this.journey.innerHTML = resumeHtml + body;
  }

  private rowHtml(entry: SongbookEntry, completed: ReadonlySet<string>, letter?: string, ranked?: { rank: number; plays: number }, withUniverse = true): string {
    return songRowHtml(entry, { base: import.meta.env.BASE_URL, icon: threadIcon, completed: completed.has(entry.id), saved: this.saved.has(entry.id), letter, ranked, withUniverse });
  }

  /** Shown above the full list while no search or filter is active: the song to resume, then the in-game songs. */
  private resumeShelfHtml(progress: Progress, completed: ReadonlySet<string>): string {
    const resumeId = lastOpened(progress, new Set(this.entries.map(entry => entry.id)));
    return this.shelfHtml('Continue', this.entries.filter(entry => entry.id === resumeId), completed).join('');
  }

  private featuredShelvesHtml(completed: ReadonlySet<string>): string[] {
    return [...this.shelfHtml('Songs from the game', gameSongs(this.entries), completed, false), shelfTitle('All songs')];
  }

  private shelfHtml(text: string, songs: readonly SongbookEntry[], completed: ReadonlySet<string>, withUniverse = true): string[] {
    return songs.length ? [shelfTitle(text), ...songs.map(song => this.rowHtml(song, completed, undefined, undefined, withUniverse))] : [];
  }

  /** One stitched letter per initial present in the results; hidden when the list is short. */
  private renderRail(letters: readonly string[], total: number): void {
    this.rail.hidden = total < RAIL_MIN_RESULTS || letters.length < 2;
    this.rail.style.setProperty('--letters', String(letters.length));
    // Knots between the letters are decorative seams that stretch so the rail spans the list.
    const markup = this.rail.hidden ? '' : letters.map((letter, index) =>
      `<button class="letter-slot" type="button" data-letter="${escapeHtml(letter)}" tabindex="${index ? -1 : 0}" aria-label="${letter === '#' ? 'Numbers and symbols' : `Songs starting with ${letter}`}"><span class="stitched-label" aria-hidden="true">${escapeHtml(letter)}</span></button>`).join('<span class="letter-knot" aria-hidden="true"></span>');
    if (markup !== this.shownRail) this.rail.querySelector('.letter-list')!.innerHTML = markup;
    this.shownRail = markup;
    this.markLetterAfterLayout();
  }

  private markLetterAfterLayout(): void {
    // The list stays laid out while hidden; measuring its rows then would only cost time.
    if (this.root.hidden || this.rail.hidden || this.railFrame) return;
    this.railFrame = requestAnimationFrame(() => { this.railFrame = 0; this.markCurrentLetter(); });
  }

  private letterButtons(): HTMLButtonElement[] {
    return [...this.rail.querySelectorAll<HTMLButtonElement>('.letter-slot')];
  }

  private jumpToLetter(letter: string): void {
    const row = this.list.querySelector<HTMLElement>(`.song-row[data-letter="${CSS.escape(letter)}"]`);
    if (!row) return;
    this.tuckControls();
    // The jump itself scrolls the list, maybe upward: it is not a swipe that should bring the controls back.
    this.controlsHeldUntil = performance.now() + 500;
    this.alignRow(row);
    this.markCurrentLetter(letter);
    cancelAnimationFrame(this.jumpFrame);
    const keepAligned = (frames: number): void => {
      this.jumpFrame = frames ? requestAnimationFrame(() => { if (row.isConnected) { this.alignRow(row); keepAligned(frames - 1); } }) : 0;
    };
    keepAligned(JUMP_SETTLE_FRAMES);
  }

  private alignRow(row: HTMLElement): void {
    this.scroller.scrollTop += row.getBoundingClientRect().top - this.scroller.getBoundingClientRect().top - 12;
  }

  /**
   * The letter whose first row is the last one at or above the reading line. The line sits near the
   * top of the visible list, but during the last screen of scroll it slides down to the bottom edge:
   * the final rows can never scroll up to the top, so otherwise their letters would never be marked.
   */
  private markCurrentLetter(forced?: string): void {
    let current = forced;
    if (!current) {
      const { scrollTop, scrollHeight, clientHeight } = this.scroller;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      // Slide over the last screen of scroll, or the whole range when it is shorter than a screen.
      const span = Math.min(clientHeight, maxScroll);
      const progress = span > 0 ? Math.max(0, 1 - (maxScroll - scrollTop) / span) : 0;
      const top = this.scroller.getBoundingClientRect().top + 24 + progress * Math.max(0, clientHeight - 48);
      for (const row of this.list.querySelectorAll<HTMLElement>('.song-row[data-letter]')) {
        if (row.getBoundingClientRect().top > top && current) break;
        current = row.dataset.letter;
      }
    }
    for (const button of this.letterButtons()) {
      if (button.dataset.letter === current) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }

  /**
   * On a phone, once the list is scrolled past the search and filters, a swipe back up pins them over the
   * list and a scroll down tucks them away; back at their own place they return to the page flow.
   * Scrolling the list never tucks them while one of their panels is open.
   */
  private bindFloatingControls(): void {
    const phone = matchMedia('(max-width: 799px)');
    const layout = this.root.querySelector<HTMLElement>('.catalog-layout')!;
    let last = this.scroller.scrollTop;
    let run = 0;
    // The letter rail starts below the pinned controls, and the hanging figure steps aside so it never covers them.
    const setSpace = () => {
      const pinned = this.controls.classList.contains('is-floating') && !this.controls.classList.contains('is-tucked');
      this.root.style.setProperty('--controls-space', pinned ? `${this.universeFold.toggle.getBoundingClientRect().bottom - this.controls.getBoundingClientRect().top + 12}px` : '0px');
      this.root.closest('.app')?.classList.toggle('controls-pinned', pinned);
    };
    this.controls.addEventListener('transitionend', event => {
      if (event.target !== this.controls || !this.controls.classList.contains('is-tucked')) return;
      this.controls.classList.remove('is-floating', 'is-tucked');
    });
    this.scroller.addEventListener('scroll', () => {
      const top = this.scroller.scrollTop;
      const delta = top - last;
      last = top;
      if (this.root.hidden || !delta) return;
      run = performance.now() < this.controlsHeldUntil ? 0 : Math.sign(delta) === Math.sign(run) ? run + delta : delta;
      const floating = this.controls.classList.contains('is-floating');
      const inPlace = !phone.matches || layout.getBoundingClientRect().top > this.scroller.getBoundingClientRect().top;
      if (inPlace) {
        if (floating) this.controls.classList.remove('is-floating', 'is-tucked');
      } else if (run <= -CONTROLS_REVEAL_PX && (!floating || this.controls.classList.contains('is-tucked'))) {
        this.controls.classList.remove('is-tucked');
        this.controls.classList.add('is-floating');
      } else if (run >= CONTROLS_TUCK_PX && floating && !this.folds().some(fold => fold.isOpen())) {
        this.tuckControls();
      }
      setSpace();
    }, { passive: true });
  }

  /** Slides the pinned search and filters out of view; the transition's end returns them to the page flow. */
  private tuckControls(): void {
    if (!this.controls.classList.contains('is-floating') || this.controls.classList.contains('is-tucked')) return;
    if (this.controls.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    this.controls.classList.add('is-tucked');
    this.root.style.setProperty('--controls-space', '0px');
    this.root.closest('.app')?.classList.remove('controls-pinned');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.controls.classList.remove('is-floating', 'is-tucked');
  }

  private bindRail(): void {
    this.scroller.addEventListener('scroll', () => {
      this.markLetterAfterLayout();
    }, { passive: true });
    // Dragging along the rail scrubs through the letters, like a phone contact index.
    // The nearest letter wins, so a pointer over a knot between two letters picks the closer one.
    const buttonAt = (y: number) => {
      const distance = (button: HTMLButtonElement) => { const box = button.getBoundingClientRect(); return Math.abs(y - (box.top + box.height / 2)); };
      return this.letterButtons().reduce<HTMLButtonElement | undefined>((best, button) => !best || distance(button) < distance(best) ? button : best, undefined);
    };
    const scrub = (event: PointerEvent) => {
      const button = buttonAt(event.clientY);
      if (!button) return;
      this.jumpToLetter(button.dataset.letter!);
      const box = button.getBoundingClientRect();
      this.bubble.style.top = `${box.top + box.height / 2 - this.rail.getBoundingClientRect().top}px`;
      this.bubble.textContent = button.dataset.letter!;
      this.rail.classList.add('is-scrubbing');
    };
    const list = this.rail.querySelector<HTMLElement>('.letter-list')!;
    list.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      list.setPointerCapture(event.pointerId);
      scrub(event);
    });
    list.addEventListener('pointermove', event => { if (list.hasPointerCapture(event.pointerId)) scrub(event); });
    const end = () => this.rail.classList.remove('is-scrubbing');
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
    // Keyboard: one tab stop, arrows move between letters, Enter or Space jumps (native click).
    list.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('.letter-slot');
      if (button && event.detail === 0) this.jumpToLetter(button.dataset.letter!);
    });
    list.addEventListener('keydown', event => {
      const buttons = this.letterButtons();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: buttons.length - 1 }[event.key];
      if (next === undefined || index < 0) return;
      event.preventDefault();
      const target = buttons[Math.max(0, Math.min(buttons.length - 1, next))]!;
      buttons.forEach(button => { button.tabIndex = button === target ? 0 : -1; });
      target.focus();
    });
  }
}
