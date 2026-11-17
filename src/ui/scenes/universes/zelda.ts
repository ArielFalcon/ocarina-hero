import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';
import { star } from './shared';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['zelda/link-a', 'zelda/link-b'], who: 'link' }],
    companion: [
      { frames: ['zelda/zelda'], who: 'zelda' },
      { frames: ['zelda/guard-a', 'zelda/guard-b'], who: 'guard' },
      { frames: ['zelda/cucco-round'] },
      { frames: ['zelda/cucco-flap'] },
    ],
    runner: [
      { frames: ['zelda/ganondorf'], who: 'ganondorf', height: 64 },
      { frames: ['zelda/zelda-impa'], who: 'zelda', height: 64 },
      { frames: ['zelda/cucco-dive'], height: 44 },
    ],
    ambient: [
      { frames: ['zelda/signpost'], height: 50 }, { frames: ['zelda/bush'], height: 32 }, { frames: ['zelda/rock'], height: 28 },
      { frames: ['zelda/ocarina'], height: 22 }, { frames: ['zelda/rupee'], height: 32 },
    ],
    effect: [{ frames: ['zelda/fairy'], height: 42 }, { frames: ['zelda/splash'], height: 40 }, { frames: ['zelda/smoke-ring'], height: 28 }, star],
  },
  placements: STANDARD_PLACEMENTS,
};
