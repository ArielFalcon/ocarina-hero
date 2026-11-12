import { mkdirSync, writeFileSync } from 'node:fs';
import toneMidi from '@tonejs/midi';
import { extractMelody } from '../src/core/midi-import';
import { projectMelody } from '../src/core/project';
import { toTabText } from '../src/core/tab';

// @tonejs/midi ships a CommonJS main and an ESM module field. Node picks the
// CommonJS build, so the named export has to come off the default import.
const { Midi } = toneMidi as unknown as { Midi: typeof import('@tonejs/midi').Midi };

/**
 * End-to-end smoke check without a browser: builds a MIDI with a lead, a bass
 * and a drum track, writes it to out/smoke.mid, reads it back and prints the
 * tab. The written file is also useful to test the upload path by hand.
 */
const ODE = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62];
const BASS = [40, 40, 41, 43, 43, 41, 40, 38, 36, 36, 38, 40, 40, 38, 38];

const midi = new Midi();

const lead = midi.addTrack();
lead.name = 'Lead';
lead.channel = 0;
ODE.forEach((value, index) => {
  lead.addNote({ midi: value, time: index * 0.5, duration: 0.45 });
});

const bass = midi.addTrack();
bass.name = 'Bass';
bass.channel = 1;
BASS.forEach((value, index) => {
  bass.addNote({ midi: value, time: index * 0.5, duration: 0.45 });
});

const drums = midi.addTrack();
drums.name = 'Drums';
drums.channel = 9;
for (let index = 0; index < 15; index += 1) {
  drums.addNote({ midi: index % 2 === 0 ? 36 : 38, time: index * 0.5, duration: 0.1 });
}

mkdirSync('out', { recursive: true });
const bytes = midi.toArray();
writeFileSync('out/smoke.mid', Buffer.from(bytes));

const reread = new Midi(bytes);
console.log(
  'tracks:',
  reread.tracks.map((track) => `${track.name || '(unnamed)'} ch${track.channel} ${track.notes.length}n`),
);

const extracted = extractMelody(reread);
if (!extracted) {
  console.log('FAIL: no melody track extracted');
  process.exit(1);
}

console.log(
  `picked: ${extracted.trackName} (track ${extracted.trackIndex + 1}/${extracted.trackCount})`,
);

const projection = projectMelody(extracted.notes);
console.log('tab:', toTabText(projection.notes));
console.log('confidence:', `${(projection.confidence * 100).toFixed(0)}%`);
console.log('wrote out/smoke.mid');
