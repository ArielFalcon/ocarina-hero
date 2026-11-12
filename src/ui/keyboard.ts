import { PITCHES, type ControllerButton } from '../core/pitches';
import type { Controls } from './input';

export const BEND_ACTIONS = { 'dpad-up': 1, 'dpad-down': -1, 'stick-up': 2, 'stick-down': -2 } as const;
export type KeyboardAction = ControllerButton | keyof typeof BEND_ACTIONS;
export type KeyBindings = Record<KeyboardAction, string>;
export const DEFAULT_BINDINGS: Readonly<KeyBindings> = Object.freeze({
  ...Object.fromEntries(PITCHES.map(pitch => [pitch.button, pitch.code])),
  'dpad-up': 'ArrowRight', 'dpad-down': 'ArrowLeft', 'stick-up': 'ArrowUp', 'stick-down': 'ArrowDown',
} as KeyBindings);
export const KEYBOARD_ACTIONS = Object.keys(DEFAULT_BINDINGS) as KeyboardAction[];
export const KEY_BINDINGS_STORAGE = 'ocarina.keyboard.v1';

export function isBindableCode(code: string): boolean {
  return /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(code);
}

export function readBindings(value: unknown): KeyBindings {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const codes = KEYBOARD_ACTIONS.map(action => record[action]);
    if (codes.every(code => typeof code === 'string' && isBindableCode(code)) && new Set(codes).size === codes.length) {
      return Object.fromEntries(KEYBOARD_ACTIONS.map(action => [action, record[action]])) as KeyBindings;
    }
  }
  return { ...DEFAULT_BINDINGS };
}

/** Reject conflicts so one physical key can never trigger two controls. */
export function assignKey(bindings: KeyBindings, action: KeyboardAction, code: string): KeyBindings | null {
  if (!isBindableCode(code) || KEYBOARD_ACTIONS.some(other => other !== action && bindings[other] === code)) return null;
  return { ...bindings, [action]: code };
}

export function actionForCode(bindings: KeyBindings, code: string): KeyboardAction | undefined {
  return KEYBOARD_ACTIONS.find(action => bindings[action] === code);
}

export function handleKeyDown(
  event: Pick<KeyboardEvent, 'code' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey' | 'preventDefault'>,
  controls: Controls,
  bindings: KeyBindings,
): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const action = actionForCode(bindings, event.code);
  if (!action) return false;
  event.preventDefault();
  if (!event.repeat) {
    if (action in BEND_ACTIONS) controls.bendDown(`key:${event.code}`, BEND_ACTIONS[action as keyof typeof BEND_ACTIONS]);
    else controls.noteDown(`key:${event.code}`, action as ControllerButton);
  }
  return true;
}

export function keyLabel(code: string): string {
  return ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space',
    Backquote: '`', Minus: '−', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' } as Record<string, string>)[code]
    ?? code.replace(/^(Key|Digit)/, '');
}
