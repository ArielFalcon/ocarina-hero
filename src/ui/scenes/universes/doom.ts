import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['doom/slayer-a', 'doom/slayer-b'], who: 'slayer' }],
    companion: [{ frames: ['doom/cacodemon'], who: 'cacodemon' }, { frames: ['doom/imp'], who: 'imp' }, { frames: ['doom/pinky'], who: 'pinky' }],
    runner: [{ frames: ['doom/skull-run'], who: 'lost-soul', height: 40 }],
    ambient: [{ frames: ['doom/barrel'], height: 36 }, { frames: ['doom/medkit'], height: 24 }, { frames: ['doom/helmet'], height: 26 }],
    effect: [{ frames: ['doom/fireball'], height: 40 }, { frames: ['doom/sphere'], height: 40 }],
  },
  placements: STANDARD_PLACEMENTS,
};
