import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';
import { drop, feather, star } from './shared';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['pokemon/togepi-a', 'pokemon/togepi-b'], who: 'togepi' }],
    companion: [
      { frames: ['pokemon/squirtle'], who: 'squirtle' },
      { frames: ['pokemon/rattata-a', 'pokemon/rattata-b'], who: 'rattata' },
      { frames: ['pokemon/oak-a', 'pokemon/oak-b'], who: 'oak' },
      { frames: ['pokemon/joy-a', 'pokemon/joy-b'], who: 'joy' },
      { frames: ['pokemon/mom'], who: 'mom' },
    ],
    runner: [{ frames: ['pokemon/rattata-run'], who: 'rattata', height: 46, faces: 'left' }],
    ambient: [
      { frames: ['pokemon/ball'], height: 34 }, { frames: ['pokemon/flowers'], height: 40 },
      { frames: ['pokemon/plant'], height: 58 }, { frames: ['pokemon/egg'], height: 36 },
    ],
    effect: [star, feather, drop],
  },
  placements: STANDARD_PLACEMENTS,
};
