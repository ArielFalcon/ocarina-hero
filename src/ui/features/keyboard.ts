import { pitchForButton, type ControllerButton } from '../../core/pitches';
import { buttonIcon, modifierIcon } from '../controller-icons';
import { actionForCode, assignKey, BEND_ACTIONS, DEFAULT_BINDINGS, KEY_BINDINGS_STORAGE, KEYBOARD_ACTIONS, keyLabel, handleKeyDown, type KeyboardAction } from '../keyboard';
import { bendName, buttonName } from '../platform';
import { writeStored } from '../storage';
import { bends, pad, state } from './state';
import { must } from './dom';
import { clearActive, controls } from './pad';
import { stopPlayback } from './playback';

const desktop = window.matchMedia('(min-width: 800px)');

function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('#audio-editor, #keyboard-settings, input, select, textarea, [contenteditable]') !== null;
}

function actionLabel(action: KeyboardAction): string {
  if (!(action in BEND_ACTIONS)) return `Button ${buttonName(action as ControllerButton)}`;
  return bendName(BEND_ACTIONS[action as keyof typeof BEND_ACTIONS]);
}

export function renderBindings(): void {
  const list = must('#keyboard-bindings');
  if (!list.childElementCount) list.innerHTML = KEYBOARD_ACTIONS.map(action =>
    `<div class="binding-row"><span class="binding-control">${action in BEND_ACTIONS ? modifierIcon(BEND_ACTIONS[action as keyof typeof BEND_ACTIONS]) : buttonIcon(action as ControllerButton)}<span>${actionLabel(action)}</span></span><button class="action binding-key" type="button" data-binding="${action}" aria-label="Change ${actionLabel(action)} key"><kbd></kbd></button></div>`).join('');
  for (const button of list.querySelectorAll<HTMLButtonElement>('[data-binding]')) {
    const action = button.dataset.binding as KeyboardAction;
    button.querySelector('kbd')!.textContent = state.bindingTarget === action ? '…' : keyLabel(state.bindings[action]);
    button.setAttribute('aria-pressed', String(state.bindingTarget === action));
  }
  for (const key of pad.querySelectorAll<HTMLElement>('[data-button]')) {
    const button = key.dataset.button as ControllerButton;
    key.querySelector('kbd')!.textContent = keyLabel(state.bindings[button]);
    key.setAttribute('aria-label', `Play ${buttonName(button)}, keyboard ${keyLabel(state.bindings[button])}`);
    key.title = `${pitchForButton(button).id} · keyboard ${keyLabel(state.bindings[button])}`;
  }
  for (const label of bends.querySelectorAll<HTMLElement>('[data-bend-label]')) {
    const action = KEYBOARD_ACTIONS.find(action => BEND_ACTIONS[action as keyof typeof BEND_ACTIONS] === Number(label.dataset.bendLabel))!;
    label.textContent = keyLabel(state.bindings[action]);
  }
}

function saveBindings(): void {
  must('#keyboard-status').textContent = writeStored(KEY_BINDINGS_STORAGE, state.bindings)
    ? 'Keyboard mapping saved.'
    : 'Mapping applies for this session; browser storage is unavailable.';
}

export function cancelBinding(): void {
  if (!state.bindingTarget) return;
  state.bindingTarget = null;
  renderBindings();
  must('#keyboard-status').textContent = 'Key assignment cancelled.';
}

export function bindKeyboard(): void {
  must('#keyboard-bindings').addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLElement>('[data-binding]');
    if (!button || !desktop.matches) return;
    stopPlayback();
    controls.reset();
    clearActive();
    state.bindingTarget = button.dataset.binding as KeyboardAction;
    renderBindings();
    must('#keyboard-status').textContent = `Press a key for ${actionLabel(state.bindingTarget)}. Escape cancels.`;
  });

  must<HTMLDetailsElement>('#keyboard-settings').addEventListener('toggle', event => {
    if (!(event.target as HTMLDetailsElement).open) cancelBinding();
  });

  must('#reset-bindings').addEventListener('click', () => {
    controls.reset();
    clearActive();
    state.bindingTarget = null;
    state.bindings = { ...DEFAULT_BINDINGS };
    saveBindings();
    renderBindings();
  });

  document.addEventListener('pointerdown', event => {
    if (!(event.target as Element).closest('#keyboard-settings')) cancelBinding();
  });

  desktop.addEventListener('change', () => { cancelBinding(); controls.reset(); clearActive(); });

  renderBindings();

  window.addEventListener('focusin', (event) => {
    if (!isEditingTarget(event.target)) return;
    controls.reset();
    clearActive();
  });

  window.addEventListener('keydown', (event) => {
    if (state.bindingTarget && desktop.matches) {
      if (event.code === 'Escape' || event.code === 'Tab') {
        if (event.code === 'Escape') event.preventDefault();
        cancelBinding();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      if (event.repeat) return;
      const updated = assignKey(state.bindings, state.bindingTarget, event.code);
      if (!updated) {
        must('#keyboard-status').textContent = 'Choose an unused letter, number, arrow or punctuation key.';
        return;
      }
      state.bindings = updated;
      state.bindingTarget = null;
      saveBindings();
      renderBindings();
      return;
    }
    if (state.view !== 'lesson' || isEditingTarget(event.target)) return;
    handleKeyDown(event, controls, state.bindings);
  });

  window.addEventListener('keyup', (event) => {
    if (isEditingTarget(event.target)) return;
    const action = actionForCode(state.bindings, event.code);
    if (action && action in BEND_ACTIONS) {
      event.preventDefault();
      controls.bendUp(`key:${event.code}`);
    } else if (action) {
      controls.noteUp(`key:${event.code}`);
    }
  });

  window.addEventListener('blur', () => {
    cancelBinding();
    controls.reset();
    clearActive();
  });
}
