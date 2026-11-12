import { readFileSync } from 'node:fs';
import toneMidi from '@tonejs/midi';
import { extractMelody } from '../src/core/midi-import';
import { projectMelody } from '../src/core/project';
import { toTabText } from '../src/core/tab';

const { Midi } = toneMidi as unknown as { Midi: typeof import('@tonejs/midi').Midi };

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

const path = process.argv[2];
if (!path) throw new Error('Usage: tsx scripts/inspect.ts <file.mid> [trackIndex]');

const midi = new Midi(readFileSync(path));
const tempo = midi.header.tempos[0]?.bpm;

console.log(`tempo ${tempo ?? 120} bpm · ppq ${midi.header.ppq}`);
midi.tracks.forEach((track, index) => {
  console.log(
    `  [${index}] "${track.name || '(unnamed)'}" ch${track.channel} ${track.notes.length} notes`,
  );
});

const forced = process.argv[3] === undefined ? undefined : Number(process.argv[3]);
const extracted = extractMelody(midi, forced);

if (!extracted) {
  console.log('no melodic track found');
  process.exit(1);
}

console.log(
  `\npicked "${extracted.trackName}" (${extracted.trackIndex + 1}/${extracted.trackCount})`,
);
console.log(extracted.notes.map((note) => noteName(note.midi)).join(' '));
console.log(
  `beats ${extracted.notes[0]?.startBeat ?? 0}..${extracted.notes.at(-1)?.startBeat ?? 0}`,
);
console.log(
  extracted.notes
    .map((note) => `${noteName(note.midi)}@${note.startBeat.toFixed(2)}`)
    .join(' '),
);

const projection = projectMelody(extracted.notes, { maxBend: 2 });
console.log(`\ntab ${toTabText(projection.notes)}`);
console.log(
  `confidence ${(projection.confidence * 100).toFixed(0)}% · ${projection.notes.length} notes`,
);
