import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';

const cast: Scene['cast'] = {
  lead: [{ frames: ['jurassic-park/trex-a', 'jurassic-park/trex-b'], who: 'trex' }],
  ambient: [{ frames: ['jurassic-park/glass'], height: 56 }],
  effect: [{ frames: ['jurassic-park/ripple'], height: 24 }],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
