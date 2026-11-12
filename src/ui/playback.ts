import type { Arrangement } from '../core/ir';

interface Player {
  play(arrangement: Arrangement): Promise<number>;
  stopAll(): void;
  getPlaybackState(): { playing: boolean; noteIndex: number | null };
}

interface Callbacks {
  highlight(index: number | null): void;
  status(playing: boolean): void;
  error(error: unknown): void;
  complete?(): void;
}

interface Frames {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

/** Owns the UI lifecycle; the engine remains the source of playback timing. */
export class Playback {
  private generation = 0;
  private frame: number | null = null;
  private active = false;

  constructor(private player: Player, private callbacks: Callbacks, private frames: Frames = {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
  }) {}

  get playing(): boolean { return this.active; }

  private finish(): void {
    this.generation += 1;
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
    this.active = false;
    this.callbacks.status(false);
    this.callbacks.highlight(null);
  }

  stop(): void {
    this.player.stopAll();
    this.finish();
  }

  async start(arrangement: Arrangement, rate = 1): Promise<void> {
    if (!Number.isFinite(rate) || rate <= 0) {
      this.callbacks.error(new RangeError('Playback speed must be a positive finite number.'));
      return;
    }
    this.stop();
    const id = ++this.generation;
    this.active = true;
    this.callbacks.status(true);
    try {
      const end = await this.player.play({ ...arrangement, tempoBpm: arrangement.tempoBpm * rate });
      if (id !== this.generation) return;
      if (!end) { this.finish(); return; }
      this.follow();
    } catch (error) {
      if (id !== this.generation) return;
      this.finish();
      this.callbacks.error(error);
    }
  }

  private follow = (): void => {
    this.frame = null;
    const state = this.player.getPlaybackState();
    if (!state.playing) {
      this.finish();
      this.callbacks.complete?.();
      return;
    }
    this.callbacks.highlight(state.noteIndex);
    this.frame = this.frames.request(this.follow);
  };
}
