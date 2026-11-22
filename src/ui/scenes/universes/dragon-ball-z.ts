import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';
import { star } from './shared';

const cast: Scene['cast'] = {
  lead: [{ frames: ['dragon-ball-z/sword'], who: 'sword' }],
  companion: [{ frames: ['dragon-ball-z/ball'], who: 'ball' }],
  effect: [{ frames: ['dragon-ball-z/glint'], height: 40 }, star],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
