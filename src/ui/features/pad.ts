import { frequencyOf, pitchForButton, type ControllerButton, type PitchSpec } from '../../core/pitches';
import { buttonIcon, modifierIcon } from '../controller-icons';
import { Controls } from '../input';
import { GamepadInput } from '../gamepad';
import { BEND_ACTIONS, KEYBOARD_ACTIONS, keyLabel } from '../keyboard';
import { bendName, buttonName, platform } from '../platform';
import type { PadSlot } from '../platforms';
import { bends, engine, hint, pad, state, take } from './state';
import { must } from './dom';
import { renderTab } from './staff';
import { practiceNote } from './practice';
import { stopPlayback } from './playback';

function keyHtml(pitch: PitchSpec): string {
  return `
    <button class="key" type="button" data-button="${pitch.button}"
      aria-label="Play ${buttonName(pitch.button)}, keyboard ${keyLabel(state.bindings[pitch.button])}"
      title="${pitch.id} · keyboard ${keyLabel(state.bindings[pitch.button])}">
      ${buttonIcon(pitch.button)}
      <kbd class="key-ref">${keyLabel(state.bindings[pitch.button])}</kbd>
    </button>`;
}

function slotHtml(slot: PadSlot): string {
  if (slot === 'cell') return '<span class="cell" aria-hidden="true"></span>';
  if (typeof slot === 'object') return `<span class="ghost" aria-hidden="true">${slot.ghost}</span>`;
  return keyHtml(pitchForButton(slot));
}

/** The on-screen pad in the active console's arrangement. */
export function buildPad(): void {
  const { shoulders, diamond } = platform().pad;
  pad.innerHTML = `
    <div class="shoulders">
      ${shoulders.map(slotHtml).join('\n      ')}
    </div>
    <div class="diamond">
      ${diamond.map(slotHtml).join('\n      ')}
    </div>`;
  bends.innerHTML = [1, -1, 2, -2].map(value => `
    <button class="bend-key" type="button" data-bend="${value}" aria-label="${bendName(value)}" title="${bendName(value)}">
      ${modifierIcon(value)}
      <kbd class="key-ref" data-bend-label="${value}">${keyLabel(state.bindings[KEYBOARD_ACTIONS.find(action => BEND_ACTIONS[action as keyof typeof BEND_ACTIONS] === value)!])}</kbd>
    </button>`).join('');
}

function setActive(button: ControllerButton, active: boolean): void {
  pad.querySelector(`[data-button="${button}"]`)?.classList.toggle('is-active', active);
}

export function clearActive(): void {
  for (const element of pad.querySelectorAll('.key.is-active')) {
    element.classList.remove('is-active');
  }
}

let lastNoteLabel = '';

export function updateHint(): void {
  const parts: string[] = [];
  if (lastNoteLabel) parts.push(lastNoteLabel);
  parts.push(state.bend ? `bend ${bendName(state.bend)}` : 'no bend');
  hint.textContent = parts.join(' · ');
}

function press(pitch: PitchSpec): void {
  state.editor?.stopPreview();
  if (state.isPlaying || state.repeatingTimer !== undefined) stopPlayback();
  engine.noteOn(pitch, state.bend);
  lastNoteLabel = `${buttonName(pitch.button)} · ${pitch.id} · ${frequencyOf(pitch.id, state.bend, platform().tuning).toFixed(1)} Hz`;
  updateHint();

  if (state.songArrangement) {
    if (state.practiceMode && !state.isPlaying) practiceNote(pitch.button);
    return;
  }

  take.press(pitch.id, state.bend, performance.now());
  state.passageIndex = Number.MAX_SAFE_INTEGER; // renderTab clamps to the passage holding the newest note
  renderTab();
}

