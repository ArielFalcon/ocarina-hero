import type { Arrangement, Note } from '../core/ir';
import { pitchById, type ControllerButton, type PitchId } from '../core/pitches';
import { toTabPhrases, toTabRestGroups } from '../core/tab';

/** Divide source groups into display windows without changing the arrangement. */
export function createPassages(
  notes: readonly Note[],
  tempoBpm: number,
  phraseStarts?: readonly number[],
  maxNotes = 5,
): number[][] {
  if (!Number.isInteger(maxNotes) || maxNotes <= 0) {
    throw new RangeError(`Invalid maximum notes: ${maxNotes}`);
  }
  if (!notes.length) return [];

  const starts = phraseStarts?.length
    ? [...new Set([0, ...phraseStarts])].filter(start => Number.isInteger(start) && start >= 0 && start < notes.length).sort((a, b) => a - b)
    : undefined;
  const groups = starts ? toTabPhrases(notes, starts) : toTabRestGroups(notes, tempoBpm);
  const passages: number[][] = [];
  for (const group of groups) {
    for (let offset = 0; offset < group.tokens.length; offset += maxNotes) {
      passages.push(group.tokens.slice(offset, offset + maxNotes).map(token => token.noteIndex));
    }
  }
  return passages;
}

/** Advance at most one note when the complete controller gesture matches. */
export function advancePractice(notes: readonly Note[], cursor: number, button: ControllerButton, bend: number): number {
  const expected = notes[cursor];
  return expected && pitchById(expected.pitch).button === button && (expected.bend ?? 0) === bend
    ? cursor + 1
    : cursor;
}

/** What a lesson states under its title, apart from the player's progress. */
export function lessonDetails(version: string | undefined, noteCount: number, passageCount: number): string[] {
  return [version, `${noteCount} notes`, `${passageCount} ${passageCount === 1 ? 'passage' : 'passages'}`].filter((part): part is string => !!part);
}

/** Passage a reset goes back to: a practice run starts over from the first one, unless a single passage is being repeated. */
export function resetPassage(current: number, mode: { practice: boolean; repeating: boolean }): number {
  return mode.practice && !mode.repeating ? 0 : current;
}

export const FREE_PLAY_TEMPO_BPM = 96;
/** A tap still sounds on replay. */
const MIN_TAKE_BEATS = 0.125;
/** A pause to think is not rhythm: longer silences replay at this length. */
const MAX_TAKE_REST_BEATS = 4;

/** Record free play with its performed timing, measured in beats at a fixed tempo. */
export class FreePlayTake {
  private held: { note: Note; atMs: number } | null = null;
  private last: { note: Note; endMs: number } | null = null;

  constructor(private readonly notes: Note[], private readonly tempoBpm = FREE_PLAY_TEMPO_BPM) {}

  press(pitch: PitchId, bend: number, atMs: number): void {
    this.release(atMs);
    const previous = this.notes.at(-1);
    const rest = previous && previous === this.last?.note ? Math.min(MAX_TAKE_REST_BEATS, this.beats(atMs - this.last.endMs)) : 0;
    const note: Note = { pitch, bend, startBeat: previous ? previous.startBeat + previous.durationBeats + rest : 0, durationBeats: 1 };
    this.notes.push(note);
    this.held = { note, atMs };
  }

  /** One bend per note: a held note records its first bend, and letting that bend go starts an unbent note of the same pitch. */
  /** Returns whether the take changed. */
  bend(value: number, atMs: number): boolean {
    const held = this.held;
    if (!held || this.notes.at(-1) !== held.note) return false;
    const recorded = held.note.bend ?? 0;
    if (value && !recorded) {
      const note = { ...held.note, bend: value };
      this.notes[this.notes.length - 1] = note;
      this.held = { ...held, note };
      return true;
    }
    if (!value && recorded) {
      this.press(held.note.pitch, 0, atMs);
      return true;
    }
    return false;
  }

  /** Close the sounding note; one release ends the sound, so it ends the note too. */
  release(atMs: number): void {
    const held = this.held;
    this.held = null;
    if (!held || this.notes.at(-1) !== held.note) return;
    const note = { ...held.note, durationBeats: Math.max(MIN_TAKE_BEATS, this.beats(atMs - held.atMs)) };
    this.notes[this.notes.length - 1] = note;
    this.last = { note, endMs: atMs };
  }

  /** Start over: drop every note, including one still held. */
  clear(): void {
    this.notes.length = 0;
    this.held = null;
    this.last = null;
  }

  private beats(ms: number): number {
    return Math.max(0, ms) * this.tempoBpm / 60000;
  }
}

/** Keep the timing within a passage while moving its first onset to beat zero. */
export function passageArrangement(arrangement: Arrangement, indices: readonly number[]): Arrangement {
  const selected = indices.map(index => arrangement.notes[index]!);
  const startBeat = selected[0]?.startBeat ?? 0;
  return {
    ...arrangement,
    notes: selected.map(note => ({ ...note, startBeat: note.startBeat - startBeat })),
  };
}

/** A passage is a display window; only explicit repeat limits playback to it. */
export function playbackSelection(arrangement: Arrangement, passage: readonly number[], cursor: number, repeat: boolean): { indices: number[]; arrangement: Arrangement } {
  const all = arrangement.notes.map((_, index) => index);
  const available = repeat && passage.length ? [...passage] : all;
  const offset = available.indexOf(cursor);
  const indices = offset >= 0 ? available.slice(offset) : available;
  return { indices, arrangement: !repeat && offset <= 0 ? arrangement : passageArrangement(arrangement, indices) };
}

export type StaffTransition = 'enter' | 'reflow' | 'forward' | 'backward';

/** Choose how the staff moves between two rendered windows of the same or another song. */
export function staffTransition(
  previous: { song: unknown; indices: readonly number[] } | null,
  next: { song: unknown; indices: readonly number[] },
): StaffTransition {
  if (!previous || previous.song !== next.song) return 'enter';
  const from = previous.indices[0] ?? 0;
  const to = next.indices[0] ?? 0;
  if (from === to) return 'reflow';
  return to > from ? 'forward' : 'backward';
}

export interface Combo { streak: number; best: number }
export interface ComboMilestone { streak: number; tier: number; label: string }

/** Consecutive-hit thresholds; each one raises the reward tier. */
const COMBO_TIERS = [
  { at: 5, label: 'Good' },
  { at: 10, label: 'Great' },
  { at: 20, label: 'Superb' },
  { at: 30, label: 'Brilliant' },
  { at: 50, label: 'Legendary' },
] as const;
const LEGENDARY_EVERY = 25;

/** Reward tier for a streak: 0 below the first threshold, then one per threshold reached. */
export function comboTier(streak: number): number {
  return COMBO_TIERS.filter(tier => streak >= tier.at).length;
}

/** Score one practice attempt; a milestone fires only on the hit that reaches a threshold. */
export function scoreCombo(combo: Combo, hit: boolean): { combo: Combo; milestone: ComboMilestone | null; broken: boolean } {
  if (!hit) return { combo: { streak: 0, best: combo.best }, milestone: null, broken: combo.streak > 0 };
  const streak = combo.streak + 1;
  const last = COMBO_TIERS[COMBO_TIERS.length - 1]!;
  const reached = COMBO_TIERS.find(tier => tier.at === streak)
    ?? (streak > last.at && (streak - last.at) % LEGENDARY_EVERY === 0 ? last : undefined);
  return {
    combo: { streak, best: Math.max(combo.best, streak) },
    milestone: reached ? { streak, tier: comboTier(streak), label: reached.label } : null,
    broken: false,
  };
}
