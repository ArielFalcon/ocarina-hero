import type { Note } from './ir';
import { pitchById, type ControllerButton, type PitchId } from './pitches';

export interface TabToken {
  readonly noteIndex: number;
  readonly button: ControllerButton;
  readonly pitch: PitchId;
  readonly bend: number;
  readonly beats: number;
}

export interface TabBar {
  readonly index: number;
  readonly tokens: readonly TabToken[];
}

/**
 * Renders notes as button bars.
 *
 * Empty bars are kept so rests stay visible and the tab keeps its timeline.
 * Notes are copied before sorting, so the caller's arrangement is untouched.
 */
export function toTabBars(notes: readonly Note[], beatsPerBar = 4): TabBar[] {
  if (!Number.isInteger(beatsPerBar) || beatsPerBar <= 0) {
    throw new RangeError(`Invalid beats per bar: ${beatsPerBar}`);
  }

  const sorted = notes.map((note, noteIndex) => ({ note, noteIndex }))
    .sort((a, b) => a.note.startBeat - b.note.startBeat);
  const bars = new Map<number, TabToken[]>();
  let lastIndex = 0;

  for (const { note, noteIndex } of sorted) {
    const index = Math.floor(note.startBeat / beatsPerBar);
    lastIndex = Math.max(lastIndex, index);

    const tokens = bars.get(index) ?? [];
    tokens.push({
      noteIndex,
      button: pitchById(note.pitch).button,
      pitch: note.pitch,
      bend: note.bend ?? 0,
      beats: note.durationBeats,
    });
    bars.set(index, tokens);
  }

  const result: TabBar[] = [];
  for (let index = 0; index <= lastIndex; index += 1) {
    result.push({ index, tokens: bars.get(index) ?? [] });
  }
  return result;
}

/** Group existing tokens by the original indices supplied by the source. */
export function toTabPhrases(notes: readonly Note[], starts: readonly number[]): TabBar[] {
  const tokens = toTabBars(notes).flatMap((bar) => bar.tokens);
  return starts.map((start, index) => ({
    index,
    tokens: tokens.filter((token) => token.noteIndex >= start && token.noteIndex < (starts[index + 1] ?? notes.length)),
  }));
}

/** Split at rests of at least one beat AND 500 ms, using the source tempo. */
export function toTabRestGroups(notes: readonly Note[], tempoBpm: number): TabBar[] {
  if (!Number.isFinite(tempoBpm) || tempoBpm <= 0) throw new RangeError('Invalid source tempo');
  const tokens = toTabBars(notes).flatMap(bar => bar.tokens);
  const groups: { index: number; tokens: TabToken[] }[] = [];
  const minimumGap = Math.max(1, tempoBpm / 120);
  let soundingUntil = -Infinity;
  for (const token of tokens) {
    const note = notes[token.noteIndex]!;
    if (!groups.length || note.startBeat - soundingUntil >= minimumGap - 1e-9) {
      groups.push({ index: groups.length, tokens: [] });
    }
    groups.at(-1)!.tokens.push(token);
    soundingUntil = Math.max(soundingUntil, note.startBeat + note.durationBeats);
  }
  return groups;
}

/** Physical gesture for a nominal semitone bend; gesture numbers are not labels. */
export function modifierForBend(bend: number): { control: 'dpad' | 'stick'; direction: 'up' | 'down' } | null {
  if (bend === 0) return null;
  if (Math.abs(bend) !== 1 && Math.abs(bend) !== 2) throw new RangeError(`Unsupported tab bend: ${bend}`);
  return { control: Math.abs(bend) === 1 ? 'dpad' : 'stick', direction: bend > 0 ? 'up' : 'down' };
}

export function bendLabel(bend: number): string {
  const modifier = modifierForBend(bend);
  return modifier ? `${modifier.control === 'dpad' ? 'D-pad' : 'Stick'} ${modifier.direction}` : '';
}

export function noteInstruction(button: ControllerButton, bend = 0): string {
  const modifier = bendLabel(bend);
  return modifier ? `${button} + ${modifier}` : button;
}

/** Plain-text tab, useful for tests, exports and terminal checks. */
export function toTabText(notes: readonly Note[], beatsPerBar = 4, sourceTempoBpm?: number): string {
  const groups = sourceTempoBpm === undefined ? toTabBars(notes, beatsPerBar) : toTabRestGroups(notes, sourceTempoBpm);
  return groups
    .map((bar) =>
      bar.tokens.map((token) => noteInstruction(token.button, token.bend)).join(' '),
    )
    .join(' | ');
}
