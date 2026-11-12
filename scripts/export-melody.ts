import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import toneMidi from '@tonejs/midi';
import { extractMelody } from '../src/core/midi-import';

const { Midi } = toneMidi as unknown as { Midi: typeof import('@tonejs/midi').Midi };

const [source, trackArg, out] = process.argv.slice(2);
if (!source || !out) {
  throw new Error('Usage: tsx scripts/export-melody.ts <in.mid> <trackIndex> <out.json>');
}

const midi = new Midi(readFileSync(source));
const extracted = extractMelody(midi, trackArg === undefined ? undefined : Number(trackArg));
if (!extracted) throw new Error('No melodic track found');

const payload = {
  source: source.split('/').pop() ?? source,
  track: extracted.trackName,
  tempoBpm: midi.header.tempos[0]?.bpm ?? 120,
  notes: extracted.notes.map((note) => ({
    midi: note.midi,
    startBeat: Number(note.startBeat.toFixed(4)),
    durationBeats: Number(note.durationBeats.toFixed(4)),
  })),
};

mkdirSync('src/core/songs', { recursive: true });
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`wrote ${out}: ${payload.notes.length} notes at ${payload.tempoBpm} bpm`);
