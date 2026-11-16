/**
 * The five pitches of the ocarina in the 2026 remake.
 *
 * The instrument is unchanged from the N64 original: five fixed pitches, no
 * transposition and one voice at a time. Available pitch classes are
 * {D, F, A, B}, which is a Dm6 arpeggio spread over exactly one octave.
 */
export const PITCH_IDS = ['D4', 'F4', 'A4', 'B4', 'D5'] as const;

export type PitchId = (typeof PITCH_IDS)[number];

/** Buttons used by the ocarina on the Switch 2 controller. */
export type ControllerButton = 'L' | 'R' | 'A' | 'Y' | 'X';

export interface PitchSpec {
  readonly id: PitchId;
  readonly hz: number;
  /** MIDI note number, for imports and projection. */
  readonly midi: number;
  readonly button: ControllerButton;
  /** Physical key, independent of the keyboard layout. */
  readonly code: string;
  /** Label shown to the user for the keyboard key. */
  readonly keyLabel: string;
}

export const PITCHES: readonly PitchSpec[] = [
  { id: 'D4', hz: 293.66, midi: 62, button: 'L', code: 'KeyQ', keyLabel: 'Q' },
  { id: 'F4', hz: 349.23, midi: 65, button: 'R', code: 'KeyE', keyLabel: 'E' },
  { id: 'A4', hz: 440.0, midi: 69, button: 'A', code: 'KeyD', keyLabel: 'D' },
  { id: 'B4', hz: 493.88, midi: 71, button: 'Y', code: 'KeyA', keyLabel: 'A' },
  { id: 'D5', hz: 587.33, midi: 74, button: 'X', code: 'KeyW', keyLabel: 'W' },
];

const BY_CODE = new Map(PITCHES.map((pitch) => [pitch.code, pitch]));
const BY_ID = new Map(PITCHES.map((pitch) => [pitch.id, pitch]));
const BY_BUTTON = new Map(PITCHES.map((pitch) => [pitch.button, pitch]));

export function pitchForCode(code: string): PitchSpec | undefined {
  return BY_CODE.get(code);
}

export function pitchById(id: PitchId): PitchSpec {
  const pitch = BY_ID.get(id);
  if (!pitch) throw new RangeError(`Unknown pitch: ${id}`);
  return pitch;
}

export function pitchForButton(button: ControllerButton): PitchSpec {
  const pitch = BY_BUTTON.get(button);
  if (!pitch) throw new RangeError(`Unknown button: ${button}`);
  return pitch;
}

/** Maximum bend the stick and D-pad allow: a whole tone. */
export const BEND_LIMIT = 2;

/** Sounding pitches are one octave above the written names used in tabs. */
const OCTAVE_SHIFT = 1;

/** Cent offsets that make the synthesized ocarina match one console's recording. */
export interface TuningProfile {
  readonly noteCents: Readonly<Record<PitchId, number>>;
  /** Extra correction for a bend on a pitch, keyed by the bend in semitones. */
  readonly bendCents: Readonly<Partial<Record<PitchId, Readonly<Record<number, number>>>>>;
}

/**
 * The Switch 2 remake: medians of 25 gameplay holds, every button with each D-pad and stick
 * bend. Its F sits about 20 cents below the other notes. Stick-down holds drift 20 to 45 cents
 * within a hold, so those five values are the least certain.
 */
export const SWITCH2_TUNING: TuningProfile = {
  noteCents: { D4: 24.79, F4: 4.37, A4: 28.42, B4: 23.41, D5: 23.63 },
  bendCents: {
    D4: { [-2]: 2.57, [-1]: -8.15, 1: 3.39, 2: -3.78 },
    F4: { [-2]: 1.25, [-1]: 3.06, 1: -8.97, 2: 0.21 },
    A4: { [-2]: -1.8, [-1]: -3.82, 1: -5.13, 2: -3.37 },
    B4: { [-2]: 6.34, [-1]: -0.04, 1: -2.3, 2: 1.33 },
    D5: { [-2]: 6.6, [-1]: -22.6, 1: 11.77, 2: -3.59 },
  },
};

/**
 * The 1998 N64 original: base notes from two gameplay recordings, close to equal temperament.
 * Bends were not measured and stay nominal.
 */
export const N64_TUNING: TuningProfile = {
  noteCents: { D4: 5, F4: 3, A4: 5, B4: 4, D5: 3 },
  bendCents: {},
};

/**
 * The 2011 3DS release: base notes from a gameplay recording, close to equal temperament.
 * Its F has the fewest samples. Bends were not measured and stay nominal.
 */
export const THREEDS_TUNING: TuningProfile = {
  noteCents: { D4: 6, F4: 10, A4: 4, B4: 3, D5: 4 },
  bendCents: {},
};

/** Extra offset on top of the measured table, for the user's own setup. */
let fineTuningCents = 0;

export function setTuning(cents: number): void {
  fineTuningCents = Number.isFinite(cents) ? cents : 0;
}

export function getTuning(): number {
  return fineTuningCents;
}

/** Frequency of a pitch with an optional bend in semitones. */
export function frequencyOf(id: PitchId, bend = 0, tuning: TuningProfile = SWITCH2_TUNING): number {
  const correction = tuning.bendCents[id]?.[bend] ?? 0;
  const cents = tuning.noteCents[id] + fineTuningCents + correction;
  return pitchById(id).hz * 2 ** (OCTAVE_SHIFT + (bend + cents / 100) / 12);
}
