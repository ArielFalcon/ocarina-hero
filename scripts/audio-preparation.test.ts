import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { prepareMelody } from '../src/core/prepare';
import { pitchById } from '../src/core/pitches';

test('timing-preserving sources retain short notes and rests through projection', () => {
  const melody = [
    { midi: 74, startBeat: 0.2, durationBeats: 0.08 },
    { midi: 76, startBeat: 0.29, durationBeats: 0.08 },
    { midi: 77, startBeat: 0.38, durationBeats: 0.8 },
    { midi: 79, startBeat: 1.6, durationBeats: 0.3 },
  ];
  const source = { melody, preserveTiming: true };
  const result = prepareMelody(source, { simplify: true, maxBend: 2 });
  strictEqual(result.removed, 0);
  strictEqual(result.notes.length, melody.length);
  deepStrictEqual(result.notes.map(({ startBeat, durationBeats }) => ({ startBeat, durationBeats })),
    melody.map(({ startBeat, durationBeats }) => ({ startBeat, durationBeats })));
});

test('unsimplified projection retains ascending short notes, repeated notes and rests', () => {
  const melody = [
    { midi: 74, startBeat: 0.2, durationBeats: 0.08 },
    { midi: 76, startBeat: 0.29, durationBeats: 0.08 },
    { midi: 77, startBeat: 0.38, durationBeats: 0.8 },
    { midi: 77, startBeat: 1.6, durationBeats: 0.3 },
  ];
  const result = prepareMelody({ melody }, { simplify: false, maxBend: 2 });
  const pitches = result.notes.map(note => pitchById(note.pitch).midi + 12 + (note.bend ?? 0));
  deepStrictEqual(pitches.slice(1).map((pitch, index) => pitch - pitches[index]!), [2, 1, 0]);
  deepStrictEqual(result.notes.map(({ startBeat, durationBeats }) => ({ startBeat, durationBeats })),
    melody.map(({ startBeat, durationBeats }) => ({ startBeat, durationBeats })));
  strictEqual(result.removed, 0);
  const simplified = prepareMelody({ melody }, { simplify: true, maxBend: 2 });
  strictEqual(simplified.removed, 2);
});
