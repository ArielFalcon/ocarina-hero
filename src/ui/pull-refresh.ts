/** Indicator travel, in px, that triggers a refresh on release. */
export const PULL_THRESHOLD = 64;
/** Furthest the indicator travels, however far the finger goes. */
export const PULL_MAX = 96;
/** The indicator moves half as far as the finger, so the pull feels weighted. */
const RESISTANCE = 0.5;

export interface PullState { pull: number; progress: number }

/**
 * Pull-to-refresh decisions, free of the DOM. A pull arms only when the touch starts at the top of the scroller
 * and no refresh is running; `move` returns null whenever native scrolling should proceed.
 */
export class PullGesture {
  refreshing = false;
  private startY: number | null = null;
  private pull = 0;

  start(y: number, atTop: boolean): void {
    this.startY = atTop && !this.refreshing ? y : null;
    this.pull = 0;
  }

  move(y: number): PullState | null {
    if (this.startY === null) return null;
    const travel = y - this.startY;
    if (travel <= 0) { this.pull = 0; return null; }
    this.pull = Math.min(travel * RESISTANCE, PULL_MAX);
    return { pull: this.pull, progress: Math.min(this.pull / PULL_THRESHOLD, 1) };
  }

  /** True when the release should refresh; the pull is spent either way. */
  end(): boolean {
    const trigger = this.startY !== null && this.pull >= PULL_THRESHOLD;
    this.startY = null;
    this.pull = 0;
    return trigger;
  }
}

/**
 * Wire the gesture to a scroller. Touch events, not pointer events: the browser cancels pointers once it claims
 * a scroll. `touchmove` is not passive so a downward pull from the top can stop the page's own overscroll.
 * The indicator reads `--pull` (px) and `--pull-progress` (0–1), and the `is-pulling`, `is-armed` (release will refresh) and `is-refreshing` classes.
 */
export function bindPullToRefresh(scroller: HTMLElement, indicator: HTMLElement, options: { active: () => boolean; refresh: () => Promise<void> }): void {
  const gesture = new PullGesture();
  const show = (state: PullState | null) => {
    indicator.style.setProperty('--pull', `${state?.pull ?? 0}px`);
    indicator.style.setProperty('--pull-progress', String(state?.progress ?? 0));
    indicator.classList.toggle('is-pulling', state !== null);
    indicator.classList.toggle('is-armed', (state?.progress ?? 0) >= 1);
  };

  scroller.addEventListener('touchstart', event => {
    gesture.start(event.touches[0]!.clientY, event.touches.length === 1 && options.active() && scroller.scrollTop <= 0);
  }, { passive: true });

  scroller.addEventListener('touchmove', event => {
    const state = gesture.move(event.touches[0]!.clientY);
    if (state && event.cancelable) event.preventDefault();
    show(state);
  }, { passive: false });

  const release = async () => {
    const trigger = gesture.end();
    show(null);
    if (!trigger) return;
    gesture.refreshing = true;
    indicator.classList.add('is-refreshing');
    try {
      await options.refresh();
    } finally {
      gesture.refreshing = false;
      indicator.classList.remove('is-refreshing');
    }
  };
  scroller.addEventListener('touchend', () => void release());
  scroller.addEventListener('touchcancel', () => { gesture.end(); show(null); });
}
