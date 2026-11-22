import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';
import { star } from './shared';

const cast: Scene['cast'] = {
  lead: [{ frames: ['never-gonna/record'], who: 'record' }],
  companion: [{ frames: ['never-gonna/heart'], who: 'heart' }],
  effect: [{ frames: ['never-gonna/note'], height: 40 }, star],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
