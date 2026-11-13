import type { Note } from '../core/ir';
import { pitchById, type ControllerButton } from '../core/pitches';
import { noteInstruction } from '../core/tab';
import { buttonIcon, modifierIcon } from './controller-icons';

/** Vertical staff position of each controller button, in pixels from the staff top. */
const STAFF_LEVELS: Record<ControllerButton, number> = { L: 96, R: 78, A: 60, Y: 42, X: 24 };

export const STAFF_CLEF = `<span class="staff-clef"><img src="${import.meta.env.BASE_URL}icons/app/icon-192.png" alt="" aria-hidden="true" draggable="false" decoding="async" /></span>`;

/** One note token placed in its slot of a staff window; shared by the lesson and the quick player. */
export function staffTokenHtml(note: Note, index: number, slot: number, count: number, classes = '', current = false): string {
  const spec = pitchById(note.pitch);
  return `<button type="button" class="tok${classes ? ` ${classes}` : ''}" data-note-index="${index}" style="--staff-x:calc(42px + (100% - 64px) * ${(slot + .5) / count});--staff-y:${STAFF_LEVELS[spec.button]}px" aria-label="Note ${index + 1}: ${noteInstruction(spec.button, note.bend ?? 0)}"${current ? ' aria-current="true"' : ''}>${buttonIcon(spec.button)}<span class="note-order" aria-hidden="true">${index + 1}</span>${note.bend ? `<span class="staff-modifier">${modifierIcon(note.bend)}</span>` : ''}</button>`;
}
