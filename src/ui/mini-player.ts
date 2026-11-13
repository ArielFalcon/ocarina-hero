import type { Arrangement } from '../core/ir';
import { prepareMelody } from '../core/prepare';
import { createPassages, staffTransition } from './lesson';
import type { Player } from './playback';
import { QuickPlay, type QuickPlayState } from './quick-play';
import { songMeta, type SongbookEntry } from './songbook';
import { STAFF_CLEF, staffTokenHtml } from './staff';
import { swapStaff } from './staff-motion';
import { threadIcon } from './thread-icons';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

interface Loaded {
  readonly entry: SongbookEntry;
  readonly arrangement: Arrangement;
  readonly passages: number[][];
}

/**
 * The quick player docked above the bottom navigation: play/pause, the song's
 * live staff and close. It plays the lesson's default arrangement (bends on,
 * ornaments kept) so both views show the same notes.
 */
export class MiniPlayer {
  private readonly quick: QuickPlay;
  private readonly toggleButton: HTMLButtonElement;
  private readonly title: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly tab: HTMLElement;
  private readonly status: HTMLElement;
  private readonly expandButton: HTMLButtonElement;
  private loaded: Loaded | null = null;
  private renderedWindow: { song: unknown; indices: readonly number[] } | null = null;
  private announced = '';
  private motion: Animation | null = null;
  /** True while the player rises in; the song starts once the entrance ends. */
  private starting = false;
  private readonly space = new ResizeObserver(() => this.reserveSpace());

