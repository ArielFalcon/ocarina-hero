import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';

const cast: Scene['cast'] = {
  lead: [{ frames: ['mission-impossible/bomb'], who: 'bomb' }],
  ambient: [{ frames: ['mission-impossible/fuse'], height: 14 }, { frames: ['mission-impossible/puff'], height: 30 }],
  effect: [{ frames: ['mission-impossible/spark-a'], height: 40 }, { frames: ['mission-impossible/spark-b'], height: 40 }],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
