import { test } from 'node:test';
import { deepStrictEqual, ok } from 'node:assert';
import { DEMOS } from './catalogue-loader';
import { pitchById } from '../src/core/pitches';

const sounding = (notes: NonNullable<(typeof DEMOS)[number]['fixedNotes']>) => notes.map(n => pitchById(n.pitch).midi + 12 + (n.bend ?? 0));

test('the lullaby entry holds the complete first theme period, one uniform shift above the Ocarina of Time score', () => {
  const demo = DEMOS.find(d => d.id === 'lullaby-trigger');
  ok(demo?.fixedNotes);
  const source = [71,74,69,67,69,71,74,69,71,74,81,79,74,72,71,69];
  const played = sounding(demo.fixedNotes);
  deepStrictEqual(played, [76,79,74,72,74,76,79,74,76,79,86,84,79,77,76,74]);
  deepStrictEqual(played.map((midi, i) => midi - source[i]!), source.map(() => 5));
  deepStrictEqual(demo.fixedNotes.map(n => n.startBeat), [0,2,3,5,5.5,6,8,9,12,14,15,17,18,20,20.5,21]);
  deepStrictEqual(demo.melody.map(n => n.midi), played);
  deepStrictEqual(demo.phraseStarts, [0,3,8,11]);
  ok(demo.tempoBpm === 100 && !/trigger/i.test(`${demo.title} ${demo.subtitle}`));
  ok(!DEMOS.some(d => d.id === 'never'));
});

