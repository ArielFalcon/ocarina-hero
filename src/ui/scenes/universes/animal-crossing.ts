import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['animal-crossing/nook'], who: 'nook' }],
    companion: [{ frames: ['animal-crossing/kk'], who: 'kk' }, { frames: ['animal-crossing/blathers'], who: 'blathers' }],
    runner: [{ frames: ['animal-crossing/villager-run'], who: 'villager', height: 64 }],
    ambient: [{ frames: ['animal-crossing/bells'], height: 40 }, { frames: ['animal-crossing/peach'], height: 54 }, { frames: ['animal-crossing/leaf'], height: 30 }],
    effect: [{ frames: ['animal-crossing/note'], height: 40 }, { frames: ['animal-crossing/star'], height: 40 }],
  },
  placements: STANDARD_PLACEMENTS,
};
