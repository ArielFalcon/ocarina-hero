import type { Scene } from '../scene';
import { standardPlacementsFor } from './layout';
import { star } from './shared';

const cast: Scene['cast'] = {
  lead: [{ frames: ['james-bond/barrel'], who: 'barrel' }],
  companion: [{ frames: ['james-bond/martini'], who: 'martini' }],
  ambient: [{ frames: ['james-bond/bowtie'], height: 28 }],
  effect: [star],
};

export const scene: Scene = { cast, placements: standardPlacementsFor(cast) };
