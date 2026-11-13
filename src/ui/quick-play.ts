import type { Arrangement } from '../core/ir';
import { playbackSelection } from './lesson';
import { Playback, type Frames, type Player } from './playback';

export interface QuickPlayState {
  /** Song loaded in the quick player, or null when it is closed. */
  readonly id: string | null;
  readonly playing: boolean;
  /** Arrangement index of the sounding note, or null between notes and while paused. */
  readonly activeNote: number | null;
  /** Arrangement index where the next play resumes. */
  readonly cursor: number;
}

export interface Timers {
  set(run: () => void, ms: number): number;
  clear(id: number): void;
}

/** Silence between two songs when one interrupts another, so they never run together. */
const SWITCH_PAUSE_MS = 350;

/**
 * Quick playback of a song from the Songbook, without opening its lesson.
 * Pausing keeps the position: resuming starts again at the note that was sounding.
 */
export class QuickPlay {
  private id: string | null = null;
  private arrangement: Arrangement | null = null;
  private indices: number[] = [];
  private activeNote: number | null = null;
  private cursor = 0;
  private playing = false;
  private pendingStart: number | null = null;
  private readonly playback: Playback;

  constructor(player: Player, private readonly onChange: (state: QuickPlayState) => void, onError: (error: unknown) => void, frames?: Frames, private readonly timers: Timers = {
    set: (run, ms) => window.setTimeout(run, ms),
    clear: id => window.clearTimeout(id),
  }) {
    this.playback = new Playback(player, {
      highlight: index => {
        this.activeNote = index === null ? null : this.indices[index] ?? null;
        if (this.activeNote !== null) this.cursor = this.activeNote;
        this.emit();
      },
      status: playing => { this.playing = playing; this.emit(); },
      complete: () => { this.cursor = 0; this.emit(); },
      error: onError,
    }, frames);
  }

  get state(): QuickPlayState {
    return { id: this.id, playing: this.playing, activeNote: this.activeNote, cursor: this.cursor };
  }

  /** Load a song paused at its start; the current song stops. */
  load(id: string, arrangement: Arrangement): void {
    if (id === this.id) return;
    this.cancelPendingStart();
    this.id = id;
    this.arrangement = arrangement;
    this.cursor = 0;
    this.playback.stop();
    this.emit();
  }

  /** Play or pause the given song; another song replaces the current one from its start. */
  toggle(id: string, arrangement: Arrangement): void {
    if (id === this.id && this.playing) { this.pause(); return; }
    const interrupting = this.playing && id !== this.id;
    this.load(id, arrangement);
    this.cancelPendingStart();
    if (!interrupting) { this.resume(); return; }
    this.pendingStart = this.timers.set(() => { this.pendingStart = null; this.resume(); }, SWITCH_PAUSE_MS);
  }

  pause(): void {
    this.cancelPendingStart();
    if (this.playing) this.playback.stop();
  }

  close(): void {
    this.cancelPendingStart();
    if (this.id === null) return;
    this.playback.stop();
    this.id = null;
    this.arrangement = null;
    this.cursor = 0;
    this.emit();
  }

  private resume(): void {
    if (!this.arrangement?.notes.length) { this.emit(); return; }
    const selection = playbackSelection(this.arrangement, [], this.cursor, false);
    this.indices = selection.indices;
    void this.playback.start(selection.arrangement);
  }

  private cancelPendingStart(): void {
    if (this.pendingStart === null) return;
    this.timers.clear(this.pendingStart);
    this.pendingStart = null;
  }

  private emit(): void {
    this.onChange(this.state);
  }
}
