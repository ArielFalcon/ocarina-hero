import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['jujutsu-kaisen/yuji-a', 'jujutsu-kaisen/yuji-b'], who: 'yuji' }],
    companion: [
      { frames: ['jujutsu-kaisen/megumi-a', 'jujutsu-kaisen/megumi-b'], who: 'megumi' },
      { frames: ['jujutsu-kaisen/nobara'], who: 'nobara' },
      { frames: ['jujutsu-kaisen/gojo'], who: 'gojo' },
    ],
    runner: [{ frames: ['jujutsu-kaisen/wolf-run'], who: 'white-wolf', height: 48 }],
    ambient: [{ frames: ['jujutsu-kaisen/finger'], height: 30 }, { frames: ['jujutsu-kaisen/nails'], height: 30 }, { frames: ['jujutsu-kaisen/black-dog'], height: 44 }],
    effect: [{ frames: ['jujutsu-kaisen/cursed'], height: 40 }, { frames: ['jujutsu-kaisen/flash'], height: 40 }],
  },
  placements: STANDARD_PLACEMENTS,
};
