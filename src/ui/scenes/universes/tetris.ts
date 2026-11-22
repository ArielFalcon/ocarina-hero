import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';
import { star } from './shared';

const cast: Scene['cast'] = {
  lead: [{ frames: ['tetris/t'], who: 't' }],
  companion: [{ frames: ['tetris/l'], who: 'l' }],
  ambient: [{ frames: ['tetris/o'], height: 40 }],
  effect: [star],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
