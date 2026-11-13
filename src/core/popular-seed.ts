/**
 * Songs the "Most popular" list starts with, so it is never empty. Each holds a baseline score the
 * server adds to its real one; songs with more real plays overtake them as data accumulates.
 */
export const POPULAR_SEED: readonly string[] = [
  'catalogue-evangelion',
  'catalogue-blue-bird',
  'catalogue-concerning-hobbits',
  'catalogue-pokemon-gym-victory',
  'v1',
  'catalogue-l-theme',
  'catalogue-lavender-town',
  'catalogue-godfather-love-theme',
  'catalogue-mii-channel',
  'catalogue-smw-overworld',
];

/** Worth about five lesson opens from different visitors this week; the listed order breaks ties. */
export const SEED_BASE_SCORE = 10;
