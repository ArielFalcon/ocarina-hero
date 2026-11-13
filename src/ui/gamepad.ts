import type { ControllerButton } from '../core/pitches';
import type { Controls } from './input';

/** Standard-layout positions: a Nintendo pad labels the right face button A, the left one Y and the top one X. */
const NOTE_BUTTONS: readonly (readonly [index: number, button: ControllerButton])[] = [[4, 'L'], [5, 'R'], [1, 'A'], [2, 'Y'], [3, 'X']];
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const STICK_Y_AXES: readonly (readonly [axis: number, name: string])[] = [[1, 'left-stick'], [3, 'right-stick']];
const STICK_DEAD_ZONE = 0.5;

/** The part of a browser `Gamepad` this module reads. */
export interface PadSnapshot {
  readonly index: number;
  readonly mapping: string;
  readonly buttons: readonly { readonly pressed: boolean }[];
  readonly axes: readonly number[];
}

type Press = { readonly button: ControllerButton } | { readonly bend: number };

function pressesOf(pad: PadSnapshot): Map<string, Press> {
  const presses = new Map<string, Press>();
  const source = (kind: string, name: string) => `pad:${pad.index}:${kind}:${name}`;
  if (pad.buttons[DPAD_UP]?.pressed) presses.set(source('bend', 'dpad-up'), { bend: 1 });
  if (pad.buttons[DPAD_DOWN]?.pressed) presses.set(source('bend', 'dpad-down'), { bend: -1 });
  for (const [axis, name] of STICK_Y_AXES) {
    const tilt = pad.axes[axis] ?? 0;
    if (tilt <= -STICK_DEAD_ZONE) presses.set(source('bend', `${name}-up`), { bend: 2 });
    if (tilt >= STICK_DEAD_ZONE) presses.set(source('bend', `${name}-down`), { bend: -2 });
  }
  for (const [index, button] of NOTE_BUTTONS) {
    if (pad.buttons[index]?.pressed) presses.set(source('note', button), { button });
  }
  return presses;
}

/** Feeds polled gamepad state into the shared controls; every pad control is its own input source. */
export class GamepadInput {
  private held = new Map<string, Press>();

  constructor(private readonly controls: Pick<Controls, 'noteDown' | 'noteUp' | 'bendDown' | 'bendUp'>) {}

  /** Apply one poll and report whether a pad with the standard layout is connected. */
  update(pads: readonly (PadSnapshot | null)[]): boolean {
    const usable = pads.filter((pad): pad is PadSnapshot => pad?.mapping === 'standard');
    const pressed = new Map(usable.flatMap(pad => [...pressesOf(pad)]));
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
