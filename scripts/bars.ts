import { readFileSync } from 'node:fs';
import toneMidi from '@tonejs/midi';
import { extractMelody } from '../src/core/midi-import';

/** Prints a track's melody grouped by bar, to locate a section. */
const { Midi } = toneMidi as unknown as { Midi: typeof import('@tonejs/midi').Midi };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const file = process.argv[2];
const trackArg = process.argv[3];
const beatsPerBar = Number(process.argv[4] ?? 4);
if (!file) throw new Error('Usage: tsx scripts/bars.ts <mid> [track] [beatsPerBar]');

const midi = new Midi(readFileSync(file));
const extracted = extractMelody(midi, trackArg === undefined ? undefined : Number(trackArg));
if (!extracted) throw new Error('no melody');

const bars = new Map<number, string[]>();
for (const note of extracted.notes) {
  const bar = Math.floor(note.startBeat / beatsPerBar) + 1;
  const list = bars.get(bar) ?? [];
  const name = `${NAMES[((note.midi % 12) + 12) % 12]}${Math.floor(note.midi / 12) - 1}`;
  list.push(name);
  bars.set(bar, list);
}

const sorted = [...bars.keys()].sort((a, b) => a - b);
for (const bar of sorted.slice(0, 64)) {
  console.log(`${String(bar).padStart(3)} | ${(bars.get(bar) ?? []).join(' ')}`);
}
console.log(`bars ${sorted[0]}..${sorted[sorted.length - 1]}`);
