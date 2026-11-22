import type { Scene, ScenePlacement } from '../scene';

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

/**
 * The standard composition for a universe whose cast has no figure for some roles (a small cast: no companion, no
 * runner): the places of roles without a figure are dropped, so no slot is left waiting for one.
 */
export function standardPlacementsFor(cast: Scene['cast']): readonly ScenePlacement[] {
  return STANDARD_PLACEMENTS.filter(placement => (cast[placement.role]?.length ?? 0) > 0);
}
