import type { ControllerButton } from '../core/pitches';
import { modifierForBend, noteInstruction } from '../core/tab';
import { assetDir, controlScheme, currentTheme } from './theme';

type IconKind = 'button' | 'shoulder' | 'modifier' | 'plus';

/** Retro glyphs for each remake glyph: notes become A and C-buttons, the D-pad becomes R and Z. */
const N64_GLYPHS: Record<string, string> = {
  l: 'a', r: 'c-down', a: 'c-right', y: 'c-left', x: 'c-up', 'dpad-up': 'r', 'dpad-down': 'z',
};

function glyph(name: string, kind: IconKind): { file: string; kind: IconKind } {
  if (currentTheme() !== 'retro') return { file: name, kind };
  return { file: N64_GLYPHS[name] ?? name, kind: kind === 'shoulder' ? 'button' : kind };
}

function icon(name: string, kind: IconKind): string {
  const shown = glyph(name, kind);
  return `<img class="control-icon control-icon--${shown.kind}" src="${assetDir('controller')}${shown.file}.svg" alt="" aria-hidden="true" draggable="false" />`;
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
  return `<span class="note-instruction" role="img" aria-label="${noteInstruction(button, bend, controlScheme())}">${buttonIcon(button)}${
    bend ? `${icon('plus', 'plus')}${modifierIcon(bend)}` : ''
  }</span>`;
}
