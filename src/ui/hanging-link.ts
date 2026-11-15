import { advance, atRest, breaks, dropIn, fall, fallFrom, heldAt, settle, type Fall, type Rope, type RopeConfig } from './rope';

/**
 * The felt Link that hangs from the top of the app on a thread. It drops in once, swings when dragged, and a hard
 * pull downwards snaps the thread. All motion is two `transform` writes per frame, and frames only run while
 * something moves: at rest, while held (it follows the pointer events) and once gone it costs nothing.
 */
export interface HangingLinkOptions {
  readonly src: string;
  /** Called once the thread has snapped and the figure has left the screen; the loose end stays behind. */
  readonly onGone: () => void;
  /** Called when the loose end is tapped and the figure is tied back on. */
  readonly onRestore: () => void;
}

export interface HangingLink {
  /** `snapped` shows only the short loose end of the cut thread, as after a break earlier in the session. */
  show(state: 'hanging' | 'snapped'): void;
  hide(): void;
}

type Mode = 'dropping' | 'hanging' | 'held' | 'falling';

const MAX_FRAME = 1 / 30;
const STILL_BEFORE_RELEASE_MS = 80;
const MAX_THROW_SPEED = 1400;
const CORD_RECOIL = 9;
const FALL_CUTOFF_SECONDS = 3;

