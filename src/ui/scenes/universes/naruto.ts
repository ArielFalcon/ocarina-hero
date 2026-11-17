import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['naruto/naruto-a', 'naruto/naruto-b'], who: 'naruto' }],
    companion: [
      { frames: ['naruto/lee-a', 'naruto/lee-b'], who: 'lee' },
      { frames: ['naruto/gaara-a', 'naruto/gaara-b'], who: 'gaara' },
      { frames: ['naruto/kurama'], who: 'kurama' },
      { frames: ['naruto/orochimaru'], who: 'orochimaru' },
      { frames: ['naruto/pain-a', 'naruto/pain-b'], who: 'pain' },
    ],
    runner: [
      { frames: ['naruto/naruto-run'], who: 'naruto', height: 64, faces: 'left' },
      { frames: ['naruto/lee-kick'], who: 'lee', height: 64 },
      { frames: ['naruto/snake'], who: 'snake', height: 48, faces: 'left' },
    ],
    ambient: [{ frames: ['naruto/kunai'], height: 50 }, { frames: ['naruto/scroll'], height: 18 }, { frames: ['naruto/headband'], height: 20 }],
    effect: [{ frames: ['naruto/shuriken'], height: 40 }, { frames: ['naruto/leaf'], height: 40 }, { frames: ['naruto/smoke'], height: 48 }, { frames: ['naruto/sand'], height: 48 }],
  },
  placements: STANDARD_PLACEMENTS,
};
