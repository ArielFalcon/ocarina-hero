import { frequencyOf, pitchForButton, type ControllerButton, type PitchSpec } from '../../core/pitches';
import { buttonLabel, schemeBendLabel, type ControlScheme } from '../../core/tab';
import { buttonIcon, modifierIcon } from '../controller-icons';
import { Controls } from '../input';
import { GamepadInput } from '../gamepad';
import { BEND_ACTIONS, KEYBOARD_ACTIONS, keyLabel } from '../keyboard';
import { controlScheme, currentTheme } from '../theme';
import { bends, engine, hint, pad, state, take } from './state';
import { must } from './dom';
import { renderTab } from './staff';
import { practiceNote } from './practice';
import { stopPlayback } from './playback';

function keyHtml(pitch: PitchSpec): string {
  return `
    <button class="key" type="button" data-button="${pitch.button}"
      aria-label="Play ${buttonLabel(pitch.button, controlScheme())}, keyboard ${keyLabel(state.bindings[pitch.button])}"
      title="${pitch.id} · keyboard ${keyLabel(state.bindings[pitch.button])}">
      ${buttonIcon(pitch.button)}
      <kbd class="key-ref">${keyLabel(state.bindings[pitch.button])}</kbd>
    </button>`;
}

export function buildPad(): void {
  const retro = currentTheme() === 'retro';
  pad.innerHTML = `
    <div class="shoulders">
      ${keyHtml(pitchForButton('L'))}
      ${retro ? '' : keyHtml(pitchForButton('R'))}
    </div>
    <div class="diamond">
      <span class="cell" aria-hidden="true"></span>
      ${keyHtml(pitchForButton('X'))}
      <span class="cell" aria-hidden="true"></span>
      ${keyHtml(pitchForButton('Y'))}
      ${retro ? keyHtml(pitchForButton('R')) : '<span class="ghost" aria-hidden="true">B</span>'}
      ${keyHtml(pitchForButton('A'))}
    </div>`;
  bends.innerHTML = [1, -1, 2, -2].map(value => `
    <button class="bend-key" type="button" data-bend="${value}" aria-label="${schemeBendLabel(value, controlScheme())}" title="${schemeBendLabel(value, controlScheme())}">
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
  parts.push(state.bend ? `bend ${schemeBendLabel(state.bend, controlScheme())}` : 'no bend');
  hint.textContent = parts.join(' · ');
}

function press(pitch: PitchSpec): void {
  state.editor?.stopPreview();
  if (state.isPlaying || state.repeatingTimer !== undefined) stopPlayback();
  engine.noteOn(pitch, state.bend);
  lastNoteLabel = `${buttonLabel(pitch.button, controlScheme())} · ${pitch.id} · ${frequencyOf(pitch.id, state.bend).toFixed(1)} Hz`;
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

const GAMEPAD_HELP: Record<ControlScheme, string> = {
  switch: 'Controller connected: the shoulder and face buttons play; the D-pad and the sticks bend.',
  n64: 'Controller connected: A and the right stick, as the C buttons, play; R, Z and the left stick bend.',
};

/** Whether the connected pad has a layout the app can read; null while none is connected. */
let gamepadReadable: boolean | null = null;

let gamepadFrame: number | undefined;

export function renderGamepadStatus(): void {
  if (gamepadReadable === null) return;
  gamepadStatus.textContent = gamepadReadable ? GAMEPAD_HELP[controlScheme()] : 'This browser does not recognise the layout of that controller.';
}

/** Poll while the lesson is on screen and a usable pad is connected; one last empty poll releases what was held. */
function pollGamepads(): void {
  gamepadFrame = undefined;
  const playable = state.view === 'lesson' && !document.hidden;
  const connected = gamepads.update(playable ? navigator.getGamepads?.() ?? [] : [], controlScheme());
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
