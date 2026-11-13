import assert from 'node:assert/strict';
import test from 'node:test';
import toneMidi from '@tonejs/midi';
import { DEMOS } from './catalogue-loader';
import { CATALOGUE_INDEX } from '../src/core/songs/catalogue-index';
import { catalogueTrack } from './catalogue-loader';
import { pitchById } from '../src/core/pitches';
import { prepareMelody } from '../src/core/prepare';
import { projectFaithfully, selectPhrase } from './catalogue-tools';

const { Midi } = toneMidi as unknown as { Midi: typeof import('@tonejs/midi').Midi };

test('phrase selection retains timing across a tempo change and a later rest', () => {
  const midi = new Midi();
  midi.header.fromJSON({ name: '', ppq: 480, tempos: [{ ticks: 0, bpm: 120 }, { ticks: 960, bpm: 60 }], timeSignatures: [], keySignatures: [], meta: [] });
  const track = midi.addTrack();
  track.addNote({ midi: 60, ticks: 720, durationTicks: 720 });
  track.addNote({ midi: 67, ticks: 1680, durationTicks: 240 });
  const result = selectPhrase(midi, 0, [0, 1]);
  assert.equal(result.sourceStartSeconds, 0.75);
  assert.deepEqual(result.melody, [
    { midi: 60, startBeat: 0, durationBeats: 2.5 },
    { midi: 67, startBeat: 3.5, durationBeats: 1 },
  ]);
  track.addNote({ midi: 64, ticks: 1200, durationTicks: 480 });
  assert.throws(() => selectPhrase(midi, 0, [0, 1, 2]), RangeError);
});

test('faithful projection accepts the full range and rejects wider phrases including octave-equivalent pitches', () => {
  const melody = [60, 76, 72, 60].map((midi, index) => ({ midi, startBeat: index * 0.3, durationBeats: 0.2 }));
  const result = projectFaithfully(melody);
  assert.ok(result);
  const actual = result.notes.map(note => pitchById(note.pitch).midi + 12 + (note.bend ?? 0));
  assert.deepEqual(actual, [72, 88, 84, 72]);
  assert.deepEqual(result.notes.map(note => [note.startBeat, note.durationBeats]), melody.map(note => [note.startBeat, note.durationBeats]));
  for (const last of [77, 84]) {
    assert.equal(projectFaithfully([{ midi: 60, startBeat: 0, durationBeats: 1 }, { midi: last, startBeat: 1, durationBeats: 1 }]), null);
  }
});

test('delivered catalogue plays the exact source events with a single shift even when simplification is enabled', () => {
  for (const source of CATALOGUE_INDEX.map(song => catalogueTrack(song.id))) {
    const demo = DEMOS.find(item => item.id === source.id);
    assert.ok(demo, source.id);
    const prepared = prepareMelody(demo, { simplify: true, maxBend: 0 });
    assert.equal(prepared.notes.length, source.melody.length);
    const shift = pitchById(prepared.notes[0]!.pitch).midi + 12 + (prepared.notes[0]!.bend ?? 0) - source.melody[0]!.midi;
    for (const [index, note] of prepared.notes.entries()) {
      assert.equal(pitchById(note.pitch).midi + 12 + (note.bend ?? 0), source.melody[index]!.midi + shift);
      assert.equal(note.startBeat * 60 / demo.tempoBpm, source.melody[index]!.startBeat * 60 / source.tempoBpm);
      assert.equal(note.durationBeats * 60 / demo.tempoBpm, source.melody[index]!.durationBeats * 60 / source.tempoBpm);
    }
  }
});
