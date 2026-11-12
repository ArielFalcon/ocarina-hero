import { test } from 'node:test';
import { deepStrictEqual } from 'node:assert';
import { toTabBars, toTabPhrases, toTabRestGroups } from '../src/core/tab';

const notes = [
  { pitch: 'D5' as const, startBeat: 5, durationBeats: 1 },
  { pitch: 'D5' as const, startBeat: 0, durationBeats: 1 },
  { pitch: 'F4' as const, startBeat: 3, durationBeats: 1 },
];
test('original indices survive sorting and explicit phrase grouping', () => {
  deepStrictEqual(toTabBars(notes).flatMap(bar => bar.tokens.map(token => token.noteIndex)), [1, 2, 0]);
  deepStrictEqual(toTabPhrases(notes, [0, 2]).map(phrase => phrase.tokens.map(token => token.noteIndex)), [[1, 0], [2]]);
});

test('only rests meeting both one beat and half a second split a phrase', () => {
  const sequence = [
    { pitch: 'D5' as const, startBeat: 0, durationBeats: 1 },
    { pitch: 'F4' as const, startBeat: 1.999, durationBeats: 1 },
    { pitch: 'D5' as const, startBeat: 3.999, durationBeats: 1 },
    { pitch: 'F4' as const, startBeat: 6.499, durationBeats: 1 },
  ];
  deepStrictEqual(toTabRestGroups(sequence, 60).map(group => group.tokens.map(token => token.noteIndex)), [[0, 1], [2], [3]]);
  deepStrictEqual(toTabRestGroups(sequence, 180).map(group => group.tokens.map(token => token.noteIndex)), [[0, 1, 2], [3]]);
});

test('sustained sound prevents false breaks and chronological groups keep original indices', () => {
  const sequence = [
    { pitch: 'D5' as const, startBeat: 7, durationBeats: 1 },
    { pitch: 'D5' as const, startBeat: 0, durationBeats: 4 },
    { pitch: 'F4' as const, startBeat: 1, durationBeats: 1 },
    { pitch: 'F4' as const, startBeat: 4.5, durationBeats: 1 },
  ];
  deepStrictEqual(toTabRestGroups(sequence, 120).map(group => group.tokens.map(token => token.noteIndex)), [[1, 2, 3], [0]]);
  deepStrictEqual(toTabRestGroups([], 120), []);
});
