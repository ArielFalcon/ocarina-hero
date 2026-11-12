import type { ControllerButton } from '../core/pitches';
import { modifierForBend, noteInstruction } from '../core/tab';

function icon(name: string, kind: 'button' | 'shoulder' | 'modifier' | 'plus'): string {
  return `<img class="control-icon control-icon--${kind}" src="/icons/controller/${name}.svg" alt="" aria-hidden="true" draggable="false" />`;
}

export function buttonIcon(button: ControllerButton): string {
  return icon(button.toLowerCase(), button === 'L' || button === 'R' ? 'shoulder' : 'button');
}

export function modifierIcon(bend: number): string {
  const modifier = modifierForBend(bend);
  return modifier ? icon(`${modifier.control}-${modifier.direction}`, 'modifier') : '';
}

/** A single accessible instruction composed from independently reusable SVG assets. */
export function noteIcons(button: ControllerButton, bend = 0): string {
  return `<span class="note-instruction" role="img" aria-label="${noteInstruction(button, bend)}">${buttonIcon(button)}${
    bend ? `${icon('plus', 'plus')}${modifierIcon(bend)}` : ''
  }</span>`;
}
