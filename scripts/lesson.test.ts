import assert from 'node:assert/strict';
import test from 'node:test';
import type { Note } from '../src/core/ir';
import { advancePractice, createPassages, passageArrangement, playbackSelection, staffTransition } from '../src/ui/lesson';

const notes: Note[] = [0, 1, 2, 3, 4, 5, 9, 10].map((startBeat, index) => ({
  pitch: index === 2 ? 'F4' : 'D4', startBeat, durationBeats: 1,
}));

test('playback continues across display passages unless repeat is explicitly enabled', () => {
  const arrangement = { title: 'Continuous', tempoBpm: 90, notes };
  const continuous = playbackSelection(arrangement, [0, 1, 2], 1, false);
  assert.deepEqual(continuous.indices, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(continuous.arrangement.notes[5]!.startBeat, 8);
  assert.deepEqual(playbackSelection(arrangement, [3, 4, 5], 4, true).indices, [4, 5]);
  assert.deepEqual(playbackSelection(arrangement, [3, 4, 5], 8, true).indices, [3, 4, 5]);
  assert.equal(playbackSelection(arrangement, [0, 1, 2], 0, false).arrangement, arrangement);
});

test('passages preserve indices and split at explicit boundaries or rests before window limits', () => {
  assert.deepEqual(createPassages(notes, 120, [0, 4], 3), [[0, 1, 2], [3], [4, 5, 6], [7]]);
  assert.deepEqual(createPassages(notes, 120, undefined, 3), [[0, 1, 2], [3, 4, 5], [6, 7]]);
  assert.deepEqual(createPassages(notes, 120, [4], 5), [[0, 1, 2, 3], [4, 5, 6, 7]]);
  assert.deepEqual(createPassages([], 120), []);
  assert.throws(() => createPassages(notes, 120, undefined, 0), RangeError);
  assert.throws(() => createPassages(notes, 120, undefined, 1.5), RangeError);
});

test('practice advances only for the expected button and modifier and stops at the end', () => {
  const sequence: Note[] = [notes[0]!, { ...notes[2]!, bend: -1 }];
  assert.equal(advancePractice(sequence, 0, 'R', 0), 0);
  assert.equal(advancePractice(sequence, 0, 'L', 1), 0);
  assert.equal(advancePractice(sequence, 0, 'L', 0), 1);
  assert.equal(advancePractice(sequence, 1, 'R', 0), 1);
  assert.equal(advancePractice(sequence, 1, 'R', -1), 2);
  assert.equal(advancePractice(sequence, 2, 'R', -1), 2);
});

test('passage playback rebases onsets without compressing rests or changing note data', () => {
  const arrangement = {
    title: 'Example', tempoBpm: 90,
    notes: [notes[0]!, { pitch: 'F4' as const, bend: 1, startBeat: 4, durationBeats: 2 },
      { pitch: 'D5' as const, startBeat: 8, durationBeats: 0.5 }],
  };
  assert.deepEqual(passageArrangement(arrangement, [1, 2]), {
    title: 'Example', tempoBpm: 90,
    notes: [{ pitch: 'F4', bend: 1, startBeat: 0, durationBeats: 2 },
      { pitch: 'D5', startBeat: 4, durationBeats: 0.5 }],
  });
  assert.deepEqual(passageArrangement(arrangement, []), { title: 'Example', tempoBpm: 90, notes: [] });
  assert.equal(arrangement.notes[1]!.startBeat, 4);
});

test('staff transitions follow the passage direction and only reflow a growing window', () => {
  const song = {};
  assert.equal(staffTransition(null, { song, indices: [0, 1] }), 'enter');
  assert.equal(staffTransition({ song: {}, indices: [0, 1] }, { song, indices: [0, 1] }), 'enter');
  assert.equal(staffTransition({ song, indices: [0, 1] }, { song, indices: [0, 1, 2] }), 'reflow');
  assert.equal(staffTransition({ song, indices: [0, 1] }, { song, indices: [2, 3] }), 'forward');
  assert.equal(staffTransition({ song, indices: [2, 3] }, { song, indices: [0, 1] }), 'backward');
});
