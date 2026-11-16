import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareMelody } from '../src/core/prepare';
import { projectMelody } from '../src/core/project';
import { SWITCH2_TUNING, THREEDS_TUNING, frequencyOf, type TuningProfile } from '../src/core/pitches';

const melody = (midis: number[]) => midis.map((midi, i) => ({ midi, startBeat: i, durationBeats: 1 }));
const fingering = (midis: number[], tuning?: TuningProfile) =>
  projectMelody(melody(midis), { maxBend: 2, tuning }).notes.map(note => `${note.pitch}${note.bend ?? 0}`);

/** Summed cents between each source interval and the interval the fingering sounds on a console. */
function intervalError(midis: number[], notes: string[], tuning: TuningProfile): number {
  const hz = notes.map(note => frequencyOf(note.slice(0, 2) as 'D4', Number(note.slice(2)), tuning));
  return hz.slice(1).reduce((sum, value, i) => sum + Math.abs((midis[i + 1]! - midis[i]!) * 100 - 1200 * Math.log2(value / hz[i]!)), 0);
}

test('on the Switch 2 a fingering that keeps the interval in tune beats one that saves a bend gesture', () => {
  // E to D: R + D-pad down then L sounds 17 cents off; L + stick up then L, 4 cents.
  assert.deepEqual(fingering([76, 74]), ['D42', 'D40']);
  assert.ok(intervalError([76, 74], ['D42', 'D40'], SWITCH2_TUNING) < intervalError([76, 74], ['F4-1', 'D40'], SWITCH2_TUNING) - 10);
});

test('each console gets the fingering that sounds most faithful on that console', () => {
  // The last note, a G, is R + stick up on the Switch 2 and A + stick down on the 3DS.
  const source = [82, 85, 79];
  const switch2 = fingering(source, SWITCH2_TUNING);
  const threeDs = fingering(source, THREEDS_TUNING);
  assert.notDeepEqual(switch2, threeDs);
  assert.ok(intervalError(source, switch2, SWITCH2_TUNING) + 5 < intervalError(source, threeDs, SWITCH2_TUNING));
  assert.ok(intervalError(source, threeDs, THREEDS_TUNING) + 5 < intervalError(source, switch2, THREEDS_TUNING));
  assert.deepEqual(fingering(source), switch2, 'the Switch 2 is the default console');
});

test('a stored arrangement takes each console\'s fingering only while every sounding pitch and timing stays', () => {
  const source = melody([82, 85, 79]);
  const stored = projectMelody(source, { maxBend: 2 }).notes;
  const named = (notes: readonly { pitch: string; bend?: number }[]) => notes.map(note => `${note.pitch}${note.bend ?? 0}`);
  assert.deepEqual(prepareMelody({ melody: source, fixedNotes: stored }, { simplify: false, maxBend: 2 }).notes, stored);
  const threeDs = prepareMelody({ melody: source, fixedNotes: stored }, { simplify: false, maxBend: 2, tuning: THREEDS_TUNING }).notes;
  assert.deepEqual(named(threeDs), fingering([82, 85, 79], THREEDS_TUNING));
  assert.deepEqual(threeDs.map(note => [note.startBeat, note.durationBeats]), stored.map(note => [note.startBeat, note.durationBeats]));
  // A hand-made arrangement whose pitches differ from the melody's projection keeps its notes.
  const curated = stored.map((note, i) => (i === 2 ? { ...note, pitch: 'D5' as const, bend: -2 } : note));
  assert.deepEqual(prepareMelody({ melody: source, fixedNotes: curated }, { simplify: false, maxBend: 2, tuning: THREEDS_TUNING }).notes, curated);
});
