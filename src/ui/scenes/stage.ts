import { HELD_ROLES, SCENE_CUE_MS, SLOT_HOLDER, castScene, frameHoldMs, runGapMs, sceneArtPath, sceneBeatMs, type CastPlacement, type Scene, type SceneCue, type SceneLoader, type SceneMood } from './scene';

/**
 * Mounts one scene at a time into the page's `[data-scene-slot]` anchors and drives its puppets.
 * It knows slots, holders, roles and reactions, never universes: the caller passes the loader of the
 * scene to show, or null to clear it, and reports what the lesson does (mood, cues, a restart).
 * Images are created only when a scene mounts, so a page without one requests no scene art.
 *
 * State lives on the `[data-scene-stage]` ancestor of the slots, so every puppet reads the same one:
 * `data-scene-mood` (practice, or playing with `--scene-beat`) and `data-scene-cue` for a one-shot
 * reaction lasting `--scene-cue-ms`. Each puppet is three nested spans: `.scene-piece` enters and
 * leaves along its holder, `.scene-rig` (holder and figure) pivots on the holder's anchor, and
 * `.scene-react` (the figure alone) reacts. Its poses are stacked images; one at a time is shown.
 * Runners wait off their slot and dash across it now and then (`.is-running`).
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let shown: SceneLoader | null = null;
let scene: Scene | null = null;
let version = 0;
let cueTimer: number | undefined;
let poseTimer: number | undefined;
let recastTimer: number | undefined;
let runTimer: number | undefined;
/** Cues that send a runner across. */
const RUN_CUES: ReadonlySet<SceneCue> = new Set(['play', 'cheer', 'done']);
/** The first dash comes a little after the puppets have entered. */
const FIRST_RUN_MS = 3500;

export function showScene(loader: SceneLoader | null): void {
  if (loader === shown) return;
  shown = loader;
  scene = null;
  const mine = ++version;
  unmount();
  if (!loader) return;
  loader().then(loaded => {
    if (mine !== version) return;
    scene = loaded.scene;
    mount();
  }, error => {
    if (mine === version) console.error('Could not load the scene', error);
  });
}

/** What the lesson is doing; while a song plays, leads and companions rock on its beat (in milliseconds). */
export function setSceneMood(mood: SceneMood, beatMs: number): void {
  const root = stage();
  if (!root) return;
  if (mood === 'idle') delete root.dataset.sceneMood;
  else root.dataset.sceneMood = mood;
  if (mood === 'playing') root.style.setProperty('--scene-beat', `${sceneBeatMs(beatMs)}ms`);
}

/** A one-shot reaction; a new cue replaces one still running. Without a mounted scene it does nothing. */
export function cueScene(cue: SceneCue): void {
  const root = stage();
  if (!root || !scene || recastTimer !== undefined) return;
  setCue(root, cue);
  if (RUN_CUES.has(cue)) run();
}

/** The puppets leave along their holders and a new draw of the cast comes in (Reset). */
export function recastScene(): void {
  const root = stage();
  if (!root || !scene) return;
  const mine = version;
  window.clearTimeout(recastTimer);
  if (reduceMotion.matches) { mount(); return; }
  setCue(root, 'leave');
  recastTimer = window.setTimeout(() => {
    recastTimer = undefined;
    if (mine === version) mount();
  }, SCENE_CUE_MS.leave);
}

function stage(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-scene-stage]');
}

function setCue(root: HTMLElement, cue: SceneCue): void {
  clearCue();
  void root.offsetWidth; // restarts the reaction when the same cue repeats
  root.dataset.sceneCue = cue;
  root.style.setProperty('--scene-cue-ms', `${SCENE_CUE_MS[cue]}ms`);
  cueTimer = window.setTimeout(clearCue, SCENE_CUE_MS[cue]);
}

function clearCue(): void {
  window.clearTimeout(cueTimer);
  cueTimer = undefined;
  const root = stage();
  if (root) delete root.dataset.sceneCue;
}

function slots(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>('[data-scene-slot]');
}

