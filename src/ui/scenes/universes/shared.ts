import type { ScenePiece } from '../scene';

/** Pieces any universe can use; scene modules import them, so they load with the first scene that does. */
export const star: ScenePiece = { frames: ['shared/star'], height: 40 };
export const feather: ScenePiece = { frames: ['shared/feather'], height: 30 };
export const drop: ScenePiece = { frames: ['shared/drop'], height: 32 };
