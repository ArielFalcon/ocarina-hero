import { INLINE_DEMOS, type DemoTrack, type SongData } from '../core/demo';
import { CATALOGUE_INDEX } from '../core/songs/catalogue-index';

const FILES = import.meta.glob<SongData>('../core/songs/catalogue/*.json', { eager: true, import: 'default' });

/** Every song with its notes, read at build time: the curated catalogue in index order, then the inline demos. */
export const SITE_SONGS: readonly DemoTrack[] = [
  ...CATALOGUE_INDEX.map(({ difficulty: _difficulty, ...summary }) => ({ ...summary, ...FILES[`../core/songs/catalogue/${summary.id}.json`]! })),
  ...INLINE_DEMOS,
];
