import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';

const cast: Scene['cast'] = {
  lead: [{ frames: ['lambada/maraca-a'], who: 'maraca-a' }],
  companion: [{ frames: ['lambada/maraca-b'], who: 'maraca-b' }],
  ambient: [{ frames: ['lambada/beach'], height: 40 }],
  effect: [{ frames: ['lambada/shake'], height: 40 }],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
