import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';
import { feather, star } from './shared';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['barbie/barbie'], who: 'barbie' }],
    companion: [{ frames: ['barbie/ken'], who: 'ken' }, { frames: ['barbie/rider-pink'], who: 'rider-pink' }, { frames: ['barbie/rider-yellow'], who: 'rider-yellow' }],
    runner: [{ frames: ['barbie/car'], who: 'car', height: 52 }],
    ambient: [{ frames: ['barbie/parasol'], height: 58 }, { frames: ['barbie/palm'], height: 60 }, { frames: ['barbie/ring'], height: 24 }],
    effect: [star, feather],
  },
  placements: STANDARD_PLACEMENTS,
};
