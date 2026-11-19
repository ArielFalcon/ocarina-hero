import type { Note } from '../core/ir';
import { pitchById, type ControllerButton } from '../core/pitches';
import { buttonIcon, modifierIcon } from './controller-icons';
import { clefUrl, instruction } from './platform';

/** Vertical staff position of each controller button, in pixels from the staff top. */
const STAFF_LEVELS: Record<ControllerButton, number> = { L: 96, R: 78, A: 60, Y: 42, X: 24 };

/** The staff's clef mark: the ocarina patch on cloth, an orange treble clef on the retro staff. */
export function staffClef(): string {
  return `<span class="staff-clef"><img src="${clefUrl()}" alt="" aria-hidden="true" draggable="false" decoding="async" /></span>`;
}

/** One note token placed in its slot of a staff window; shared by the lesson and the quick player. */
export function staffTokenHtml(note: Note, index: number, slot: number, count: number, classes = '', current = false): string {
  const spec = pitchById(note.pitch);
  return `<button type="button" class="tok${classes ? ` ${classes}` : ''}" data-note-index="${index}" style="--staff-x:calc(42px + min(var(--staff-step, 100%), calc((100% - 64px) / ${count})) * ${slot + .5});--staff-y:${STAFF_LEVELS[spec.button]}px" aria-label="Note ${index + 1}: ${instruction(spec.button, note.bend ?? 0)}"${current ? ' aria-current="true"' : ''}>${buttonIcon(spec.button)}<span class="note-order" aria-hidden="true">${index + 1}</span>${note.bend ? `<span class="staff-modifier">${modifierIcon(note.bend)}</span>` : ''}</button>`;
}
