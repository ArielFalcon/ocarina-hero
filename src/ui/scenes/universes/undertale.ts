import type { Scene } from '../scene';
import { STANDARD_PLACEMENTS } from './layout';

export const scene: Scene = {
  cast: {
    lead: [{ frames: ['undertale/sans-a', 'undertale/sans-b'], who: 'sans' }],
    companion: [{ frames: ['undertale/papyrus'], who: 'papyrus' }, { frames: ['undertale/toriel'], who: 'toriel' }, { frames: ['undertale/frisk'], who: 'frisk' }],
    runner: [{ frames: ['undertale/dog-run'], who: 'dog', height: 40 }],
    ambient: [{ frames: ['undertale/spaghetti'], height: 26 }, { frames: ['undertale/echo'], height: 54 }, { frames: ['undertale/hotdog'], height: 18 }],
    effect: [{ frames: ['undertale/save'], height: 40 }, { frames: ['undertale/soul'], height: 38 }],
  },
  placements: STANDARD_PLACEMENTS,
};
