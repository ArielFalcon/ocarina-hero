import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';
import { star } from './shared';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['beat-it/leader-black'], who: 'leader-black' }, { frames: ['beat-it/leader-white'], who: 'leader-white' }],
    companion: [1, 2, 3, 4, 5, 6].map(n => ({ frames: [`beat-it/dancer-${n}`], who: `dancer-${n}` })),
    runner: [{ frames: ['beat-it/dancer-run'], who: 'dancer-4', height: 64 }],
    ambient: [{ frames: ['beat-it/drum'], height: 52 }, { frames: ['beat-it/crates'], height: 46 }],
    effect: [star],
  },
  placements: STANDARD_PLACEMENTS,
};
