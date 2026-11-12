import type { Midi } from '@tonejs/midi';
import { BEND_LIMIT, pitchById } from '../src/core/pitches';
import { projectMelody, type MelodyNote, type Projection } from '../src/core/project';

export function selectPhrase(midi: Midi, trackIndex: number, indices: readonly number[]) {
  const track = midi.tracks[trackIndex];
  if (!track || indices.length === 0) throw new RangeError('Missing melody selection');
  const selected = indices.map(index => {
    const note = track.notes[index];
    if (!Number.isInteger(index) || !note) throw new RangeError(`Missing note ${index}`);
    return note;
  });
  const startTick = selected[0]!.ticks;
  const origin = midi.header.ticksToSeconds(startTick);
  const tempoBpm = midi.header.tempos.filter(tempo => tempo.ticks <= startTick).at(-1)?.bpm ?? 120;
  const secondsPerBeat = 60 / tempoBpm;
  const melody: MelodyNote[] = selected.map(note => ({
    midi: note.midi,
    startBeat: (midi.header.ticksToSeconds(note.ticks) - origin) / secondsPerBeat,
    durationBeats: (midi.header.ticksToSeconds(note.ticks + note.durationTicks)
      - midi.header.ticksToSeconds(note.ticks)) / secondsPerBeat,
  }));
  for (let index = 0; index < melody.length; index++) {
    const note = melody[index]!;
    const previous = melody[index - 1];
    if (note.durationBeats <= 0 || (previous && note.startBeat + 1e-9 < previous.startBeat + previous.durationBeats)) {
      throw new RangeError('The selected voice is not a sequence of non-overlapping notes');
    }
  }
  return {
    melody, tempoBpm, startTick,
    endTick: Math.max(...selected.map(note => note.ticks + note.durationTicks)),
    sourceStartSeconds: origin,
  };
}

export function projectFaithfully(melody: readonly MelodyNote[]): Projection | null {
  if (melody.length === 0) return null;
  const projection = projectMelody(melody, { maxBend: BEND_LIMIT });
  const exact = projection.notes.every((note, index) =>
    pitchById(note.pitch).midi + 12 + (note.bend ?? 0)
      === melody[index]!.midi + projection.transpositionSemitones,
  );
  return exact ? projection : null;
}
