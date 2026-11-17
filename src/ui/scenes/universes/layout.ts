import type { ScenePlacement } from '../scene';

/**
 * The composition every universe shares: on desktop the lead hangs beside the heading and a companion from the
 * controller panel; on phones the band holds, left to right, a prop, a companion, a prop and the lead, with two
 * effects over them and a runner crossing. A universe changes only its cast.
 */
export const STANDARD_PLACEMENTS: readonly ScenePlacement[] = [
  { slot: 'heading', role: 'lead' },
  { slot: 'heading', role: 'effect' },
  { slot: 'controller', role: 'companion', delayMs: 220 },
  { slot: 'controller', role: 'effect', member: 1, delayMs: 160 },
  { slot: 'band', role: 'ambient' },
  { slot: 'band', role: 'companion', delayMs: 220 },
  { slot: 'band', role: 'ambient', member: 1 },
  { slot: 'band', role: 'lead' },
  { slot: 'band', role: 'effect' },
  { slot: 'band', role: 'effect', member: 1, delayMs: 160 },
  { slot: 'band', role: 'runner' },
];
