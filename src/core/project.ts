import { PITCHES, frequencyOf, type PitchId } from './pitches';
import type { Note } from './ir';

/** A monophonic melody in MIDI numbers, before projection. */
export interface MelodyNote {
  readonly midi: number;
  readonly startBeat: number;
  readonly durationBeats: number;
}

export interface ProjectionOptions {
  /** Semitones of bend the player is allowed to use, 0..2. */
  readonly maxBend?: number;
}

export interface Projection {
  readonly notes: Note[];
  /** Total shift applied to the source, in semitones. */
  readonly transpositionSemitones: number;
  /** 0..1 dynamic-programming fit score. */
  readonly confidence: number;
  /** Notes whose pitch class does not exist on the instrument. */
  readonly shiftedNotes: number;
  /** Notes that need a pitch bend. */
  readonly bentNotes: number;
}

interface State {
  readonly id: PitchId;
  readonly bend: number;
  /** Sounding MIDI number: the instrument plays one octave above its names. */
  readonly midi: number;
  readonly pc: number;
}

const EMISSION_WEIGHT = 1;
const TRANSITION_WEIGHT = 0.55;
const BEND_EMISSION = 0.004;
const BEND_TRANSITION = 0.02;

/** Middle of the instrument's sounding range (C5..E6 with bends). */
const INSTRUMENT_CENTER = 80;

function circularDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 12;
  return Math.min(distance, 12 - distance);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildStates(maxBend: number): State[] {
  const states: State[] = [];
  for (const pitch of PITCHES) {
    for (let bend = -maxBend; bend <= maxBend; bend += 1) {
      const nominal = pitch.midi + 12 + bend;
      states.push({
        id: pitch.id,
        bend,
        midi: 69 + 12 * Math.log2(frequencyOf(pitch.id, bend) / 440),
        pc: ((nominal % 12) + 12) % 12,
      });
    }
  }
  return states.sort((a, b) => a.midi - b.midi);
}

function projectAt(melody: readonly MelodyNote[], shift: number, states: readonly State[]) {
  const count = states.length;
  const shifted = melody.map((note) => note.midi + shift);
  const pitchClasses = shifted.map((midi) => ((midi % 12) + 12) % 12);

  const emission = shifted.map((midi, index) => {
    const pc = pitchClasses[index] ?? 0;
    const directlyPlayable = states.some((state) => Math.abs(midi - state.midi) <= 0.5);
    return states.map((state) => {
      if (directlyPlayable && Math.abs(midi - state.midi) > 0.5) return Number.POSITIVE_INFINITY;
      const pcCost = circularDistance(pc, ((state.midi % 12) + 12) % 12) / 6;
      const octaveCost = Math.min(Math.abs(midi - state.midi), 12) / 12;
      return (
        EMISSION_WEIGHT * (0.85 * pcCost + 0.15 * octaveCost) +
        BEND_EMISSION * Math.abs(state.bend)
      );
    });
  });

  const cost: number[][] = [];
  const back: number[][] = [];

  cost.push((emission[0] ?? states.map(() => 0)).slice());
  back.push(states.map(() => -1));

  for (let i = 1; i < melody.length; i += 1) {
    const sourceInterval = clamp((shifted[i] ?? 0) - (shifted[i - 1] ?? 0), -12, 12);
    const row: number[] = [];
    const links: number[] = [];

    for (let target = 0; target < count; target += 1) {
      const targetState = states[target];
      let best = Number.POSITIVE_INFINITY;
      let bestFrom = 0;

      for (let from = 0; from < count; from += 1) {
        const fromState = states[from];
        if (!targetState || !fromState) continue;

        const outputInterval = targetState.midi - fromState.midi;
        const transitionCost =
          (TRANSITION_WEIGHT * Math.abs(sourceInterval - outputInterval)) / 12 +
          BEND_TRANSITION * Math.abs(targetState.bend - fromState.bend);

        const total = (cost[i - 1]?.[from] ?? Number.POSITIVE_INFINITY) + transitionCost;
        if (total < best) {
          best = total;
          bestFrom = from;
        }
      }

      row.push(best + (emission[i]?.[target] ?? 0));
      links.push(bestFrom);
    }

    cost.push(row);
    back.push(links);
  }

  const lastRow = cost[melody.length - 1] ?? [];
  let state = 0;
  let bestCost = Number.POSITIVE_INFINITY;

  for (let index = 0; index < count; index += 1) {
    const value = lastRow[index] ?? Number.POSITIVE_INFINITY;
    if (value < bestCost) {
      bestCost = value;
      state = index;
    }
  }
  if (!Number.isFinite(bestCost)) bestCost = 0;

  const path: number[] = new Array(melody.length);
  for (let i = melody.length - 1; i >= 0; i -= 1) {
    path[i] = state;
    const previous = back[i]?.[state] ?? 0;
    state = i === 0 ? state : previous;
  }

  return { path, bestCost };
}

