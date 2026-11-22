import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';

const cast: Scene['cast'] = {
  lead: [{ frames: ['simpsons/donut-a', 'simpsons/donut-b'], who: 'donut' }],
  effect: [{ frames: ['simpsons/sprinkle-red'], height: 22 }, { frames: ['simpsons/sprinkle-yellow'], height: 22 }],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
