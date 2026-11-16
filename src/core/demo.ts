import type { MelodyNote } from './project';
import type { Note } from './ir';
import lullabyComplete from './songs/zelda-lullaby-complete.json';
import littleroot from './songs/littleroot.json';
import videoDemos from './songs/from-videos.json';
import { CATALOGUE_INDEX } from './songs/catalogue-index';
import type { Difficulty } from './difficulty';

/** Explicit [midi, beats] pairs, laid out from a start beat. */
function seq(
  items: readonly (readonly [number, number])[],
  startBeat = 0,
): MelodyNote[] {
  let beat = startBeat;

  return items.map(([midi, durationBeats]) => {
    const note = { midi, startBeat: beat, durationBeats };
    beat += durationBeats;
    return note;
  });
}

const ODE_TO_JOY: readonly MelodyNote[] = seq([
  [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1],
  [60, 1], [60, 1], [62, 1], [64, 1], [64, 1], [62, 1], [62, 2],
]);

const HAPPY_BIRTHDAY: readonly MelodyNote[] = [
  ...seq([[67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2]]),
  ...seq([[67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2]], 6),
  ...seq(
    [[67, 0.75], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2]],
    12,
  ),
  ...seq([[77, 0.75], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 2]], 19),
];

const TWINKLE: readonly MelodyNote[] = [
  ...seq([[60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2]]),
  ...seq([[65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2]], 8),
  ...seq([[67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2]], 16),
  ...seq([[67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2]], 24),
  ...seq([[60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2]], 32),
  ...seq([[65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2]], 40),
];

export interface DemoTrack {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly tempoBpm: number;
  readonly beatsPerBar?: number;
  readonly melody: readonly MelodyNote[];
  readonly fixedNotes?: readonly Note[];
  readonly phraseStarts?: readonly number[];
}

/** The notes of a curated song, stored apart from its summary and loaded on demand. */
export type SongData = Required<Pick<DemoTrack, 'melody' | 'fixedNotes' | 'phraseStarts'>>;

/** A curated song as listed: everything but its notes, with the difficulty rated ahead of time. */
export interface TrackSummary {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly tempoBpm: number;
  readonly beatsPerBar?: number;
  readonly difficulty: Difficulty;
}

/** Demos defined in code; the curated catalogue lives in per-song files. */
export const INLINE_DEMOS: readonly DemoTrack[] = [
  {
    id: 'lullaby-trigger',
    title: 'Lullaby (Ocarina of Time theme)',
    subtitle: 'First theme period, bars 1-8 · transposed up 5 semitones',
    tempoBpm: lullabyComplete.tempoBpm,
    phraseStarts: lullabyComplete.phraseStarts,
    fixedNotes: lullabyComplete.fixedNotes as readonly Note[],
    melody: lullabyComplete.melody,
  },
  {
    id: 'ode',
    title: 'Ode to Joy',
    subtitle: 'Beethoven, arranged',
    tempoBpm: 100,
    melody: ODE_TO_JOY,
  },
  {
    id: 'birthday',
    title: 'Happy Birthday',
    subtitle: 'Public domain, arranged',
    tempoBpm: 108,
    melody: HAPPY_BIRTHDAY,
  },
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle',
    subtitle: 'Public domain, arranged',
    tempoBpm: 100,
    melody: TWINKLE,
  },
  // Only the verified capture is offered. The other three come from the same
  // extraction and their melodies do not hold up, so they stay out until they
  // are transcribed from the actual song instead of the gameplay audio.
  ...videoDemos
    .filter((demo) => demo.id === 'v1')
    .map((demo) => ({
      id: demo.id,
      title: demo.title,
      subtitle: 'From a gameplay capture',
      tempoBpm: demo.tempoBpm,
      melody: demo.notes,
    })),
  {
    id: 'littleroot',
    title: littleroot.title,
    subtitle: 'Opening, from MIDI',
    tempoBpm: littleroot.tempoBpm,
    beatsPerBar: littleroot.beatsPerBar,
    melody: littleroot.notes,
  },
];

/** Everything the Songbook lists, in display-source order: curated summaries, then inline demos with their notes. */
export const LISTING: readonly (DemoTrack | TrackSummary)[] = [...CATALOGUE_INDEX, ...INLINE_DEMOS];
