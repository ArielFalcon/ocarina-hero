import type { ControllerButton } from '../core/pitches';
import { modifierForBend } from '../core/tab';
import { controllerIconUrl, instruction, platform } from './platform';

type IconKind = 'button' | 'shoulder' | 'modifier' | 'plus';

/** The active console's glyph for a remake glyph name. */
function glyph(name: string, kind: IconKind): { file: string; kind: IconKind } {
  const { glyphs, shoulderKind } = platform();
  return { file: glyphs[name] ?? name, kind: kind === 'shoulder' ? shoulderKind : kind };
}

function icon(name: string, kind: IconKind): string {
  const shown = glyph(name, kind);
  return `<img class="control-icon control-icon--${shown.kind}" src="${controllerIconUrl(shown.file)}" alt="" aria-hidden="true" draggable="false" />`;
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
  return `<span class="note-instruction" role="img" aria-label="${instruction(button, bend)}">${buttonIcon(button)}${
    bend ? `${icon('plus', 'plus')}${modifierIcon(bend)}` : ''
  }</span>`;
}