/** Projects a monophonic melody using calibrated sounding frequencies. */
export function projectMelody(
  melody: readonly MelodyNote[],
  options: ProjectionOptions = {},
): Projection {
  const maxBend = clamp(Math.round(options.maxBend ?? 2), 0, 2);

  if (melody.length === 0) {
    return {
      notes: [],
      transpositionSemitones: 0,
      confidence: 0,
      shiftedNotes: 0,
      bentNotes: 0,
    };
  }

  const states = buildStates(maxBend);
  const rawWeights = melody.map((note) =>
    Number.isFinite(note.durationBeats) && note.durationBeats > 0 ? note.durationBeats : 0,
  );
  const weights = rawWeights.some((weight) => weight > 0) ? rawWeights : melody.map(() => 1);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const tolerance = Number.EPSILON * totalWeight * (melody.length + 2);
  const sorted = melody.map((note, index) => ({ midi: note.midi, weight: weights[index] ?? 0 }))
    .sort((a, b) => a.midi - b.midi);
  let accumulated = 0;
  let median = sorted[0]?.midi ?? 0;
  for (const entry of sorted) {
    accumulated += entry.weight;
    if (accumulated + tolerance >= totalWeight / 2) {
      median = entry.midi;
      break;
    }
  }
  const octaveShift = 12 * Math.round((INSTRUMENT_CENTER - median) / 12);
  const choices = Array.from({ length: 36 }, (_, index) => {
    const shift = octaveShift + index - 18;
    const coverage = melody.reduce((sum, note, i) => sum + (
      states.some((state) => Math.abs(state.midi - note.midi - shift) <= 0.5)
        ? (weights[i] ?? 0) : 0
    ), 0);
    return { shift, coverage };
  });
  const maxCoverage = Math.max(...choices.map((choice) => choice.coverage));
  const eligible = choices.filter((choice) => maxCoverage - choice.coverage <= tolerance);
  eligible.sort((a, b) => Number(a.shift % 12 !== 0) - Number(b.shift % 12 !== 0)
    || Math.abs(a.shift) - Math.abs(b.shift) || a.shift - b.shift);
  const bestShift = eligible[0]!.shift;
  const best = projectAt(melody, bestShift, states);

  const notes: Note[] = melody.map((note, index) => {
    const state = states[best.path[index] ?? 0];
    return {
      pitch: state?.id ?? 'D4',
      bend: state?.bend ?? 0,
      startBeat: note.startBeat,
      durationBeats: note.durationBeats,
    };
  });

  let shiftedNotes = 0;
  let bentNotes = 0;

  for (let index = 0; index < melody.length; index += 1) {
    const state = states[best.path[index] ?? 0];
    if (!state) continue;
    const pc = ((((melody[index]?.midi ?? 0) + bestShift) % 12) + 12) % 12;
    if (circularDistance(pc, state.pc) > 0) shiftedNotes += 1;
    if (state.bend !== 0) bentNotes += 1;
  }

  const averageCost = best.bestCost / melody.length;
  const confidence = clamp(1 - averageCost / 0.9, 0, 1);

  return {
    notes,
    transpositionSemitones: bestShift,
    confidence,
    shiftedNotes,
    bentNotes,
  };
}
