import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ensureExternalMedia } from './media-directory';

const media = ensureExternalMedia();
const corpus = join(media, 'corpus');
const delivery = join(media, 'catalogue', 'delivery');
const report: { id: string; status: string }[] = JSON.parse(readFileSync(join(delivery, 'report.json'), 'utf8'));
const entries = [];
for (const item of report) {
  const folder = join(corpus, 'original-clips', item.id);
  const provenanceFile = join(folder, 'provenance.json');
  if (item.status !== 'adapted' || !existsSync(join(folder, 'clip.wav')) || !existsSync(provenanceFile)) continue;
  const arrangementFile = join(delivery, item.id, 'arrangement.json');
  const arrangement = JSON.parse(readFileSync(arrangementFile, 'utf8'));
  const provenance = JSON.parse(readFileSync(provenanceFile, 'utf8'));
  const annotations = join(folder, 'annotations');
  mkdirSync(annotations, { recursive: true });
  const sourceAnnotation = join(annotations, 'source-selection.json');
  writeFileSync(sourceAnnotation, `${JSON.stringify({
    id: item.id, source: arrangement.source, selection: arrangement.selection,
    tempoBpm: arrangement.tempoBpm, melody: arrangement.melody,
    timeBase: 'Arrangement beats relative to first selected MIDI event, NOT original clip seconds.',
    alignmentValidated: false,
  }, null, 2)}\n`);
  const alignment = join(folder, 'alignment-candidate.json');
  entries.push({
    id: item.id, title: arrangement.title,
    clip: relative(media, join(folder, 'clip.wav')), provenance,
    sourceAnnotation: relative(media, sourceAnnotation),
    adaptedArrangement: relative(media, arrangementFile),
    alignmentCandidate: existsSync(alignment) ? relative(media, alignment) : null,
    status: 'clip-localized-unvalidated', trainingEligible: false,
    reason: 'Independent original pitch, onset and offset validation is still required.',
  });
}
mkdirSync(corpus, { recursive: true });
writeFileSync(join(corpus, 'index.json'), `${JSON.stringify({
  schemaVersion: 1,
  instrumentConfiguration: relative(media, join(delivery, 'instrument-config.json')),
  note: 'Original excerpts and source melody selections are distinct from adapted arrangements and synthesized previews. No entry is a validated extraction label.',
  entries,
}, null, 2)}\n`);
console.log(`${entries.length} original clips indexed; 0 validated extraction pairs.`);
