import type { Note } from './ir';

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'expert'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export interface Difficulty {
  /** Weighted player actions per second: 0.6 × densest window + 0.4 × whole-song average. */
  readonly score: number;
  readonly level: DifficultyLevel;
}

/** Window used to find the hardest passage, in seconds; also the minimum span of a song. */
const PEAK_WINDOW_SECONDS = 4;
/** Lower bound of each tier above easy. Fixed, so adding songs never relabels the others. */
const THRESHOLDS: readonly [DifficultyLevel, number][] = [['expert', 7.5], ['hard', 5.5], ['medium', 3.5]];

export function difficultyOf(score: number): DifficultyLevel {
  return THRESHOLDS.find(([, minimum]) => score >= minimum)?.[0] ?? 'easy';
}

/**
 * Rates the notes a player actually plays. Each note costs one press, one more when its
 * bend differs from the previous note's (the stick has to move) and a quarter when it is
 * held bent. The hardest passage weighs more than the average.
 */
export function rateDifficulty(notes: readonly Note[], tempoBpm: number): Difficulty {
  const secondsPerBeat = 60 / tempoBpm;
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
  const events = sorted.map((note, index) => {
    const bend = note.bend ?? 0;
    const previous = index ? sorted[index - 1]!.bend ?? 0 : 0;
    return { time: note.startBeat * secondsPerBeat, cost: 1 + (bend !== previous ? 1 : 0) + (bend !== 0 ? 0.25 : 0) };
  });
  if (events.length < 2) return { score: 0, level: 'easy' };

  const last = sorted.at(-1)!;
  const span = Math.max(PEAK_WINDOW_SECONDS, (last.startBeat + last.durationBeats) * secondsPerBeat - events[0]!.time);
  const total = events.reduce((sum, event) => sum + event.cost, 0);

  let peak = 0;
  let windowCost = 0;
  let first = 0;
  for (const event of events) {
    windowCost += event.cost;
    while (event.time - events[first]!.time >= PEAK_WINDOW_SECONDS) windowCost -= events[first++]!.cost;
    peak = Math.max(peak, windowCost / PEAK_WINDOW_SECONDS);
  }

  const score = Math.round((0.6 * peak + 0.4 * (total / span)) * 100) / 100;
  return { score, level: difficultyOf(score) };
}
