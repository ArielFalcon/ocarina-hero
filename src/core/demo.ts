import type { MelodyNote } from './project';
import type { Note } from './ir';
import { BEND_LIMIT, PITCHES, pitchById } from './pitches';
import lullaby from './songs/lullaby-reference.json';
import littleroot from './songs/littleroot.json';
import videoDemos from './songs/from-videos.json';
import { CURATED_SONGS } from './songs/catalogue';

const LULLABY_TRIGGER: readonly Note[] = [0, 4.52].flatMap((offset) => [
  { pitch: 'B4', startBeat: offset, durationBeats: 1.17 },
  { pitch: 'D5', startBeat: offset + 1.45, durationBeats: 1.20 },
  { pitch: 'A4', startBeat: offset + 3.00, durationBeats: 1.24 },
] satisfies Note[]);

const lastTriggerNote = LULLABY_TRIGGER[LULLABY_TRIGGER.length - 1]!;
const LULLABY_AUTOMATIC_START = lastTriggerNote.startBeat + lastTriggerNote.durationBeats + 0.46;
const LULLABY_GAME: readonly Note[] = [
  ...LULLABY_TRIGGER,
  ...lullaby.notes.map(({ midi, startBeat, durationBeats }) => {
    const target = midi - 5;
    const pitch = [...PITCHES].sort((a, b) =>
      Math.abs(target - (a.midi + 12)) - Math.abs(target - (b.midi + 12)),
    )[0]!;
    const bend = target - (pitch.midi + 12);
    if (Math.abs(bend) > BEND_LIMIT) throw new RangeError('Lullaby pitch is outside the instrument range');
    return { pitch: pitch.id, bend, startBeat: LULLABY_AUTOMATIC_START + startBeat, durationBeats };
  }),
];

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

export const DEMOS: readonly DemoTrack[] = [
  ...CURATED_SONGS,
  {
    id: 'lullaby-game',
    title: 'Lullaby (complete, adapted)',
    subtitle: 'Y X A trigger twice · automatic melody transposed down 5 semitones',
    tempoBpm: 60,
    phraseStarts: [0, 3, 6, 9, 12],
    fixedNotes: LULLABY_GAME,
    melody: LULLABY_GAME.map(({ pitch, bend, startBeat, durationBeats }) => ({
      midi: pitchById(pitch).midi + 12 + (bend ?? 0), startBeat, durationBeats,
    })),
  },
  {
    id: 'lullaby-trigger',
    title: 'Lullaby (manual trigger)',
    subtitle: 'Y X A, repeated twice',
    tempoBpm: 60,
    phraseStarts: [0, 3],
    fixedNotes: LULLABY_TRIGGER,
    melody: LULLABY_TRIGGER.map(({ pitch, bend, startBeat, durationBeats }) => ({
      midi: pitchById(pitch).midi + 12 + (bend ?? 0), startBeat, durationBeats,
    })),
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