  constructor(private readonly root: HTMLElement, player: Player, private readonly callbacks: {
    open(entry: SongbookEntry): void;
    changed(id: string | null, playing: boolean): void;
  }) {
    this.toggleButton = root.querySelector('#mini-toggle')!;
    this.title = root.querySelector('.mini-title')!;
    this.meta = root.querySelector('.mini-meta')!;
    this.tab = root.querySelector('.tab')!;
    this.status = root.querySelector('#mini-status')!;
    this.quick = new QuickPlay(player, state => this.render(state), error => {
      this.status.textContent = `Playback failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    });
    this.toggleButton.addEventListener('click', () => { if (this.loaded) this.toggle(this.loaded.entry); });
    root.querySelector('#mini-close')!.addEventListener('click', () => this.close());
    const openLesson = (): void => {
      const entry = this.loaded?.entry;
      if (!entry) return;
      this.close();
      this.callbacks.open(entry);
    };
    root.querySelector('#mini-open')!.addEventListener('click', openLesson);
    this.expandButton = root.querySelector('#mini-expand')!;
    this.expandButton.addEventListener('click', openLesson);
  }

  /** Play or pause a song; a different song replaces the current one. A closed player opens before it sounds. */
  toggle(entry: SongbookEntry): void {
    if (this.starting && this.loaded?.entry.id === entry.id) {
      this.starting = false;
      this.render(this.quick.state);
      return;
    }
    if (this.loaded?.entry.id !== entry.id) {
      const track = entry.track;
      const notes = prepareMelody(track, { simplify: false, maxBend: 2 }).notes;
      this.loaded = {
        entry,
        arrangement: { title: track.title, tempoBpm: track.tempoBpm, notes },
        passages: createPassages(notes, track.tempoBpm, track.phraseStarts),
      };
      this.title.textContent = entry.title;
      this.expandButton.setAttribute('aria-label', `Open the lesson for ${entry.title}`);
      this.meta.textContent = songMeta(entry);
      this.tab.classList.toggle('has-modifiers', notes.some(note => !!note.bend));
      this.renderedWindow = null;
      delete this.tab.dataset.notes;
    }
    if (this.isOpen()) {
      this.starting = false;
      this.quick.toggle(entry.id, this.loaded.arrangement);
      return;
    }
    this.starting = true;
    this.quick.load(entry.id, this.loaded.arrangement);
    this.motion?.finished.then(() => this.startAfterEntrance(entry.id), () => {});
  }

  pause(): void {
    this.starting = false;
    this.quick.pause();
  }

  close(): void {
    this.starting = false;
    this.quick.close();
    this.loaded = null;
  }

  private isOpen(): boolean {
    return !this.root.hidden && !this.root.classList.contains('is-leaving');
  }

  private startAfterEntrance(id: string): void {
    if (!this.starting || this.quick.state.id !== id || !this.loaded) return;
    this.starting = false;
    this.quick.toggle(id, this.loaded.arrangement);
  }

  private render(state: QuickPlayState): void {
    const playing = state.playing || this.starting;
    this.callbacks.changed(state.id, playing);
    if (state.id === null || !this.loaded) {
      this.announce('');
      if (this.root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      this.hide();
      return;
    }
    this.show();
    const title = this.loaded.entry.title;
    this.toggleButton.innerHTML = threadIcon(playing ? 'pause' : 'play');
    this.toggleButton.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${title}`);
    this.announce(playing ? `Playing ${title}` : `Paused ${title}`);
    this.renderStaff(state);
  }

  /** Rise in from below the navigation; an interrupted exit reverses from where it is. */
  private show(): void {
    if (this.isOpen()) return;
    this.motion?.cancel();
    this.root.classList.remove('is-leaving');
    this.root.hidden = false;
    this.space.observe(this.root);
    this.motion = this.root.animate(
      reduceMotion.matches ? { opacity: [0, 1] } : { opacity: [0, 1], translate: ['0 24px', '0 0'] },
      { duration: reduceMotion.matches ? 120 : 280, easing: 'cubic-bezier(.22, .72, .18, 1)' },
    );
  }

  private hide(): void {
    if (!this.isOpen()) return;
    this.motion?.cancel();
    this.root.classList.add('is-leaving');
    this.space.unobserve(this.root);
    document.documentElement.style.removeProperty('--mini-player-space');
    const motion = this.root.animate(
      reduceMotion.matches ? { opacity: [1, 0] } : { opacity: [1, 0], translate: ['0 0', '0 24px'] },
      { duration: reduceMotion.matches ? 100 : 200, easing: 'cubic-bezier(.5, 0, .75, .4)', fill: 'forwards' },
    );
    this.motion = motion;
    motion.finished.then(() => {
      if (this.motion !== motion) return;
      this.root.hidden = true;
      this.root.classList.remove('is-leaving');
      motion.cancel();
    }, () => {});
  }

  /** Keep the Songbook's last rows reachable above the floating player. */
  private reserveSpace(): void {
    if (!this.isOpen()) return;
    document.documentElement.style.setProperty('--mini-player-space', `${this.root.offsetHeight + 16}px`);
  }

  /** Announce play and pause changes only, never animation frames. */
  private announce(message: string): void {
    if (message === this.announced) return;
    this.announced = message;
    this.status.textContent = message;
  }

  private renderStaff(state: QuickPlayState): void {
    const { arrangement, passages } = this.loaded!;
    const focus = state.activeNote ?? state.cursor;
    const indices = passages.find(passage => passage.includes(focus)) ?? passages[0] ?? [];
    const signature = indices.join(',');
    if (this.tab.dataset.notes !== signature) {
      const next = { song: arrangement, indices };
      swapStaff(this.tab, staffTransition(this.renderedWindow, next), () => {
        this.tab.innerHTML = STAFF_CLEF + indices.map((index, slot) => staffTokenHtml(arrangement.notes[index]!, index, slot, indices.length)).join('');
      });
      this.renderedWindow = next;
      this.tab.dataset.notes = signature;
    }
    const beatMs = 60000 / arrangement.tempoBpm;
    for (const token of this.tab.querySelectorAll<HTMLElement>('[data-note-index]')) {
      const index = Number(token.dataset.noteIndex);
      const playing = state.activeNote === index;
      token.classList.toggle('is-playing', playing);
      token.classList.toggle('is-past', index < (state.activeNote ?? state.cursor));
      if (playing && !token.style.getPropertyValue('--note-ms')) {
        token.style.setProperty('--note-ms', `${Math.max(120, (arrangement.notes[index]!.durationBeats || 1) * beatMs)}ms`);
      } else if (!playing) token.style.removeProperty('--note-ms');
    }
  }
}
