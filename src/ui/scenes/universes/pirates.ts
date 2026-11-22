import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';
import { star } from './shared';

const cast: Scene['cast'] = {
  lead: [{ frames: ['pirates/ship'], who: 'ship' }],
  ambient: [{ frames: ['pirates/wave-back'], height: 22 }, { frames: ['pirates/wave-front'], height: 20 }],
  effect: [{ frames: ['pirates/spray'], height: 40 }, star],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