export function createHangingLink(host: HTMLElement, options: HangingLinkOptions): HangingLink {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let root: HTMLDivElement | null = null;
  let cord!: HTMLDivElement;
  let figure!: HTMLImageElement;
  let wanted = false;
  let shown: 'hanging' | 'snapped' | null = null;
  let mode: Mode = 'hanging';
  let config: RopeConfig = { length: 44 };
  let figureHeight = 96;
  let rope: Rope = dropIn(figureHeight);
  let falling: Fall = fallFrom(rope);
  let fallTime = 0;
  let cordScale = 1;
  let frameId = 0;
  let last = 0;
  let hold: { grabX: number; grabY: number; pivotX: number; pivotY: number; x: number; y: number; vx: number; vy: number; at: number } | null = null;

  function preload(): HTMLImageElement {
    const image = new Image();
    image.src = options.src;
    return image;
  }

  function measure(): void {
    if (!root) return;
    const style = getComputedStyle(root);
    config = { length: parseFloat(style.getPropertyValue('--link-cord')) || config.length };
    figureHeight = parseFloat(style.getPropertyValue('--link-h')) || figureHeight;
  }

  function paint(x: number, y: number, turn: number, cordScale: number, cordTurn: number): void {
    figure.style.transform = `translate(${x}px, ${y}px) rotate(${turn}rad)`;
    cord.style.transform = `rotate(${cordTurn}rad) scaleY(${cordScale})`;
  }

  function paintRope(point: { x: number; y: number }, slack: boolean): void {
    if (slack) { paint(point.x, point.y, 0, Math.max(0, point.y) / config.length, 0); return; }
    const r = Math.hypot(point.x, point.y);
    const turn = -Math.atan2(point.x, point.y);
    paint(point.x, point.y, turn, r / config.length, turn);
  }

  function requestFrame(): void {
    if (frameId || !root) return;
    last = performance.now();
    frameId = requestAnimationFrame(frame);
  }

  function frame(now: number): void {
    frameId = 0;
    if (!root) return;
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (mode === 'falling') { stepFall(dt); return; }
    if (mode === 'held') return;
    advance(rope, config, dt);
    if (mode === 'dropping' && rope.taut) mode = 'hanging';
    if (settle(rope, config)) { paintRope(rope, false); return; }
    paintRope(rope, !rope.taut);
    requestFrame();
  }

  function stepFall(dt: number): void {
    fall(falling, dt);
    fallTime += dt;
    cordScale = Math.max(0.12, cordScale * Math.exp(-CORD_RECOIL * dt));
    const cordTurn = parseFloat(cord.dataset.turn ?? '0');
    paint(falling.x, falling.y, falling.turn, cordScale, cordTurn);
    if (falling.y > host.clientHeight + figureHeight || fallTime > FALL_CUTOFF_SECONDS) { leave(); return; }
    requestFrame();
  }

  function leave(): void {
    unmount();
    options.onGone();
    if (wanted) mountStub(true);
  }

  /** The cut thread's short loose end with a knot, where the figure used to hang; tapping it ties him back on. */
  function mountStub(whip: boolean): void {
    shown = 'snapped';
    root = document.createElement('div');
    root.className = 'hanging-link';
    const stub = document.createElement('div');
    stub.className = 'hanging-link-stub';
    const knot = document.createElement('button');
    knot.type = 'button';
    knot.className = 'hanging-link-knot';
    knot.setAttribute('aria-label', 'Tie Link back on');
    knot.addEventListener('click', restore);
    stub.append(knot);
    root.append(stub);
    host.append(root);
    preload();
    if (whip && !reduceMotion.matches) {
      stub.animate([0.5, -0.3, 0.16, -0.07, 0].map(turn => ({ transform: `rotate(${turn}rad)` })), { duration: 1500, easing: 'ease-out' });
    }
  }

  function restore(): void {
    unmount();
    options.onRestore();
    mount();
  }

  function snap(point: { x: number; y: number }): void {
    cord.dataset.turn = String(-Math.atan2(point.x, point.y));
    falling = fallFrom({ x: point.x, y: point.y, vx: hold?.vx ?? rope.vx, vy: Math.max(hold?.vy ?? rope.vy, 0) });
    fallTime = 0;
    cordScale = Math.hypot(point.x, point.y) / config.length;
    mode = 'falling';
    if (reduceMotion.matches) { leave(); return; }
    requestFrame();
  }

  function pointerPosition(event: PointerEvent): { x: number; y: number } {
    const h = hold!;
    return { x: event.clientX - h.pivotX - h.grabX, y: Math.max(0, event.clientY - h.pivotY - h.grabY) };
  }

  function grab(event: PointerEvent): void {
    if (mode !== 'hanging' || event.button > 0) return;
    const pivot = root!.getBoundingClientRect();
    hold = { grabX: event.clientX - pivot.left - rope.x, grabY: event.clientY - pivot.top - rope.y, pivotX: pivot.left, pivotY: pivot.top, x: rope.x, y: rope.y, vx: 0, vy: 0, at: event.timeStamp };
    mode = 'held';
    figure.setPointerCapture(event.pointerId);
    figure.classList.add('is-held');
    event.preventDefault();
  }

  function move(event: PointerEvent): void {
    if (mode !== 'held' || !hold) return;
    const target = pointerPosition(event);
    if (breaks(target, config)) { release(event, target); return; }
    const point = heldAt(target, config);
    const dt = Math.max(0.008, (event.timeStamp - hold.at) / 1000);
    hold.vx = hold.vx * 0.5 + ((point.x - hold.x) / dt) * 0.5;
    hold.vy = hold.vy * 0.5 + ((point.y - hold.y) / dt) * 0.5;
    hold.x = point.x; hold.y = point.y; hold.at = event.timeStamp;
    paintRope(point, false);
  }

  /** Lets go of the figure; with a hard enough downward pull the thread snaps instead. */
  function release(event: PointerEvent, snapped?: { x: number; y: number }): void {
    if (mode !== 'held' || !hold) return;
    const still = event.timeStamp - hold.at > STILL_BEFORE_RELEASE_MS;
    const speed = (value: number) => still ? 0 : Math.max(-MAX_THROW_SPEED, Math.min(MAX_THROW_SPEED, value));
    hold.vx = speed(hold.vx); hold.vy = speed(hold.vy);
    if (figure.hasPointerCapture(event.pointerId)) figure.releasePointerCapture(event.pointerId);
    figure.classList.remove('is-held');
    if (snapped) { snap(heldAt(snapped, config)); hold = null; return; }
    rope = { x: hold.x, y: hold.y, vx: hold.vx, vy: hold.vy, taut: true };
    hold = null;
    mode = 'hanging';
    requestFrame();
  }

  function onResize(): void {
    if (!root || mode === 'falling') return;
    measure();
    if (mode === 'hanging' && !frameId) { rope = atRest(config); paintRope(rope, false); }
  }

  function mount(): void {
    root = document.createElement('div');
    root.className = 'hanging-link';
    root.setAttribute('aria-hidden', 'true');
    shown = 'hanging';
    cord = document.createElement('div');
    cord.className = 'hanging-link-cord';
    figure = document.createElement('img');
    figure.className = 'hanging-link-figure';
    figure.alt = '';
    figure.draggable = false;
    figure.src = options.src;
    figure.addEventListener('pointerdown', grab);
    figure.addEventListener('pointermove', move);
    figure.addEventListener('pointerup', release);
    figure.addEventListener('pointercancel', release);
    root.append(cord, figure);
    host.append(root);
    measure();
    window.addEventListener('resize', onResize);
    if (reduceMotion.matches) {
      mode = 'hanging';
      rope = atRest(config);
      paintRope(rope, false);
      return;
    }
    mode = 'dropping';
    rope = dropIn(figureHeight);
    paintRope(rope, true);
    requestFrame();
  }

  function unmount(): void {
    cancelAnimationFrame(frameId);
    frameId = 0;
    window.removeEventListener('resize', onResize);
    root?.remove();
    root = null;
    shown = null;
    hold = null;
  }

  function hide(): void {
    wanted = false;
    unmount();
  }

  function show(state: 'hanging' | 'snapped'): void {
    if (wanted && shown === state) return;
    hide();
    wanted = true;
    if (state === 'snapped') { mountStub(false); return; }
    preload().decode().catch(() => undefined).then(() => { if (wanted && !root) mount(); });
  }

  return { show, hide };
}
