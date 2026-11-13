export const PREFERENCES_STORAGE = 'ocarina.preferences.v1';

export const PLAYBACK_RATES = ['1', '0.75', '0.5'] as const;
export type PlaybackRate = typeof PLAYBACK_RATES[number];

/** Lesson and practice choices kept across visits; Settings and the lesson options edit the same values. */
export interface Preferences {
  readonly bends: boolean;
  readonly simplify: boolean;
  readonly rate: PlaybackRate;
  readonly effects: boolean;
  readonly haptics: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = Object.freeze({ bends: true, simplify: false, rate: '1', effects: true, haptics: true });

export function readPreferences(stored: unknown): Preferences {
  const value = typeof stored === 'object' && stored !== null ? stored as Record<string, unknown> : {};
  const flag = (key: 'bends' | 'simplify' | 'effects' | 'haptics') => typeof value[key] === 'boolean' ? value[key] : DEFAULT_PREFERENCES[key];
  return {
    bends: flag('bends'),
    simplify: flag('simplify'),
    rate: PLAYBACK_RATES.includes(value.rate as PlaybackRate) ? value.rate as PlaybackRate : DEFAULT_PREFERENCES.rate,
    effects: flag('effects'),
    haptics: flag('haptics'),
  };
}
