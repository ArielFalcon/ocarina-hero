import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['wii/mii-a', 'wii/mii-b'], who: 'mii-red' }],
    companion: [{ frames: ['wii/mii-blue'], who: 'mii-blue' }, { frames: ['wii/mii-green'], who: 'mii-green' }, { frames: ['wii/mii-pink'], who: 'mii-pink' }],
    runner: [{ frames: ['wii/mii-run'], who: 'mii-orange', height: 64 }],
    ambient: [{ frames: ['wii/console'], height: 54 }, { frames: ['wii/remote'], height: 20 }, { frames: ['wii/ball'], height: 30 }],
    effect: [{ frames: ['wii/sparkle'], height: 40 }, { frames: ['wii/ring'], height: 40 }],
  },
  placements: STANDARD_PLACEMENTS,
};
