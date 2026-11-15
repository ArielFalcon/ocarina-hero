import { readFileSync } from 'node:fs';
import type { Midi } from '@tonejs/midi';
import { BEND_LIMIT, pitchById } from '../src/core/pitches';
import { projectMelody, type MelodyNote, type Projection } from '../src/core/project';

export function selectPhrase(midi: Midi, trackIndex: number, indices: readonly number[]) {
  const track = midi.tracks[trackIndex];
  if (!track || indices.length === 0) throw new RangeError('Missing melody selection');
  const selected = indices.map(index => {
    const note = track.notes[index];
    if (!Number.isInteger(index) || !note) throw new RangeError(`Missing note ${index}`);
    return note;
  });
  const startTick = selected[0]!.ticks;
  const origin = midi.header.ticksToSeconds(startTick);
  const tempoBpm = midi.header.tempos.filter(tempo => tempo.ticks <= startTick).at(-1)?.bpm ?? 120;
  const secondsPerBeat = 60 / tempoBpm;
  const melody: MelodyNote[] = selected.map(note => ({
    midi: note.midi,
    startBeat: (midi.header.ticksToSeconds(note.ticks) - origin) / secondsPerBeat,
    durationBeats: (midi.header.ticksToSeconds(note.ticks + note.durationTicks)
      - midi.header.ticksToSeconds(note.ticks)) / secondsPerBeat,
  }));
  for (let index = 0; index < melody.length; index++) {
    const note = melody[index]!;
    const previous = melody[index - 1];
    if (note.durationBeats <= 0 || (previous && note.startBeat + 1e-9 < previous.startBeat + previous.durationBeats)) {
      throw new RangeError('The selected voice is not a sequence of non-overlapping notes');
    }
  }
  return {
    melody, tempoBpm, startTick,
    endTick: Math.max(...selected.map(note => note.ticks + note.durationTicks)),
    sourceStartSeconds: origin,
  };
}

export function projectFaithfully(melody: readonly MelodyNote[]): Projection | null {
  if (melody.length === 0) return null;
  const projection = projectMelody(melody, { maxBend: BEND_LIMIT });
  const exact = projection.notes.every((note, index) =>
    pitchById(note.pitch).midi + 12 + (note.bend ?? 0)
      === melody[index]!.midi + projection.transpositionSemitones,
  );
  return exact ? projection : null;
}

/** Every catalogue manifest, in load order. A new manifest must be registered here or the build ignores it. */
export const CATALOGUE_MANIFESTS = [
  'catalogue-manifest.json',
  'catalogue-next-manifest.json',
  'catalogue-2026-manifest.json',
  'catalogue-pop-culture-manifest.json',
  'catalogue-2026-11-13-manifest.json',
  'catalogue-2026-11-13b-manifest.json',
  'catalogue-2026-11-13c-manifest.json',
  'catalogue-2026-11-13d-manifest.json',
  'catalogue-2026-11-13e-manifest.json',
  'catalogue-2026-11-13f-manifest.json',
  'catalogue-2026-11-13g-manifest.json',
  'catalogue-2026-11-13h-manifest.json',
  'catalogue-2026-11-13i-manifest.json',
  'catalogue-2026-11-15-manifest.json',
  'catalogue-2026-11-15b-manifest.json',
  'catalogue-2026-11-16-manifest.json',
] as const;

/** Selections whose complete phrase cannot fit the instrument range; the build must reject exactly these. */
export const EXPECTED_RANGE_REJECTIONS = ['mario', 'pokemon-center', 'green-greens', 'smb-stage-clear'] as const;

/** Reads every listed manifest and concatenates the selections; a missing file or a repeated id throws. */
export function readCatalogueManifests<T extends { id: string } = { id: string }>(
  files: readonly string[] = CATALOGUE_MANIFESTS,
  folder = 'scripts',
): T[] {
  const selections: T[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const path = `${folder}/${file}`;
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      throw new Error(`Catalogue manifest ${path} is listed but cannot be read`);
    }
    for (const selection of JSON.parse(text) as T[]) {
      if (seen.has(selection.id)) throw new Error(`Duplicate catalogue selection id ${selection.id} in ${file}`);
      seen.add(selection.id);
      selections.push(selection);
    }
  }
  return selections;
}

/** Throws unless the rejected ids are exactly the expected ones, so no song is dropped or revived silently. */
export function assertExpectedRejections(rejected: readonly string[]) {
  const expected = new Set<string>(EXPECTED_RANGE_REJECTIONS);
  const actual = new Set(rejected);
  const unexpected = [...actual].filter(id => !expected.has(id));
  const missing = [...expected].filter(id => !actual.has(id));
  if (unexpected.length || missing.length) {
    throw new Error(`Range rejections differ from EXPECTED_RANGE_REJECTIONS: unexpected [${unexpected}], no longer rejected [${missing}]`);
  }
}
