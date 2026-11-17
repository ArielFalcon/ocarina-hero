import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';
import { star } from './shared';

const crew = ['zoro', 'nami', 'sanji', 'usopp', 'robin', 'franky', 'brook', 'chopper', 'jinbe'];

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['one-piece/luffy'], who: 'luffy' }],
    companion: crew.map(who => ({ frames: [`one-piece/${who}`], who })),
    runner: [{ frames: ['one-piece/ship'], who: 'ship', height: 64 }, { frames: ['one-piece/gulls'], who: 'gulls', height: 48 }],
    ambient: [{ frames: ['one-piece/sail'], height: 48 }],
    effect: [star, { frames: ['one-piece/cloud'], height: 40 }],
  },
  placements: STANDARD_PLACEMENTS,
};
