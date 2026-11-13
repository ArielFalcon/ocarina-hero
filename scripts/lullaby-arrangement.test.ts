import { test } from 'node:test';
import { deepStrictEqual, ok } from 'node:assert';
import { DEMOS } from './catalogue-loader';
import { pitchById } from '../src/core/pitches';
import { prepareMelody } from '../src/core/prepare';

const sounding = (notes: NonNullable<(typeof DEMOS)[number]['fixedNotes']>) => notes.map(n => pitchById(n.pitch).midi + 12 + (n.bend ?? 0));

test('complete arrangement keeps the manual trigger before the uniformly transposed automatic melody', () => {
  const demo = DEMOS.find(d => d.id === 'lullaby-game')!;
  const result = prepareMelody(demo, { simplify: true, maxBend: 0 });
  deepStrictEqual(sounding(result.notes), [83,86,81,83,86,81,78,81,76,78,81,76,78,81,88,86,81]);
  deepStrictEqual(result.notes.slice(0, 6), DEMOS.find(d => d.id === 'lullaby-trigger')!.fixedNotes);
  deepStrictEqual(demo.phraseStarts, [0,3,6,9,12]);
});

test('manual trigger remains unbent and independent of the complete arrangement', () => {
  const demo = DEMOS.find(d => d.id === 'lullaby-trigger');
  ok(demo?.fixedNotes);
  deepStrictEqual(demo.fixedNotes.map(n => [pitchById(n.pitch).button, n.bend ?? 0]), [['Y',0],['X',0],['A',0],['Y',0],['X',0],['A',0]]);
  deepStrictEqual(demo.phraseStarts, [0,3]);
  ok(!DEMOS.some(d => d.id === 'never'));
});

test('prepared arrangements release before measured phrase and manual gaps', () => {
  const full = DEMOS.find(d => d.id === 'lullaby-game')!;
  const trigger = DEMOS.find(d => d.id === 'lullaby-trigger')!;
  const automatic = prepareMelody(full, { simplify: true, maxBend: 0 }).notes.slice(6);
  const manual = prepareMelody(trigger, { simplify: true, maxBend: 0 }).notes;
  const start = automatic[0]!.startBeat;
  ok(Math.abs(start - 9.22) < 0.001);
  deepStrictEqual(automatic.map(n => n.durationBeats), [0.9,0.4,0.88,0.95,0.4,1.02,0.85,0.45,0.75,0.45,1.6]);
  ok(automatic[2]!.startBeat + automatic[2]!.durationBeats - start <= 2.23);
  ok(automatic[3]!.startBeat - start >= 2.55);
  ok(automatic[5]!.startBeat + automatic[5]!.durationBeats - start <= 5.02);
  ok(automatic[6]!.startBeat - start >= 5.15);
  ok(manual[0]!.startBeat + manual[0]!.durationBeats <= 1.22);
  ok(manual[1]!.startBeat >= 1.40);
});
