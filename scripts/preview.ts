import { DEMOS } from '../src/core/demo';
import { prepareMelody } from '../src/core/prepare';
import { toTabText } from '../src/core/tab';

for (const demo of DEMOS) {
  const prepared = prepareMelody(demo, { simplify: false, maxBend: 2 });
  const projection = prepared.projection;

  console.log(`\n${demo.title}`);
  console.log(`  tab        ${toTabText(prepared.notes)}`);
  console.log(
    `  notes      ${demo.melody.length} -> ${prepared.notes.length} (${prepared.removed} ornaments removed)`,
  );
  if (!projection) {
    console.log(`  status     ${demo.subtitle}`);
    continue;
  }
  console.log(`  confidence ${(projection.confidence * 100).toFixed(0)}%`);
  console.log(
    `  moved      ${projection.shiftedNotes}/${projection.notes.length} · bent ${projection.bentNotes}`,
  );
}
