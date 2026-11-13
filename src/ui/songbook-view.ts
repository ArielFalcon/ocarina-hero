import { threadIcon, type ThreadIcon } from './thread-icons';
import { createSongbookEntries, filterSongbook, letterAnchors, listUniverses, songMeta, universeLabel, type SongbookEntry, type SongCategory } from './songbook';
import type { DemoTrack } from '../core/demo';
import { DIFFICULTY_LEVELS, type DifficultyLevel } from '../core/difficulty';

const SAVED_KEY = 'ocarina.saved.v1';
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
class Fold {
  constructor(readonly toggle: HTMLButtonElement, readonly panel: HTMLElement, private content: HTMLElement, focusSelector: string) {
    toggle.addEventListener('click', () => {
      const open = !this.isOpen();
      this.setOpen(open);
      if (!open) return;
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
    const overflow = toggle.bottom + this.content.scrollHeight - bottomEdge;
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
  private categories: HTMLElement;
  private count: HTMLElement;
  private rail: HTMLElement;
  private bubble: HTMLElement;
  private scroller: HTMLElement;
  private railFrame = 0;
  private reset: HTMLButtonElement;
  private filters: HTMLDetailsElement;
  private filterSummary: HTMLElement;
  private difficulty: DifficultyLevel | '' = '';
  private difficultyRange: HTMLInputElement;
  private nowPlaying: { id: string | null; playing: boolean } = { id: null, playing: false };

  constructor(private root: HTMLElement, tracks: readonly DemoTrack[], private callbacks: {
    select(entry: SongbookEntry): void;
    quickPlay(entry: SongbookEntry): void;
    savedChanged(): void;
  }) {
    this.entries = createSongbookEntries(tracks).sort((a, b) => a.title.localeCompare(b.title, 'en') || a.id.localeCompare(b.id, 'en'));
    this.search = root.querySelector('#song-search')!;
    this.universes = root.querySelector('#universes')!;
    this.list = root.querySelector('#demos')!;
    this.categories = root.querySelector('#categories')!;
    this.universeFold = new Fold(root.querySelector('#universe-toggle')!, root.querySelector('#universe-panel')!, this.universes, 'input:checked');
    this.categoryFold = new Fold(root.querySelector('#category-toggle')!, root.querySelector('#category-panel')!, this.categories, '[aria-pressed="true"]');
    this.count = root.querySelector('#catalog-count')!;
    this.rail = root.querySelector('#letter-rail')!;
    this.bubble = root.querySelector('#letter-bubble')!;
    this.scroller = root.closest<HTMLElement>('main') ?? document.documentElement;
    this.reset = root.querySelector('#reset-search')!;
    this.filters = root.querySelector('#catalog-filters')!;
    this.filterSummary = root.querySelector('#filter-summary')!;
    this.difficultyRange = root.querySelector('#difficulty-range')!;
    const steps = root.querySelector<HTMLElement>('#difficulty-steps')!;
    steps.innerHTML = DIFFICULTY_STEPS.map((level, index) => `<span class="difficulty-step" data-step="${index}">${sealHtml(level ? 'music' : 'songbook', level, 'mini-seal')}<span class="difficulty-name stitched-label">${DIFFICULTY_NAMES[level]}</span></span>`).join('');
    this.difficultyFold = new Fold(root.querySelector('#difficulty-toggle')!, root.querySelector('#difficulty-panel')!, root.querySelector('#difficulty-scale')!, '#difficulty-range');
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
      const value: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
      if (Array.isArray(value)) this.saved = new Set(value.filter((id): id is string => typeof id === 'string'));
    } catch { this.sessionOnly = true; }
    this.search.addEventListener('input', () => {
      this.filters.open = !this.search.value.trim();
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
      this.search.value = '';
      this.universe = '';
      this.onlySaved = false;
      this.category = 'All';
      this.difficulty = '';
      this.filters.open = true;
      this.filterChanged();
      this.search.focus();
    });
    this.categories.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-category], [data-saved-filter]');
      if (!button) return;
      this.onlySaved = button.dataset.savedFilter !== undefined;
      this.category = this.onlySaved ? 'All' : button.dataset.category as SongCategory;
      this.filterChanged();
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
    this.filterChanged();
  }

  private setDifficulty(step: number): void {
    this.difficulty = DIFFICULTY_STEPS[step] ?? '';
    this.filterChanged();
  }

  isSaved(id: string): boolean { return this.saved.has(id); }

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
    try { localStorage.setItem(SAVED_KEY, JSON.stringify([...this.saved])); }
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
    this.filterSummary.textContent = ['Filters', this.onlySaved ? 'Saved' : this.category === 'All' ? '' : this.category, this.universe, this.difficulty && DIFFICULTY_NAMES[this.difficulty]].filter(Boolean).join(' · ');
    const result = filterSongbook(this.entries, { query: this.search.value, category: this.category, universe: this.universe, onlySaved: this.onlySaved, savedIds: this.saved, difficulty: this.difficulty || undefined });
    this.count.textContent = `${result.length} ${result.length === 1 ? 'melody' : 'melodies'}${this.sessionOnly ? ' · Saves last for this session only' : ''}`;
    this.reset.hidden = !this.search.value && !this.universe && !this.onlySaved && this.category === 'All' && !this.difficulty;
    const anchors = new Map(letterAnchors(result).map(anchor => [anchor.id, anchor.letter]));
    this.list.innerHTML = result.length ? result.map(entry => {
      const title = escapeHtml(entry.title);
      const letter = anchors.get(entry.id);
      return `<article class="song-row"${letter ? ` data-letter="${escapeHtml(letter)}"` : ''}><button class="song-open" type="button" data-song="${escapeHtml(entry.id)}">${sealHtml(entry.icon, entry.difficulty.level)}<span class="song-copy"><span class="song-title">${title}</span><span class="song-meta">${escapeHtml(songMeta(entry))}<span class="visually-hidden"> · ${DIFFICULTY_NAMES[entry.difficulty.level]} difficulty</span></span></span></button><button class="patch-button quick-play" type="button" data-quick-play="${escapeHtml(entry.id)}" data-title="${title}"></button><button class="save-button" type="button" data-save="${escapeHtml(entry.id)}" aria-label="${this.saved.has(entry.id) ? 'Remove' : 'Save'} ${title}${this.saved.has(entry.id) ? ' from saved songs' : ''}" aria-pressed="${this.saved.has(entry.id)}">${threadIcon(this.saved.has(entry.id) ? 'heart-filled' : 'heart-empty')}</button></article>`;
    }).join('') : `<p class="empty">${this.onlySaved && !this.savedCount() ? `No saved songs yet. Tap ${threadIcon('heart-empty', 'inline-icon')}<span class="visually-hidden">the heart</span> next to a song to keep it here.` : 'No melodies found. Try another title or clear your filters.'}</p>`;
    if (focused) {
      const buttons = [...this.list.querySelectorAll<HTMLButtonElement>('button')];
      const key = focused.dataset.save ? 'save' : focused.dataset.quickPlay ? 'quickPlay' : 'song';
      const replacement = buttons.find(button => button.dataset[key] === focusedId);
      (replacement ?? buttons[Math.min(focusedIndex, buttons.length - 1)] ?? this.reset).focus({ preventScroll: true });
    }
    for (const button of this.list.querySelectorAll<HTMLButtonElement>('[data-quick-play]')) this.paintQuickPlay(button);
    this.renderRail([...anchors.values()], result.length);
  }

  /** One stitched letter per initial present in the results; hidden when the list is short. */
  private renderRail(letters: readonly string[], total: number): void {
    this.rail.hidden = total < RAIL_MIN_RESULTS || letters.length < 2;
    this.rail.style.setProperty('--letters', String(letters.length));
    this.rail.querySelector('.letter-list')!.innerHTML = this.rail.hidden ? '' : letters.map((letter, index) =>
      `<button class="letter-slot" type="button" data-letter="${escapeHtml(letter)}" tabindex="${index ? -1 : 0}" aria-label="${letter === '#' ? 'Numbers and symbols' : `Songs starting with ${letter}`}"><span class="stitched-label" aria-hidden="true">${escapeHtml(letter)}</span></button>`).join('');
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

  /** The letter whose first row is the last one at or above the top of the visible list. */
  private markCurrentLetter(forced?: string): void {
    let current = forced;
    if (!current) {
      const top = this.scroller.getBoundingClientRect().top + 24;
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
    const buttonAt = (y: number) => {
      const buttons = this.letterButtons();
      return buttons.find(button => y < button.getBoundingClientRect().bottom) ?? buttons.at(-1);
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
