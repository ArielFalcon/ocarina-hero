import type { ControllerButton } from '../core/pitches';
import type { ControlScheme } from '../core/tab';
import type { Controls } from './input';

/** Where a control scheme puts its notes and bends on a pad with the standard layout. */
interface PadLayout {
  readonly noteButtons: readonly (readonly [index: number, button: ControllerButton])[];
  readonly bendButtons: readonly (readonly [index: number, bend: number])[];
  /** Vertical stick axes that bend a tone, up being positive. */
  readonly bendAxes: readonly number[];
  /** Stick that plays one note per direction: [x axis, y axis, right, left, up, down]. */
  readonly noteStick?: readonly [x: number, y: number, right: ControllerButton, left: ControllerButton, up: ControllerButton, down: ControllerButton];
}

const LAYOUTS: Record<ControlScheme, PadLayout> = {
  /** By position: a Nintendo pad labels the right face button A, the left one Y and the top one X; the D-pad bends a semitone. */
  switch: { noteButtons: [[4, 'L'], [5, 'R'], [1, 'A'], [2, 'Y'], [3, 'X']], bendButtons: [[12, 1], [13, -1]], bendAxes: [1, 3] },
  /** A is either lower face button, the right stick is the C buttons, and both right and both left shoulders are R and Z. */
  n64: { noteButtons: [[0, 'L'], [1, 'L']], bendButtons: [[5, 1], [7, 1], [4, -1], [6, -1]], bendAxes: [1], noteStick: [2, 3, 'A', 'Y', 'X', 'R'] },
};
const STICK_DEAD_ZONE = 0.5;

/** The part of a browser `Gamepad` this module reads. */
export interface PadSnapshot {
  readonly index: number;
  readonly mapping: string;
  readonly buttons: readonly { readonly pressed: boolean }[];
  readonly axes: readonly number[];
}

type Press = { readonly button: ControllerButton } | { readonly bend: number };

function pressesOf(pad: PadSnapshot, layout: PadLayout): Map<string, Press> {
  const presses = new Map<string, Press>();
  const source = (kind: string, name: string) => `pad:${pad.index}:${kind}:${name}`;
  for (const [index, bend] of layout.bendButtons) {
    if (pad.buttons[index]?.pressed) presses.set(source('bend', `button-${index}`), { bend });
  }
  for (const axis of layout.bendAxes) {
    const tilt = pad.axes[axis] ?? 0;
    if (tilt <= -STICK_DEAD_ZONE) presses.set(source('bend', `axis-${axis}-up`), { bend: 2 });
    if (tilt >= STICK_DEAD_ZONE) presses.set(source('bend', `axis-${axis}-down`), { bend: -2 });
  }
  for (const [index, button] of layout.noteButtons) {
    if (pad.buttons[index]?.pressed) presses.set(source('note', button), { button });
  }
  if (layout.noteStick) {
    const [xAxis, yAxis, right, left, up, down] = layout.noteStick;
    const x = pad.axes[xAxis] ?? 0;
    const y = pad.axes[yAxis] ?? 0;
    if (Math.max(Math.abs(x), Math.abs(y)) >= STICK_DEAD_ZONE) {
      const button = Math.abs(x) > Math.abs(y) ? (x > 0 ? right : left) : (y < 0 ? up : down);
      presses.set(source('note', button), { button });
    }
  }
  return presses;
}

/** Feeds polled gamepad state into the shared controls; every pad control is its own input source. */
export class GamepadInput {
  private held = new Map<string, Press>();

  constructor(private readonly controls: Pick<Controls, 'noteDown' | 'noteUp' | 'bendDown' | 'bendUp'>) {}

  /** Apply one poll under a control scheme and report whether a pad with the standard layout is connected. */
  update(pads: readonly (PadSnapshot | null)[], scheme: ControlScheme = 'switch'): boolean {
    const usable = pads.filter((pad): pad is PadSnapshot => pad?.mapping === 'standard');
    const pressed = new Map(usable.flatMap(pad => [...pressesOf(pad, LAYOUTS[scheme])]));
    for (const [source, press] of this.held) {
      if (pressed.has(source)) continue;
      if ('bend' in press) this.controls.bendUp(source);
      else this.controls.noteUp(source);
    }
    for (const [source, press] of pressed) {
      if (this.held.has(source)) continue;
      if ('bend' in press) this.controls.bendDown(source, press.bend);
      else this.controls.noteDown(source, press.button);
    }
    this.held = pressed;
    return usable.length > 0;
  }
}
