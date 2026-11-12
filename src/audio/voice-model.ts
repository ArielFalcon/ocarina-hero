/**
 * Tone and envelope parameters shared by Web Audio and offline analysis.
 *
 * The offline renderer does not include delay.
 */
export const VOICE = {
  attack: 0.035,
  decay: 0.18,
  peak: 0.85,
  sustain: 0.62,
  release: 0.28,
  minAudible: 0.05,
  master: 0.7,
  overtoneGain: 0.02,
  thirdGain: 0.005,
} as const;

/** Sum of the oscillator amplitudes, used to normalise the offline render. */
export const VOICE_PARTIAL_SUM = 1 + VOICE.overtoneGain + VOICE.thirdGain;

/** Bounds scheduled release tails while retaining a 5 ms fade. */
export function releaseForGap(gapSeconds: number): number {
  return Math.max(0.005, Math.min(VOICE.release, gapSeconds));
}
