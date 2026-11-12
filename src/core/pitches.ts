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

/** Buttons used by the ocarina on the N64 original. */
export type N64Button = 'A' | 'C-Down' | 'C-Right' | 'C-Left' | 'C-Up';

export interface PitchSpec {
  readonly id: PitchId;
  readonly hz: number;
  /** MIDI note number, for imports and projection. */
  readonly midi: number;
  readonly button: ControllerButton;
  readonly n64: N64Button;
  /** Physical key, independent of the keyboard layout. */
  readonly code: string;
  /** Label shown to the user for the keyboard key. */
  readonly keyLabel: string;
}

export const PITCHES: readonly PitchSpec[] = [
  { id: 'D4', hz: 293.66, midi: 62, button: 'L', n64: 'A', code: 'KeyQ', keyLabel: 'Q' },
  { id: 'F4', hz: 349.23, midi: 65, button: 'R', n64: 'C-Down', code: 'KeyE', keyLabel: 'E' },
  { id: 'A4', hz: 440.0, midi: 69, button: 'A', n64: 'C-Right', code: 'KeyD', keyLabel: 'D' },
  { id: 'B4', hz: 493.88, midi: 71, button: 'Y', n64: 'C-Left', code: 'KeyA', keyLabel: 'A' },
  { id: 'D5', hz: 587.33, midi: 74, button: 'X', n64: 'C-Up', code: 'KeyW', keyLabel: 'W' },
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

/** Provisional offsets from the isolated base-note recording; see docs/calibration.md. */
const NOTE_TUNING: Record<PitchId, number> = {
  D4: 23.92,
  F4: 4.31,
  A4: 27.38,
  B4: 23.59,
  D5: 23.31,
};

const BEND_TUNING_CENTS: Partial<Record<PitchId, Readonly<Record<number, number>>>> = {
  D5: { [-1]: -19, 1: 14 },
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
export function frequencyOf(id: PitchId, bend = 0): number {
  const correction = BEND_TUNING_CENTS[id]?.[bend] ?? 0;
  const cents = NOTE_TUNING[id] + fineTuningCents + correction;
  return pitchById(id).hz * 2 ** (OCTAVE_SHIFT + (bend + cents / 100) / 12);
}
