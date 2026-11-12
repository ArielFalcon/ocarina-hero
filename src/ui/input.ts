import type { ControllerButton } from '../core/pitches';

/** Shared ownership for keyboard, touch and pointer input. */
export class Controls {
  private owner: { source: string; button: ControllerButton } | null = null;
  private bends = new Map<string, number>();
  constructor(
    private onNote: (button: ControllerButton, bend: number) => void,
    private offNote: (button: ControllerButton) => void,
    private onBend: (value: number, glide: number) => void,
    private offVisual: (button: ControllerButton) => void = () => {},
  ) {}
  private get bend(): number {
    return [...this.bends.values()].at(-1) ?? 0;
  }
  noteDown(source: string, button: ControllerButton): void {
    if (this.owner?.source === source) return;
    if (this.owner) this.offVisual(this.owner.button);
    this.owner = { source, button };
    this.onNote(button, this.bend);
  }
  noteUp(source: string): void {
    if (this.owner?.source !== source) return;
    const { button } = this.owner;
    this.owner = null;
    this.offNote(button);
  }
  bendDown(source: string, value: number): void {
    if (this.bends.has(source)) return;
    const previous = this.bend;
    this.bends.set(source, value);
    if (previous !== value) this.onBend(value, Math.abs(value) === 2 ? 0.09 : 0);
  }
  bendUp(source: string): void {
    if (!this.bends.has(source)) return;
    const previous = this.bend;
    const released = this.bends.get(source)!;
    this.bends.delete(source);
    if (previous !== this.bend) this.onBend(this.bend, Math.abs(released) === 2 ? 0.09 : 0);
  }
  reset(): void {
    if (this.owner) this.noteUp(this.owner.source);
    const previous = this.bend;
    this.bends.clear();
    if (previous) this.onBend(0, 0);
  }
}