export function applyBend(value: number, glide = 0): void {
  state.bend = value;
  engine.setBend(value, glide);
  if (!state.songArrangement && take.bend(value, performance.now())) {
    state.passageIndex = Number.MAX_SAFE_INTEGER; // renderTab clamps to the passage holding the newest note
    renderTab();
  }

  for (const element of bends.querySelectorAll<HTMLElement>('.bend-key')) {
    element.classList.toggle('is-active', Number(element.dataset.bend) === value);
  }

  updateHint();
}

export const controls = new Controls(
  (button) => {
    setActive(button, true);
    press(pitchForButton(button));
  },
  (button) => {
    setActive(button, false);
    engine.noteOff();
    if (!state.songArrangement) take.release(performance.now());
  },
  applyBend,
  (button) => setActive(button, false),
);

const gamepads = new GamepadInput(controls);

const gamepadStatus = must<HTMLParagraphElement>('#gamepad-status');

/** Whether the connected pad has a layout the app can read; null while none is connected. */
let gamepadReadable: boolean | null = null;

let gamepadFrame: number | undefined;

export function renderGamepadStatus(): void {
  if (gamepadReadable === null) return;
  gamepadStatus.textContent = gamepadReadable ? platform().gamepad.help : 'This browser does not recognise the layout of that controller.';
}

/** Poll while the lesson is on screen and a usable pad is connected; one last empty poll releases what was held. */
function pollGamepads(): void {
  gamepadFrame = undefined;
  const playable = state.view === 'lesson' && !document.hidden;
  const connected = gamepads.update(playable ? navigator.getGamepads?.() ?? [] : [], platform().gamepad.layout);
  if (playable && connected) gamepadFrame = requestAnimationFrame(pollGamepads);
}

export function watchGamepads(): void {
  if (gamepadFrame === undefined) pollGamepads();
}

export function bindPad(): void {
  window.addEventListener('gamepadconnected', event => {
    gamepadReadable = event.gamepad.mapping === 'standard';
    renderGamepadStatus();
    watchGamepads();
  });

  window.addEventListener('gamepaddisconnected', () => {
    gamepadReadable = null;
    gamepadStatus.textContent = 'Controller disconnected.';
  });

  const touchCapable = 'ontouchstart' in window;

  if (touchCapable) {
    const hit = (x: number, y: number): HTMLElement | null => {
      const element = document.elementFromPoint(x, y);
      return element instanceof Element
        ? element.closest<HTMLElement>('[data-bend], [data-button]')
        : null;
    };
    document.addEventListener('touchstart', (event) => {
      for (const touch of Array.from(event.changedTouches)) {
        const element = hit(touch.clientX, touch.clientY);
        if (!element) continue;
        event.preventDefault();
        const source = `touch:${touch.identifier}`;
        if (element.dataset.bend !== undefined) {
          controls.bendDown(source, Number(element.dataset.bend));
        } else if (element.dataset.button) {
          controls.noteDown(source, element.dataset.button as ControllerButton);
        }
      }
    }, { passive: false });
    const releaseTouch = (event: TouchEvent): void => {
      for (const touch of Array.from(event.changedTouches)) {
        const source = `touch:${touch.identifier}`;
        controls.bendUp(source);
        controls.noteUp(source);
      }
    };
    document.addEventListener('touchend', releaseTouch);
    document.addEventListener('touchcancel', releaseTouch);
  } else {
    for (const element of document.querySelectorAll<HTMLElement>('#pad .key, #bend-pad .bend-key')) {
      element.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const source = `pointer:${event.pointerId}`;
        if (element.dataset.bend !== undefined) {
          controls.bendDown(source, Number(element.dataset.bend));
        } else if (element.dataset.button) {
          controls.noteDown(source, element.dataset.button as ControllerButton);
        }
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
        element.addEventListener(type, (event) => {
          const source = `pointer:${event.pointerId}`;
          controls.bendUp(source);
          controls.noteUp(source);
        });
      }
    }
  }

  for (const container of [pad, bends]) {
    container.addEventListener('contextmenu', (event) => event.preventDefault());
  }
}
