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
  /** The felt Link that hangs from the top of the app. */
  readonly link: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = Object.freeze({ bends: true, simplify: false, rate: '1', effects: true, haptics: true, link: true });

export function readPreferences(stored: unknown): Preferences {
  const value = typeof stored === 'object' && stored !== null ? stored as Record<string, unknown> : {};
  const flag = (key: 'bends' | 'simplify' | 'effects' | 'haptics' | 'link') => typeof value[key] === 'boolean' ? value[key] : DEFAULT_PREFERENCES[key];
  return {
    bends: flag('bends'),
    simplify: flag('simplify'),
    rate: PLAYBACK_RATES.includes(value.rate as PlaybackRate) ? value.rate as PlaybackRate : DEFAULT_PREFERENCES.rate,
    effects: flag('effects'),
    haptics: flag('haptics'),
    link: flag('link'),
  };
}

export type PreferencesListener = (next: Preferences, previous: Preferences, persisted: boolean) => void;

/** The single owner of the preferences: every input reads and writes through it and re-renders on its change. */
export interface PreferenceStore {
  get(): Preferences;
  /** Apply a change for this session and persist it; listeners hear whether it was persisted. */
  update(change: Partial<Preferences>): void;
  subscribe(listener: PreferencesListener): void;
}

export function createPreferenceStore(initial: Preferences, persist: (value: Preferences) => boolean): PreferenceStore {
  let current = initial;
  const listeners: PreferencesListener[] = [];
  return {
    get: () => current,
    update(change) {
      const previous = current;
      current = { ...current, ...change };
      const persisted = persist(current);
      for (const listener of listeners) listener(current, previous, persisted);
    },
    subscribe(listener) { listeners.push(listener); },
  };
}