function unmount(): void {
  window.clearTimeout(poseTimer);
  window.clearTimeout(recastTimer);
  window.clearTimeout(runTimer);
  poseTimer = recastTimer = runTimer = undefined;
  clearCue();
  for (const slot of slots()) slot.replaceChildren();
}

function mount(): void {
  if (!scene) return;
  unmount();
  const bySlot = new Map([...slots()].map(slot => [slot.dataset.sceneSlot, slot]));
  for (const placement of castScene(scene, Math.random)) {
    const anchor = bySlot.get(placement.slot);
    if (!anchor) continue;
    anchor.dataset.holder = SLOT_HOLDER[placement.slot];
    anchor.append(puppet(placement));
  }
  schedulePose();
  scheduleRun(FIRST_RUN_MS);
}

function puppet({ piece, role, slot, member = 0, delayMs = 0, mirror = false }: CastPlacement): HTMLElement {
  const held = HELD_ROLES.includes(role);
  const figure = document.createElement('span');
  figure.className = 'scene-piece';
  figure.dataset.role = role;
  figure.dataset.member = String(member);
  if (held) figure.dataset.holder = SLOT_HOLDER[slot];
  if (mirror) figure.dataset.mirror = '';
  if (piece.faces) figure.dataset.faces = piece.faces;
  figure.style.setProperty('--scene-delay', `${delayMs}ms`);
  if (piece.height) figure.style.setProperty('--piece-h', `${piece.height}px`);
  const rig = document.createElement('span');
  rig.className = 'scene-rig';
  if (held) {
    const holder = document.createElement('span');
    holder.className = 'scene-holder';
    rig.append(holder);
  }
  const reaction = document.createElement('span');
  reaction.className = 'scene-react';
  piece.frames.forEach((frame, index) => {
    const image = document.createElement('img');
    // Lazy, and set before the source: a slot hidden at this width (display: none) never fetches its piece.
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = '';
    image.src = import.meta.env.BASE_URL + sceneArtPath(frame);
    image.draggable = false;
    if (index === 0) image.className = 'is-shown';
    reaction.append(image);
  });
  rig.append(reaction);
  figure.append(rig);
  return figure;
}

/** Every few seconds one visible puppet with several poses changes to its next one. */
function schedulePose(): void {
  if (reduceMotion.matches) return;
  poseTimer = window.setTimeout(() => {
    const posers = [...document.querySelectorAll<HTMLElement>('[data-scene-slot] .scene-react')]
      .filter(reaction => reaction.childElementCount > 1 && reaction.offsetParent !== null);
    const reaction = posers[Math.floor(Math.random() * posers.length)];
    if (reaction) {
      const poses = [...reaction.children];
      const current = poses.findIndex(pose => pose.classList.contains('is-shown'));
      poses[current]?.classList.remove('is-shown');
      poses[(current + 1) % poses.length]?.classList.add('is-shown');
    }
    schedulePose();
  }, frameHoldMs(Math.random));
}

/** Now and then one visible runner dashes across its slot, in a random direction, facing the way it goes. */
function scheduleRun(delayMs: number): void {
  if (reduceMotion.matches) return;
  window.clearTimeout(runTimer);
  runTimer = window.setTimeout(() => { run(); scheduleRun(runGapMs(Math.random)); }, delayMs);
}

function run(): void {
  if (reduceMotion.matches) return;
  const runners = [...document.querySelectorAll<HTMLElement>('[data-scene-slot] .scene-piece[data-role="runner"]')]
    .filter(runner => runner.offsetParent !== null);
  if (runners.some(runner => runner.classList.contains('is-running'))) return;
  const runner = runners[Math.floor(Math.random() * runners.length)];
  if (!runner) return;
  runner.style.setProperty('--lane-w', `${runner.parentElement!.clientWidth}px`);
  runner.dataset.dir = Math.random() < 0.5 ? 'right' : 'left';
  runner.classList.remove('is-running');
  void runner.offsetWidth; // restarts the dash
  runner.classList.add('is-running');
  runner.addEventListener('animationend', event => { if (event.target === runner) runner.classList.remove('is-running'); }, { once: true });
}
