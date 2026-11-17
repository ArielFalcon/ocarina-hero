import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['evangelion/shinji-a', 'evangelion/shinji-b'], who: 'shinji' }],
    companion: [
      { frames: ['evangelion/rei-a', 'evangelion/rei-b'], who: 'rei' },
      { frames: ['evangelion/asuka'], who: 'asuka' },
      { frames: ['evangelion/penpen'], who: 'penpen' },
    ],
    runner: [{ frames: ['evangelion/unit-01-run'], who: 'unit-01', height: 56, faces: 'left' }],
    ambient: [{ frames: ['evangelion/sdat'], height: 30 }, { frames: ['evangelion/core'], height: 32 }, { frames: ['evangelion/plug'], height: 14 }],
    effect: [{ frames: ['evangelion/at-field'], height: 40 }, { frames: ['evangelion/cross'], height: 40 }],
  },
  placements: STANDARD_PLACEMENTS,
};
