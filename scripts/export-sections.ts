import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import toneMidi from '@tonejs/midi';
import { extractMelody } from '../src/core/midi-import';

/**
 * Cuts a bar range out of a MIDI track and writes it as a demo song.
 *
 * Used to turn full arrangements into the section the song is known for:
 * the chorus of a pop track, or the opening phrase of a theme.
 */
const { Midi } = toneMidi as unknown as { Midi: typeof import('@tonejs/midi').Midi };

const SECTIONS = [
  {
    id: 'never',
    title: 'Never Gonna Give You Up',
    file: 'out/never.mid',
    track: 3,
    beatsPerBar: 4,
    fromBar: 68,
    toBar: 80,
    minMidi: 0,
  },
  {
    id: 'littleroot',
    title: 'Littleroot Town',
    file: 'out/littleroot.mid',
    track: 0,
    beatsPerBar: 3,
    fromBar: 1,
    toBar: 16,
    minMidi: 60,
  },
  {
    id: 'axel',
    title: 'Axel F',
    file: 'out/axel3.mid',
    track: 0,
    beatsPerBar: 4,
    fromBar: 1,
    toBar: 16,
    minMidi: 0,
  },
] as const;

mkdirSync('src/core/songs', { recursive: true });

for (const section of SECTIONS) {
  const midi = new Midi(readFileSync(section.file));
  const extracted = extractMelody(midi, section.track);
  if (!extracted) {
    console.log(`${section.id}: no melody`);
    continue;
  }

  const startBeat = (section.fromBar - 1) * section.beatsPerBar;
  const endBeat = section.toBar * section.beatsPerBar;

  const notes = extracted.notes
    .filter(
      (note) =>
        note.startBeat >= startBeat && note.startBeat < endBeat && note.midi >= section.minMidi,
    )
    .map((note) => ({
      midi: note.midi,
      startBeat: Number((note.startBeat - startBeat).toFixed(3)),
      durationBeats: Number(note.durationBeats.toFixed(3)),
    }));

  const payload = {
    title: section.title,
    tempoBpm: midi.header.tempos[0]?.bpm ?? 120,
    beatsPerBar: section.beatsPerBar,
    notes,
  };

  writeFileSync(
    `src/core/songs/${section.id}.json`,
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  console.log(`${section.id}: ${notes.length} notes at ${payload.tempoBpm.toFixed(0)} bpm`);
}
