import assert from 'node:assert/strict';
import test from 'node:test';
import type { Note } from '../src/core/ir';
import { advancePractice, comboTier, FreePlayTake, createPassages, scoreCombo, passageArrangement, playbackSelection, resetPassage, staffTransition } from '../src/ui/lesson';

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

test('combo streak grows on hits, resets on a miss and keeps the best run', () => {
  let combo = { streak: 0, best: 0 };
  for (let hit = 0; hit < 3; hit++) combo = scoreCombo(combo, true).combo;
  assert.deepEqual(combo, { streak: 3, best: 3 });
  const missed = scoreCombo(combo, false);
  assert.deepEqual(missed.combo, { streak: 0, best: 3 });
  assert.equal(missed.broken, true);
  assert.equal(scoreCombo(missed.combo, false).broken, false);
  assert.deepEqual(scoreCombo(missed.combo, true).combo, { streak: 1, best: 3 });
});

test('combo milestones fire once when a tier threshold is reached', () => {
  const reach = (streak: number) => scoreCombo({ streak: streak - 1, best: 0 }, true).milestone;
  assert.equal(reach(4), null);
  assert.equal(reach(5)?.label, 'Good');
  assert.equal(reach(6), null);
  assert.equal(reach(10)?.label, 'Great');
  assert.equal(reach(50)?.label, 'Legendary');
  assert.equal(reach(75)?.label, 'Legendary');
  assert.equal(reach(76), null);
  assert.equal(scoreCombo({ streak: 4, best: 0 }, false).milestone, null);
});

test('combo tier rises at each threshold boundary', () => {
  assert.deepEqual([0, 4, 5, 9, 10, 19, 20, 29, 30, 49, 50, 200].map(comboTier), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('free play keeps the performed rhythm: held lengths, rests capped, overlaps closed', () => {
  const notes: Note[] = [];
  const take = new FreePlayTake(notes, 60); // one beat per second
  take.press('D4', 0, 1000);
  take.release(1500); // half a beat held
  take.press('F4', 1, 2500); // one-beat rest
  take.press('A4', 0, 4500); // pressed while F4 still sounds: F4 lasts two beats
  take.release(5000);
  take.press('D4', 0, 60000); // a long pause shrinks to the rest cap
  take.release(60010); // a tap keeps a minimum length
  assert.deepEqual(notes, [
    { pitch: 'D4', bend: 0, startBeat: 0, durationBeats: 0.5 },
    { pitch: 'F4', bend: 1, startBeat: 1.5, durationBeats: 2 },
    { pitch: 'A4', bend: 0, startBeat: 3.5, durationBeats: 0.5 },
    { pitch: 'D4', bend: 0, startBeat: 8, durationBeats: 0.125 },
  ]);
});

test('a free play release never edits notes it did not record', () => {
  const notes: Note[] = [];
  const take = new FreePlayTake(notes, 60);
  take.press('D4', 0, 0);
  notes.length = 0;
  notes.push({ pitch: 'F4', startBeat: 0, durationBeats: 3 });
  take.release(500);
  take.press('A4', 0, 1000);
  assert.deepEqual(notes, [{ pitch: 'F4', startBeat: 0, durationBeats: 3 }, { pitch: 'A4', bend: 0, startBeat: 3, durationBeats: 1 }]);
});

test('a held free play note keeps its first bend, and letting the bend go starts another note', () => {
  const notes: Note[] = [];
  const take = new FreePlayTake(notes, 60);
  take.bend(1, 0); // no note held: the next press already carries the bend
  take.press('D4', 0, 1000);
  take.bend(1, 1500); // first bend while held: the note records it
  take.bend(-1, 1700); // a second bend on the same note is not recorded
  take.bend(0, 2000); // letting go starts an unbent note of the same pitch
  take.bend(0, 2200); // no bend to let go of: nothing changes
  take.release(3000);
  take.bend(1, 3500); // nothing held
  take.press('F4', -1, 4000);
  take.bend(0, 4500);
  take.release(5000);
  assert.deepEqual(notes, [
    { pitch: 'D4', bend: 1, startBeat: 0, durationBeats: 1 },
    { pitch: 'D4', bend: 0, startBeat: 1, durationBeats: 1 },
    { pitch: 'F4', bend: -1, startBeat: 3, durationBeats: 0.5 },
    { pitch: 'F4', bend: 0, startBeat: 3.5, durationBeats: 0.5 },
  ]);
});

test('clearing a free play take empties it, even while a note is held, and the next note starts the melody', () => {
  const notes: Note[] = [];
  const take = new FreePlayTake(notes, 60);
  take.press('D4', 0, 0);
  take.release(1000);
  take.press('F4', 0, 2000); // still held when the take is cleared
  take.clear();
  assert.deepEqual(notes, []);
  take.release(2500);
  take.press('A4', 0, 3000);
  assert.deepEqual(notes, [{ pitch: 'A4', bend: 0, startBeat: 0, durationBeats: 1 }]);
});

test('reset restarts a practice run from the first passage, and otherwise the passage in view', () => {
  assert.equal(resetPassage(3, { practice: true, repeating: false }), 0);
  assert.equal(resetPassage(3, { practice: true, repeating: true }), 3);
  assert.equal(resetPassage(3, { practice: false, repeating: false }), 3);
});
