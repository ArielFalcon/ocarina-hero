import { readFileSync, writeFileSync } from 'node:fs';
import { rateDifficulty } from '../src/core/difficulty';
import { prepareMelody } from '../src/core/prepare';
import { toTabRestGroups } from '../src/core/tab';
import { projectFaithfully } from './catalogue-tools';

/**
 * Re-projects every stored catalogue song from its stored melody after a projection or tuning
 * change, without the external media scripts/build-catalogue.ts needs. Rewrites `fixedNotes`,
 * `phraseStarts` and the index difficulty; melodies, titles and order stay as they are.
 */
const folder = 'src/core/songs/catalogue';
const indexFile = 'src/core/songs/catalogue-index.ts';
const source = readFileSync(indexFile, 'utf8');
const marker = '[] = ';
const start = source.indexOf(marker) + marker.length;
const index: { id: string; tempoBpm: number; difficulty: unknown }[] = JSON.parse(source.slice(start, source.lastIndexOf(';')));

let changed = 0;
for (const entry of index) {
  const file = `${folder}/${entry.id}.json`;
  const before = readFileSync(file, 'utf8');
  const song = JSON.parse(before);
  const projection = projectFaithfully(song.melody);
  if (!projection) throw new Error(`${entry.id} no longer projects faithfully`);
  const next = { melody: song.melody, fixedNotes: projection.notes, phraseStarts: toTabRestGroups(projection.notes, entry.tempoBpm).map(group => group.tokens[0]!.noteIndex) };
  const after = `${JSON.stringify(next)}\n`;
  if (after !== before) { writeFileSync(file, after); changed++; }
  entry.difficulty = rateDifficulty(prepareMelody(next, { simplify: false, maxBend: 2 }).notes, entry.tempoBpm);
}
writeFileSync(indexFile, `${source.slice(0, start)}${JSON.stringify(index, null, 2)};\n`);
console.log(`${changed} of ${index.length} songs re-projected`);
