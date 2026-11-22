import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';

const cast: Scene['cast'] = {
  lead: [{ frames: ['game-of-thrones/dragon-a', 'game-of-thrones/dragon-b'], who: 'dragon' }],
  effect: [{ frames: ['game-of-thrones/fire'], height: 36 }, { frames: ['game-of-thrones/ember'], height: 36 }],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
