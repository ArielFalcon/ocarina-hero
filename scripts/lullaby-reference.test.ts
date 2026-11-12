import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { prepareMelody } from '../src/core/prepare';
import type { Note } from '../src/core/ir';

test('fixed notes retain authored pitch, bend, durations and rests despite adaptation options', () => {
  const fixedNotes: readonly Note[] = [
    { pitch: 'B4', bend: 0, startBeat: 0.1, durationBeats: 0.2 },
    { pitch: 'F4', bend: 2, startBeat: 0.5, durationBeats: 0.15 },
    { pitch: 'D5', bend: 0, startBeat: 1.8, durationBeats: 0.6 },
  ];
  const melody = [
    { midi: 71, startBeat: 0.1, durationBeats: 0.2 },
    { midi: 67, startBeat: 0.5, durationBeats: 0.15 },
    { midi: 74, startBeat: 1.8, durationBeats: 0.6 },
  ];
  const result = prepareMelody({ melody, fixedNotes }, { simplify: true, maxBend: 0 });
  deepStrictEqual(result.notes, fixedNotes);
  strictEqual(result.removed, 0);
  strictEqual(result.projection, undefined);
});
