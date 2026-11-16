import type { ControllerButton } from './pitches';

/** How one controller names the ocarina's notes and bends; tabs and labels read it as data. */
export interface ControlScheme {
  /** Name of the control that plays each note, keyed by the Switch 2 button the tab stores. */
  readonly buttonLabels: Readonly<Record<ControllerButton, string>>;
  /** Name of the gesture for each supported bend in semitones. */
  readonly bendLabels: Readonly<Record<-2 | -1 | 1 | 2, string>>;
}

/** The Switch 2 remake: tabs store these buttons, the D-pad bends a semitone and the stick a tone. */
export const SWITCH_CONTROLS: ControlScheme = {
  buttonLabels: { L: 'L', R: 'R', A: 'A', Y: 'Y', X: 'X' },
  bendLabels: { [-2]: 'Stick down', [-1]: 'D-pad down', 1: 'D-pad up', 2: 'Stick up' },
};

/** The N64 original: A and the C buttons play, R and Z bend a semitone, the stick a tone. */
export const N64_CONTROLS: ControlScheme = {
  buttonLabels: { L: 'A', R: 'C-Down', A: 'C-Right', Y: 'C-Left', X: 'C-Up' },
  bendLabels: { [-2]: 'Stick down', [-1]: 'Z', 1: 'R', 2: 'Stick up' },
};
