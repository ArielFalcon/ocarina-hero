/**
 * Physics of the figure that hangs from the top of the app: a point mass on an elastic cord, pivot at the origin,
 * y pointing down. No DOM, so the rules are testable; hanging-link.ts draws it and runs the frames.
 */
export interface Rope {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** False while the figure is still dropping in from above: the cord only catches it once it runs out. */
  taut: boolean;
}

export interface RopeConfig {
  /** Rest length of the cord, in px. */
  readonly length: number;
}

const GRAVITY = 2400;
/** Cord stiffness (1/s²) and damping of its stretch (1/s): a short bounce when the cord catches the drop. */
const STIFFNESS = 480;
const STRETCH_DAMPING = 4.5;
/** Air drag on the swing (1/s). */
const DRAG = 1.4;
const STEP = 1 / 240;
const MAX_STEPS = 16;
/** Pulling the figure down past this multiple of the cord length snaps the cord. */
const BREAK_STRETCH = 2.8;
/** A downward pull counts only inside this cone around straight down (cosine of the half-angle). */
const DOWN_CONE = 0.64;
/** How much of a pull beyond the cord length shows as stretch; the rest the hand pulls against. */
const ELASTICITY = 0.85;

export function restY(config: RopeConfig): number {
  return config.length + GRAVITY / STIFFNESS;
}

/** A rope already hanging still below the pivot. */
export function atRest(config: RopeConfig): Rope {
  return { x: 0, y: restY(config), vx: 0, vy: 0, taut: true };
}

/** A rope whose figure waits above the screen, `fromY` px above the pivot, ready to drop in. */
export function dropIn(fromY: number, sway = 6): Rope {
  return { x: sway, y: -Math.abs(fromY), vx: 0, vy: 0, taut: false };
}

function step(rope: Rope, config: RopeConfig, dt: number): void {
  let ax = 0;
  let ay = GRAVITY;
  const r = Math.hypot(rope.x, rope.y);
  if (!rope.taut && rope.y > 0 && r >= config.length) rope.taut = true;
  if (rope.taut && r > config.length) {
    const nx = rope.x / r;
    const ny = rope.y / r;
    const pull = -STIFFNESS * (r - config.length) - STRETCH_DAMPING * (rope.vx * nx + rope.vy * ny);
    ax += pull * nx;
    ay += pull * ny;
  }
  ax -= DRAG * rope.vx;
  ay -= DRAG * rope.vy;
  rope.vx += ax * dt;
  rope.vy += ay * dt;
  rope.x += rope.vx * dt;
  rope.y += rope.vy * dt;
}

/** Advances by `elapsed` seconds in fixed sub-steps, so a long frame does not change how the swing behaves. */
export function advance(rope: Rope, config: RopeConfig, elapsed: number): void {
  const steps = Math.min(MAX_STEPS, Math.max(1, Math.round(elapsed / STEP)));
  for (let i = 0; i < steps; i++) step(rope, config, STEP);
}

/** True once the swing has died out; the frame loop stops here and snaps the figure to its resting place. */
export function settle(rope: Rope, config: RopeConfig): boolean {
  if (!rope.taut) return false;
  const rest = restY(config);
  if (Math.hypot(rope.vx, rope.vy) > 6 || Math.abs(rope.x) > 0.6 || Math.abs(rope.y - rest) > 0.6) return false;
  rope.x = 0; rope.y = rest; rope.vx = 0; rope.vy = 0;
  return true;
}

/** Where the figure hangs while a hand holds it at `target`: the cord stretches a little, the hand pulls against the rest. */
export function heldAt(target: { x: number; y: number }, config: RopeConfig): { x: number; y: number } {
  const r = Math.hypot(target.x, target.y);
  if (r <= config.length) return { x: target.x, y: target.y };
  const k = (config.length + (r - config.length) * ELASTICITY) / r;
  return { x: target.x * k, y: target.y * k };
}

/** The cord snaps when the hand drags the figure far down; the same distance sideways only swings it. */
export function breaks(target: { x: number; y: number }, config: RopeConfig): boolean {
  const r = Math.hypot(target.x, target.y);
  return r > config.length * BREAK_STRETCH && target.y >= r * DOWN_CONE;
}

export interface Fall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Tumble in radians, growing with the sideways speed it broke away with. */
  turn: number;
}

export function fallFrom(rope: Pick<Rope, 'x' | 'y' | 'vx' | 'vy'>): Fall {
  return { x: rope.x, y: rope.y, vx: rope.vx, vy: rope.vy, turn: 0 };
}

export function fall(state: Fall, elapsed: number): void {
  const dt = Math.min(elapsed, 1 / 20);
  state.vy += GRAVITY * dt;
  state.x += state.vx * dt;
  state.y += state.vy * dt;
  state.turn += (state.vx / 400 + 1.6) * dt;
}

const GONE_FOR_SESSION = 'ocarina.link.gone';

/** Whether the figure was already removed in this browser session; storage that is missing or throws counts as "not removed". */
export function goneThisSession(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try { return storage?.getItem(GONE_FOR_SESSION) === '1'; } catch { return false; }
}

export function markGone(storage: Pick<Storage, 'setItem'> | undefined): void {
  try { storage?.setItem(GONE_FOR_SESSION, '1'); } catch { /* the figure just comes back on reload */ }
}

export function clearGone(storage: Pick<Storage, 'removeItem'> | undefined): void {
  try { storage?.removeItem(GONE_FOR_SESSION); } catch { /* nothing to clear */ }
}
