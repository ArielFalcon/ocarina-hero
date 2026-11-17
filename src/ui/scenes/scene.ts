/**
 * Universe scenes: felt puppets from the promo films, sewn into the lesson of a song's universe.
 * A scene is data only: which figures can play each role, and which role goes in which slot. The
 * stage (stage.ts) knows slots, holders, roles and reactions and nothing about universes; the
 * registry (registry.ts) says which scene a song gets. Pure data and functions: the tests import
 * it without a DOM.
 */

/**
 * Fixed anchors in the lesson markup (`data-scene-slot`); styles.css positions them per width.
 * `heading` and `controller` show from 800px. `band` is the phones' stage: a strip across the screen
 * under the controller where puppets and props stand in the order the scene lists them, and runners cross.
 */
export const SCENE_SLOTS = ['heading', 'controller', 'band'] as const;
export type SceneSlot = (typeof SCENE_SLOTS)[number];

/**
 * What holds a puppet (a lead or companion) up, decided by where it is: hanging from a thread from the
 * top of the heading and of the controller panel (desktop), or raised on a stick from the band's floor
 * (phones). A puppet enters along its holder and pivots on its holder's anchor.
 */
export type SceneHolder = 'thread' | 'stick';
export const SLOT_HOLDER: Readonly<Record<SceneSlot, SceneHolder>> = { heading: 'thread', controller: 'thread', band: 'stick' };

/**
 * What a figure is in its scene. Reactions are styled once per role, for every universe: `lead`
 * reacts to every action; `companion` to playback and celebrations; `runner` dashes across its slot
 * now and then and when a song starts or a celebration comes; `ambient` is a prop that stands still;
 * `effect` stays hidden until a celebration pops it in. Puppets never move on a loop: they are still
 * until the lesson does something, and while a song plays leads and companions rock on its beat.
 * The order is the casting priority: a later role avoids characters an earlier one already cast.
 */
export const SCENE_ROLES = ['lead', 'companion', 'runner', 'ambient', 'effect'] as const;
export type SceneRole = (typeof SCENE_ROLES)[number];

/** The roles that are puppets on a holder; the others stand, run or pop in on their own. */
export const HELD_ROLES: readonly SceneRole[] = ['lead', 'companion'];

/** What the lesson is doing, held while it lasts. */
export type SceneMood = 'idle' | 'practice' | 'playing';

/**
 * One-shot reactions and how long each lasts; the stage passes the length to CSS as `--scene-cue-ms`.
 * `play` and `stop` follow playback, `leave` is the puppets' exit before Reset brings another cast in,
 * and the rest answer a practised note or a song heard to its end.
 */
export const SCENE_CUE_MS = { play: 700, stop: 600, leave: 380, hit: 260, miss: 420, cheer: 1300, done: 3200 } as const;
export type SceneCue = keyof typeof SCENE_CUE_MS;

/** The strongest reaction a practice note earned: the song's end, a milestone or cleared passage, a hit, or a miss. */
export function practiceCue(result: { hit: boolean; milestone: boolean; cleared: boolean; finished: boolean }): SceneCue {
  if (!result.hit) return 'miss';
  if (result.finished) return 'done';
  return result.milestone || result.cleared ? 'cheer' : 'hit';
}

const BEAT_MIN_MS = 360;
const BEAT_MAX_MS = 1200;
const BEAT_FALLBACK_MS = 600;

/** The song's beat, doubled or halved until it sits in a range a puppet can follow calmly. */
export function sceneBeatMs(beatMs: number): number {
  if (!Number.isFinite(beatMs) || beatMs <= 0) return BEAT_FALLBACK_MS;
  let beat = beatMs;
  while (beat < BEAT_MIN_MS) beat *= 2;
  while (beat > BEAT_MAX_MS) beat /= 2;
  return beat;
}

/** A piece shows at most this many poses. */
export const SCENE_FRAME_LIMIT = 3;
const FRAME_HOLD_MIN_MS = 4000;
const FRAME_HOLD_SPREAD_MS = 4000;

/** How long a puppet holds a pose before changing to its next one: four to eight seconds, at random. */
export function frameHoldMs(random: () => number): number {
  return FRAME_HOLD_MIN_MS + random() * FRAME_HOLD_SPREAD_MS;
}

const RUN_GAP_MIN_MS = 12000;
const RUN_GAP_SPREAD_MS = 12000;

/** How long until a runner crosses again on its own: twelve to twenty-four seconds, at random. */
export function runGapMs(random: () => number): number {
  return RUN_GAP_MIN_MS + random() * RUN_GAP_SPREAD_MS;
}

/** One figure; its poses alternate slowly in place. Files are `public/art/scenes/<frame>.webp`, exported by scripts/export-scene-art.ts. */
export interface ScenePiece {
  readonly frames: readonly string[];
  /** The character it shows, so one scene does not cast the same character twice while it can avoid it. */
  readonly who?: string;
  /** Display height in CSS pixels for a prop, runner or effect (export it at twice that); puppets take their slot's height. */
  readonly height?: number;
  /** Which way the art faces (default right); a runner is mirrored when it dashes the other way. */
  readonly faces?: 'left' | 'right';
}

export interface ScenePlacement {
  readonly slot: SceneSlot;
  readonly role: SceneRole;
  /** Which member of the role's cast: the same member is the same figure in every slot. Defaults to 0. */
  readonly member?: number;
  /** Offsets this puppet's entrance and reactions so figures sharing a scene do not move in step. */
  readonly delayMs?: number;
  /** Faces the figure the other way. */
  readonly mirror?: boolean;
}

export interface Scene {
  /** The figures that can play each role; every visit draws them in a random order. */
  readonly cast: Readonly<Partial<Record<SceneRole, readonly ScenePiece[]>>>;
  readonly placements: readonly ScenePlacement[];
}

export interface CastPlacement extends ScenePlacement {
  readonly piece: ScenePiece;
}

/**
 * Gives every placement its figure: each role's cast is shuffled (Fisher-Yates) and member n takes
 * the n-th figure, so members always differ (a member past the cast leaves its place empty) and a
 * member is the same figure in every slot (the desktop and phone slots of one visit show the same puppets).
 */
export function castScene(scene: Scene, random: () => number): CastPlacement[] {
  const drawn = new Map<SceneRole, ScenePiece[]>();
  const onStage = new Set<string>();
  for (const role of SCENE_ROLES) {
    const shuffled = [...scene.cast[role] ?? []];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    // Characters already cast in an earlier role go last, so they return only when the role runs out.
    const pool = [...shuffled.filter(piece => !piece.who || !onStage.has(piece.who)), ...shuffled.filter(piece => piece.who && onStage.has(piece.who))];
    drawn.set(role, pool);
    const members = new Set(scene.placements.filter(placement => placement.role === role).map(placement => placement.member ?? 0));
    for (const member of members) {
      const who = pool[member]?.who;
      if (who) onStage.add(who);
    }
  }
  return scene.placements.flatMap(placement => {
    const pool = drawn.get(placement.role)!;
    const piece = pool[placement.member ?? 0];
    return piece ? [{ ...placement, piece }] : [];
  });
}

/** A scene module, loaded only when a song that uses it opens. */
export type SceneLoader = () => Promise<{ readonly scene: Scene }>;

/** Path of a frame relative to the site base. */
export function sceneArtPath(frame: string): string {
  return `art/scenes/${frame}.webp`;
}
