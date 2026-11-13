import { threadIcon, type ThreadIcon } from './thread-icons';
import { createSongbookEntries, filterSongbook, letterAnchors, listUniverses, songMeta, universeLabel, type SongbookEntry, type SongCategory } from './songbook';
import type { DemoTrack } from '../core/demo';
import { DIFFICULTY_LEVELS, type DifficultyLevel } from '../core/difficulty';
import { gameSongs } from './featured';
import { completedIds, lastOpened, type Progress } from './progress';
import { isEmptyJourney, journey } from './journey';
import { SAVED_STORAGE } from './local-data';

/** Below this many results the list is short enough to scan, so the letter rail is hidden. */
const RAIL_MIN_RESULTS = 12;
/** Range steps: 0 is every difficulty, then one step per tier. */
const DIFFICULTY_STEPS = ['', ...DIFFICULTY_LEVELS] as const;
const DIFFICULTY_NAMES: Record<DifficultyLevel | '', string> = { '': 'Any', easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

/** A song seal; its tier frame is a decorative overlay outside the slot. */
function sealHtml(icon: ThreadIcon, level: DifficultyLevel | '', extraClass = ''): string {
  return `<span class="song-seal${extraClass ? ` ${extraClass}` : ''}"${level ? ` data-difficulty="${level}"` : ''} aria-hidden="true">${threadIcon(icon)}${level ? '<span class="seal-frame"></span>' : ''}</span>`;
}

const CATEGORY_ICONS: Record<SongCategory, ThreadIcon> = { All: 'songbook', Games: 'gamepad', Anime: 'anime', Film: 'film', Pop: 'microphone', Classics: 'lyre', Other: 'collection' };

/** A visible count badge; the noun stays available to assistive technology only. */
function countHtml(count: number, noun: string): string {
  return `<span class="count-badge" aria-hidden="true">${count}</span><span class="visually-hidden">${count} ${noun}</span>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

/**
 * A field-like toggle that opens its panel below it. Folded, the panel is inert;
 * opening scrolls only as much as needed to show it below the toggle.
 */
/** Below this height a floating panel is too cramped, so the page scrolls to make room instead. */
const MIN_FLOATING_PANEL_PX = 240;

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
    // A floating panel (desktop) fits the room below its toggle and scrolls inside, so the page stays put.
    if (getComputedStyle(this.panel).position === 'absolute') {
      this.panel.style.maxHeight = `min(62vh, 560px, ${Math.max(MIN_FLOATING_PANEL_PX, bottomEdge - toggle.bottom - 24)}px)`;
    } else {
      this.panel.style.removeProperty('max-height');
    }
    const overflow = toggle.bottom + this.panel.offsetHeight - bottomEdge;
    if (overflow <= 0) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollBy({ top: Math.min(overflow + 16, toggle.top - 72), behavior: smooth ? 'smooth' : 'auto' });
  }
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
  private categories: HTMLElement;
  private count: HTMLElement;
  private rail: HTMLElement;
  private bubble: HTMLElement;
  private scroller: HTMLElement;
  private railFrame = 0;
  private reset: HTMLButtonElement;
  private filters: HTMLDetailsElement;
  private filterSummary: HTMLElement;
  private filterSummaryDetail: HTMLElement;
  /** Desktop keeps the filters unfolded and floats one panel at a time over the list. */
  private desktop = matchMedia('(min-width: 800px)');
  private difficulty: DifficultyLevel | '' = '';
  private difficultyRange: HTMLInputElement;
  private nowPlaying: { id: string | null; playing: boolean } = { id: null, playing: false };

  constructor(private root: HTMLElement, tracks: readonly DemoTrack[], private callbacks: {
    select(entry: SongbookEntry): void;
    quickPlay(entry: SongbookEntry): void;
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
    this.universeFold = new Fold(root.querySelector('#universe-toggle')!, root.querySelector('#universe-panel')!, this.universes, 'input:checked', () => this.foldOthers(this.universeFold));
    this.categoryFold = new Fold(root.querySelector('#category-toggle')!, root.querySelector('#category-panel')!, this.categories, '[aria-pressed="true"]', () => this.foldOthers(this.categoryFold));
    this.count = root.querySelector('#catalog-count')!;
    this.rail = root.querySelector('#letter-rail')!;
    this.bubble = root.querySelector('#letter-bubble')!;
    this.scroller = root.closest<HTMLElement>('main') ?? document.documentElement;
    this.reset = root.querySelector('#reset-search')!;
    this.filters = root.querySelector('#catalog-filters')!;
    this.filterSummary = root.querySelector('#filter-summary')!;
    this.filterSummaryDetail = root.querySelector('#filter-summary-detail')!;
    this.desktop.addEventListener('change', () => this.syncFilterDisclosure());
    this.syncFilterDisclosure();
    document.addEventListener('pointerdown', event => {
      if (!this.desktop.matches || (event.target instanceof Node && this.filters.contains(event.target))) return;
      for (const fold of this.folds()) fold.setOpen(false);
    });
    this.difficultyRange = root.querySelector('#difficulty-range')!;
    const steps = root.querySelector<HTMLElement>('#difficulty-steps')!;
    steps.innerHTML = DIFFICULTY_STEPS.map((level, index) => `<span class="difficulty-step" data-step="${index}">${sealHtml(level ? 'music' : 'songbook', level, 'mini-seal')}<span class="difficulty-name stitched-label">${DIFFICULTY_NAMES[level]}</span></span>`).join('');
    this.difficultyFold = new Fold(root.querySelector('#difficulty-toggle')!, root.querySelector('#difficulty-panel')!, root.querySelector('#difficulty-scale')!, '#difficulty-range', () => this.foldOthers(this.difficultyFold));
    this.difficultyRange.addEventListener('input', () => this.setDifficulty(Number(this.difficultyRange.value)));
    let dragging = false;
    this.difficultyRange.addEventListener('pointerdown', () => { dragging = true; });
    this.difficultyRange.addEventListener('change', () => { if (dragging) this.difficultyFold.fold(); dragging = false; });
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
    try {
      const value: unknown = JSON.parse(localStorage.getItem(SAVED_STORAGE) ?? '[]');
      if (Array.isArray(value)) this.saved = new Set(value.filter((id): id is string => typeof id === 'string'));
    } catch { this.sessionOnly = true; }
    this.search.addEventListener('input', () => {
      if (!this.desktop.matches) this.filters.open = false;
      this.filterChanged();
    });
    // Pointer picks fold the panel; arrow keys only browse, so keyboard users fold with Enter or Space.
    let pointerPick = false;
    this.universes.addEventListener('pointerdown', () => { pointerPick = true; });
    this.universes.addEventListener('change', event => {
      this.universe = (event.target as HTMLInputElement).value;
      this.filterChanged();
      if (pointerPick) this.universeFold.fold();
      pointerPick = false;
    });
    this.universeFold.panel.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.universeFold.fold();
    });
    this.bindRail();
    this.reset.addEventListener('click', () => {
      this.applyUserFilter(() => {
        this.search.value = '';
        this.universe = '';
        this.onlySaved = false;
        this.category = 'All';
        this.difficulty = '';
        this.syncFilterDisclosure();
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
    this.list.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-song], [data-save], [data-quick-play]');
      if (button?.dataset.save) { this.toggleSaved(button.dataset.save); return; }
      const id = button?.dataset.quickPlay ?? button?.dataset.song;
      const entry = id && this.entries.find(item => item.id === id);
      if (!entry) return;
      if (button!.dataset.quickPlay) this.callbacks.quickPlay(entry);
      else this.callbacks.select(entry);
    });
    this.journey.addEventListener('click', event => {
      const id = (event.target as Element).closest<HTMLButtonElement>('[data-song]')?.dataset.song;
      const entry = id && this.entries.find(item => item.id === id);
      if (entry) this.callbacks.select(entry);
    });
    this.filterChanged();
  }

  private folds(): Fold[] { return [this.categoryFold, this.universeFold, this.difficultyFold]; }

  /** Floating desktop panels would overlap, so opening one folds the rest. */
  private foldOthers(opened: Fold): void {
    if (!this.desktop.matches) return;
    for (const fold of this.folds()) if (fold !== opened) fold.setOpen(false);
  }

  /** Desktop keeps the filters open, as folding them would move the list (its summary is hidden); phones rest them folded so the songs start on the first screen. */
  private syncFilterDisclosure(): void {
    this.filters.open = this.desktop.matches;
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
    for (const button of this.list.querySelectorAll<HTMLButtonElement>('[data-quick-play]')) this.paintQuickPlay(button);
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
    try { localStorage.setItem(SAVED_STORAGE, JSON.stringify([...this.saved])); }
    catch { this.sessionOnly = true; }
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
    this.universes.innerHTML = chip('', 'Every universe', 'songbook', total) + groups.map(group =>
      (showGroups ? `<span class="universe-group" aria-hidden="true">${group.category}</span>` : '')
      + group.universes.map(option => chip(option.name, universeLabel(option.name), option.icon, option.count)).join('')).join('');
    const checked = this.universes.querySelector<HTMLInputElement>('input:checked');
    if (focused) checked?.focus({ preventScroll: true });
    const current = groups.flatMap(group => group.universes).find(option => option.name === this.universe);
    this.universeFold.toggle.innerHTML = (current
      ? face(universeLabel(current.name), current.icon, current.count)
      : face('Every universe', 'songbook', total)) + '<span class="universe-chevron" aria-hidden="true"></span><span class="visually-hidden"> — change universe</span>';
  }

  /** The folded category field shows the chosen card's icon, name and count. */
  private renderCategoryToggle(): void {
    const chosen = this.categories.querySelector('[aria-pressed="true"]');
    this.categoryFold.toggle.innerHTML = `<span class="universe-icon" aria-hidden="true">${chosen?.querySelector('.category-symbol')?.innerHTML ?? ''}</span><span class="universe-name">${chosen?.querySelector('.category-name')?.textContent ?? 'All songs'}</span>${chosen?.querySelector('.category-count')?.innerHTML ?? ''}<span class="universe-chevron" aria-hidden="true"></span><span class="visually-hidden"> — change category</span>`;
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
    const focused = this.list.contains(document.activeElement) ? document.activeElement as HTMLButtonElement : null;
    const focusedIndex = focused ? [...this.list.querySelectorAll('button')].indexOf(focused) : -1;
    const focusedId = focused?.dataset.save ?? focused?.dataset.quickPlay ?? focused?.dataset.song;
    this.root.classList.toggle('has-query', !!this.search.value.trim());
    const step = DIFFICULTY_STEPS.indexOf(this.difficulty);
    this.difficultyRange.value = String(step);
    this.difficultyRange.setAttribute('aria-valuetext', this.difficulty ? DIFFICULTY_NAMES[this.difficulty] : 'Any difficulty');
    for (const element of this.root.querySelectorAll<HTMLElement>('.difficulty-step')) element.classList.toggle('is-current', Number(element.dataset.step) === step);
    const name = DIFFICULTY_NAMES[this.difficulty];
    this.difficultyFold.toggle.innerHTML = `${sealHtml(this.difficulty ? 'music' : 'songbook', this.difficulty, 'mini-seal')}<span class="universe-name">${this.difficulty ? name : 'Any difficulty'}</span><span class="universe-chevron" aria-hidden="true"></span><span class="visually-hidden"> — change difficulty</span>`;
    this.filterSummaryDetail.textContent = [this.onlySaved ? 'Saved' : this.category === 'All' ? '' : this.category, this.universe, this.difficulty && DIFFICULTY_NAMES[this.difficulty]].filter(Boolean).map(part => ` · ${part}`).join('');
    const result = filterSongbook(this.entries, { query: this.search.value, category: this.category, universe: this.universe, onlySaved: this.onlySaved, savedIds: this.saved, difficulty: this.difficulty || undefined });
    this.count.textContent = `${result.length} ${result.length === 1 ? 'melody' : 'melodies'}${this.sessionOnly ? ' · Saves last for this session only' : ''}`;
    this.reset.hidden = !this.search.value && !this.universe && !this.onlySaved && this.category === 'All' && !this.difficulty;
    const anchors = new Map(letterAnchors(result).map(anchor => [anchor.id, anchor.letter]));
    const progress = this.callbacks.progress();
    const completed = completedIds(progress);
    const shelves = this.reset.hidden ? this.shelvesHtml(progress, completed) : '';
    this.list.innerHTML = result.length ? shelves + result.map(entry => this.rowHtml(entry, completed, anchors.get(entry.id))).join('') : `<p class="empty">${this.onlySaved && !this.savedCount() ? `No saved songs yet. Tap ${threadIcon('heart-empty', 'inline-icon')}<span class="visually-hidden">the heart</span> next to a song to keep it here.` : 'No melodies found. Try another title or clear your filters.'}</p>`;
    if (focused) {
      const buttons = [...this.list.querySelectorAll<HTMLButtonElement>('button')];
      const key = focused.dataset.save ? 'save' : focused.dataset.quickPlay ? 'quickPlay' : 'song';
      const sameSpot = buttons[focusedIndex]?.dataset[key] === focusedId ? buttons[focusedIndex] : undefined;
      const replacement = sameSpot ?? buttons.find(button => button.dataset[key] === focusedId);
      (replacement ?? buttons[Math.min(focusedIndex, buttons.length - 1)] ?? this.reset).focus({ preventScroll: true });
    }
    for (const button of this.list.querySelectorAll<HTMLButtonElement>('[data-quick-play]')) this.paintQuickPlay(button);
    this.renderRail([...anchors.values()], result.length);
    this.renderJourney(progress);
  }

  /** The desktop side panel: resume, overall progress, the suggested next song and the first saved songs. */
  private renderJourney(progress: Progress): void {
    const state = journey(this.entries, progress, this.saved);
    if (isEmptyJourney(state)) {
      this.journey.innerHTML = '<h2 id="journey-title" class="embroidered">One passage<br>at a time.</h2><p>Listen to a melody, follow the staff and make it yours on the controller.</p>';
      return;
    }
    const song = (entry: SongbookEntry, meta: string) => `<button class="song-open journey-song" type="button" data-song="${escapeHtml(entry.id)}">${sealHtml(entry.icon, entry.difficulty.level)}<span class="song-copy"><span class="song-title">${escapeHtml(entry.title)}</span><span class="song-meta">${escapeHtml(meta)}<span class="visually-hidden"> · ${DIFFICULTY_NAMES[entry.difficulty.level]} difficulty</span></span></span></button>`;
    const section = (label: string, body: string) => `<section class="journey-section"><h3 class="eyebrow stitched-label">${label}</h3>${body}</section>`;
    const resume = state.resume;
    const resumeMeta = resume && [songMeta(resume.entry), resume.progress.completed && 'Completed', resume.progress.bestCombo > 1 && `Best combo ×${resume.progress.bestCombo}`].filter(Boolean).join(' · ');
    const ratio = state.total ? state.completed / state.total : 0;
    this.journey.innerHTML = '<h2 id="journey-title" class="embroidered">Your journey</h2>'
      + (resume ? section('Continue', song(resume.entry, resumeMeta || '')) : '')
      + section('Progress', `<p class="progress-heading"><span>${state.completed} of ${state.total} songs completed</span><span aria-hidden="true">${Math.round(ratio * 100)}%</span></p><div class="progress-track" style="--progress-ratio: ${ratio}"><progress value="${state.completed}" max="${Math.max(1, state.total)}" aria-label="Songs completed"></progress></div>`)
      + (state.next ? section('Up next', song(state.next, songMeta(state.next))) : '')
      + (state.savedCount ? section('Saved', `<ul class="journey-saved">${state.saved.map(entry => `<li><button class="text-button" type="button" data-song="${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</button></li>`).join('')}</ul>${state.savedCount > state.saved.length ? `<button class="text-button journey-all" type="button" data-view-link="saved">See all ${state.savedCount} saved</button>` : ''}`) : '');
  }

  private rowHtml(entry: SongbookEntry, completed: ReadonlySet<string>, letter?: string): string {
    const title = escapeHtml(entry.title);
    const saved = this.saved.has(entry.id);
    return `<article class="song-row"${letter ? ` data-letter="${escapeHtml(letter)}"` : ''}><button class="song-open" type="button" data-song="${escapeHtml(entry.id)}">${sealHtml(entry.icon, entry.difficulty.level)}<span class="song-copy"><span class="song-title">${title}</span><span class="song-meta">${escapeHtml(songMeta(entry))}${completed.has(entry.id) ? '<span class="song-done"> · Completed</span>' : ''}<span class="visually-hidden"> · ${DIFFICULTY_NAMES[entry.difficulty.level]} difficulty</span></span></span></button><button class="patch-button quick-play" type="button" data-quick-play="${escapeHtml(entry.id)}" data-title="${title}"></button><button class="save-button" type="button" data-save="${escapeHtml(entry.id)}" aria-label="${saved ? 'Remove' : 'Save'} ${title}${saved ? ' from saved songs' : ''}" aria-pressed="${saved}">${threadIcon(saved ? 'heart-filled' : 'heart-empty')}</button></article>`;
  }

  /** Shown above the full list while no search or filter is active: the song to resume, then the in-game songs. */
  private shelvesHtml(progress: Progress, completed: ReadonlySet<string>): string {
    const resumeId = lastOpened(progress, new Set(this.entries.map(entry => entry.id)));
    const resume = this.entries.filter(entry => entry.id === resumeId);
    const title = (text: string) => `<h2 class="shelf-title eyebrow stitched-label">${text}</h2>`;
    const shelf = (text: string, songs: readonly SongbookEntry[]) => songs.length ? title(text) + songs.map(song => this.rowHtml(song, completed)).join('') : '';
    return `<div class="resume-shelf">${shelf('Continue', resume)}</div>` + shelf('Songs from the game', gameSongs(this.entries)) + title('All songs');
  }

  /** One stitched letter per initial present in the results; hidden when the list is short. */
  private renderRail(letters: readonly string[], total: number): void {
    this.rail.hidden = total < RAIL_MIN_RESULTS || letters.length < 2;
    this.rail.style.setProperty('--letters', String(letters.length));
    // Knots between the letters are decorative seams; on desktop they stretch so the rail spans the list.
    this.rail.querySelector('.letter-list')!.innerHTML = this.rail.hidden ? '' : letters.map((letter, index) =>
      `<button class="letter-slot" type="button" data-letter="${escapeHtml(letter)}" tabindex="${index ? -1 : 0}" aria-label="${letter === '#' ? 'Numbers and symbols' : `Songs starting with ${letter}`}"><span class="stitched-label" aria-hidden="true">${escapeHtml(letter)}</span></button>`).join('<span class="letter-knot" aria-hidden="true"></span>');
    this.markCurrentLetter();
  }

  private letterButtons(): HTMLButtonElement[] {
    return [...this.rail.querySelectorAll<HTMLButtonElement>('.letter-slot')];
  }

  private jumpToLetter(letter: string): void {
    const row = this.list.querySelector<HTMLElement>(`.song-row[data-letter="${CSS.escape(letter)}"]`);
    if (!row) return;
    this.scroller.scrollTop += row.getBoundingClientRect().top - this.scroller.getBoundingClientRect().top - 12;
    this.markCurrentLetter(letter);
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

  private bindRail(): void {
    this.scroller.addEventListener('scroll', () => {
      if (this.rail.hidden || this.railFrame) return;
      this.railFrame = requestAnimationFrame(() => { this.railFrame = 0; this.markCurrentLetter(); });
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
