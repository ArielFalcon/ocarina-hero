import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import toneMidi from '@tonejs/midi';
import { BEND_LIMIT, PITCHES, frequencyOf, pitchById } from '../src/core/pitches';
import { toTabText, bendLabel, toTabRestGroups } from '../src/core/tab';
import { projectFaithfully, selectPhrase } from './catalogue-tools';
import { ensureExternalMedia } from './media-directory';

const { Midi } = toneMidi as unknown as { Midi: typeof import('@tonejs/midi').Midi };

interface Selection {
  id: string;
  title: string;
  category: string;
  hook: string;
  source: { file: string; page: string; url: string; sha256: string };
  trackIndex: number;
  indices: number[];
  phraseStarts: number[];
  beatsPerBar?: number;
  evidence: { level: string; summary: string; urls: string[] };
  corpus?: { clip: string | null; alignmentValidated: boolean; originalRecordingAudited: boolean; notes: string };
  reference: {
    file?: string;
    trackIndex?: number;
    indices?: number[];
    pitchShift?: number;
    matchOnset?: boolean;
    assembly?: boolean;
    scorePitches?: number[];
    collapseRepeated?: boolean;
    /** Selection positions the reference omits or merges into the previous attack; documented per row in the curation evidence. */
    absentIndices?: number[];
  };
}

ensureExternalMedia();
const directory = 'out/catalogue';
const delivery = `${directory}/delivery`;
const instrumentConfigSha256 = createHash('sha256').update(readFileSync('src/core/pitches.ts')).digest('hex');
const manifest: Selection[] = JSON.parse(readFileSync('scripts/catalogue-manifest.json', 'utf8'));
if (existsSync('scripts/catalogue-next-manifest.json')) {
  manifest.push(...JSON.parse(readFileSync('scripts/catalogue-next-manifest.json', 'utf8')));
}
if (existsSync('scripts/catalogue-2026-manifest.json')) {
  manifest.push(...JSON.parse(readFileSync('scripts/catalogue-2026-manifest.json', 'utf8')));
}
if (existsSync('scripts/catalogue-pop-culture-manifest.json')) {
  manifest.push(...JSON.parse(readFileSync('scripts/catalogue-pop-culture-manifest.json', 'utf8')));
}
if (existsSync('scripts/catalogue-2026-11-13-manifest.json')) {
  manifest.push(...JSON.parse(readFileSync('scripts/catalogue-2026-11-13-manifest.json', 'utf8')));
}
if (existsSync('scripts/catalogue-2026-11-13b-manifest.json')) {
  manifest.push(...JSON.parse(readFileSync('scripts/catalogue-2026-11-13b-manifest.json', 'utf8')));
}
if (existsSync('scripts/catalogue-2026-11-13c-manifest.json')) {
  manifest.push(...JSON.parse(readFileSync('scripts/catalogue-2026-11-13c-manifest.json', 'utf8')));
}
if (existsSync('scripts/catalogue-2026-11-13d-manifest.json')) {
  manifest.push(...JSON.parse(readFileSync('scripts/catalogue-2026-11-13d-manifest.json', 'utf8')));
}
if (existsSync('scripts/catalogue-2026-11-13e-manifest.json')) {
  manifest.push(...JSON.parse(readFileSync('scripts/catalogue-2026-11-13e-manifest.json', 'utf8')));
}
const songs = [];
const report = [];

for (const selection of manifest) {
  const bytes = readFileSync(selection.source.file);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== selection.source.sha256) throw new Error(`${selection.id}: source changed`);
  const midi = new Midi(bytes);
  const phrase = selectPhrase(midi, selection.trackIndex, selection.indices);
  const corroboration = compareReference(selection, midi);
  const projection = projectFaithfully(phrase.melody);
  const pitches = phrase.melody.map(note => note.midi);
  const secondsPerBeat = 60 / phrase.tempoBpm;
  const durationSeconds = Math.max(...phrase.melody.map(note =>
    (note.startBeat + note.durationBeats) * secondsPerBeat,
  ));
  const summary = {
    id: selection.id, title: selection.title, category: selection.category, hook: selection.hook,
    status: projection ? 'adapted' : 'rejected-range',
    noteCount: pitches.length, sourceSpanSemitones: Math.max(...pitches) - Math.min(...pitches),
    durationSeconds, source: selection.source, selection: {
      trackIndex: selection.trackIndex, indices: selection.indices,
      startTick: phrase.startTick, endTick: phrase.endTick, sourceStartSeconds: phrase.sourceStartSeconds,
    },
    evidence: selection.evidence, corroboration,
    instrumentConfigSha256,
    originalRecordingAudited: selection.corpus?.originalRecordingAudited ?? false,
    physicalGameVerified: false, ...(selection.corpus ? { corpus: selection.corpus } : {}),
    ...(projection ? {
      transpositionSemitones: projection.transpositionSemitones,
      alteredNotes: 0, bentNotes: projection.bentNotes,
      maximumTuningErrorCents: Math.max(...projection.notes.map((note, index) => Math.abs(
        1200 * Math.log2(frequencyOf(note.pitch, note.bend) /
          (440 * 2 ** ((pitches[index]! + projection.transpositionSemitones - 69) / 12))),
      ))),
    } : { reason: 'The complete proposed phrase cannot fit the configured range under uniform transposition.' }),
  };
  report.push(summary);
  console.log(`${selection.id}: ${summary.status}, ${pitches.length} notes, ${summary.sourceSpanSemitones} semitones, ${durationSeconds.toFixed(3)} s`);
  if (!projection) continue;

  const folder = `${delivery}/${selection.id}`;
  mkdirSync(folder, { recursive: true });
  const song = {
    id: `catalogue-${selection.id}`, title: selection.title,
    subtitle: selection.hook,
    tempoBpm: phrase.tempoBpm, beatsPerBar: selection.beatsPerBar ?? 4,
    melody: phrase.melody, fixedNotes: projection.notes,
    phraseStarts: toTabRestGroups(projection.notes, phrase.tempoBpm).map(group => group.tokens[0]!.noteIndex),
  };
  songs.push(song);
  writeFileSync(`${folder}/arrangement.json`, `${JSON.stringify({ ...summary, ...song }, null, 2)}\n`);
  writeFileSync(`${folder}/tab.txt`, `${selection.title}\n${selection.hook}\n\n${toTabText(projection.notes, song.beatsPerBar, phrase.tempoBpm)}\n\n`
    + 'Combine the note button with the named control and direction. Hold D-pad for a direct change or Stick for a sliding change. Times and durations below are seconds.\n\n'
    + 'index,button,modifier,bend_semitones,written_pitch,sounding_midi,start_seconds,duration_seconds\n'
    + projection.notes.map((note, index) => [
      index + 1, pitchById(note.pitch).button, bendLabel(note.bend ?? 0) || 'none', note.bend ?? 0, note.pitch,
      pitchById(note.pitch).midi + 12 + (note.bend ?? 0),
      (note.startBeat * secondsPerBeat).toFixed(6), (note.durationBeats * secondsPerBeat).toFixed(6),
    ].join(',')).join('\n') + '\n');
  for (const [name, shift] of [['source', 0], ['ocarina', projection.transpositionSemitones]] as const) {
    const exported = new Midi();
    exported.header.fromJSON({ name: selection.title, ppq: 9600, tempos: [{ ticks: 0, bpm: phrase.tempoBpm }], timeSignatures: [], keySignatures: [], meta: [] });
    const track = exported.addTrack();
    track.name = `${selection.title} — ${name}`;
    for (const note of phrase.melody) track.addNote({
      midi: note.midi + shift, time: note.startBeat * secondsPerBeat,
      duration: note.durationBeats * secondsPerBeat, velocity: 0.8,
    });
    writeFileSync(`${folder}/${name}.mid`, Buffer.from(exported.toArray()));
  }
}

mkdirSync(delivery, { recursive: true });
writeFileSync(`${delivery}/instrument-config.json`, `${JSON.stringify({
  sourceFile: 'src/core/pitches.ts', sha256: instrumentConfigSha256,
  combinations: PITCHES.flatMap(pitch => Array.from({ length: BEND_LIMIT * 2 + 1 }, (_, index) => {
    const bend = index - BEND_LIMIT;
    return { pitch: pitch.id, button: pitch.button, bend, soundingMidi: pitch.midi + 12 + bend, frequencyHz: frequencyOf(pitch.id, bend) };
  })),
}, null, 2)}\n`);
writeFileSync(`${delivery}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(`${delivery}/README.md`, '# Ocarina fragment delivery\n\n'
  + `${songs.length} adapted fragments from ${report.length} reproducible selections. The complete expansion assessment is in catalogue-next/ASSESSMENT.md; per-cohort preliminary reports are historical.\n\n`
  + '## Playback and files\n\n'
  + 'Select a curated song in the app and press Play. Fixed arrangements preserve every selected note and its timing. '
  + 'Each song directory contains arrangement.json, tab.txt, source.mid, ocarina.mid and, after --audio, ocarina.wav and audio-check.txt. '
  + 'WAV files are calibrated synthesized previews; adapted MIDI uses nominal pitches without calibration offsets.\n\n'
  + '| Song | Status | Notes | Duration | Span | Shift |\n| --- | --- | ---: | ---: | ---: | ---: |\n'
  + report.map(item => `| ${item.title} | ${item.status} | ${item.noteCount} | ${item.durationSeconds.toFixed(3)} s | ${item.sourceSpanSemitones} | ${item.transpositionSemitones ?? 'Rejected'} |`).join('\n')
  + `\n\nAll ${songs.reduce((count, song) => count + song.melody.length, 0)} accepted events retain their selected pitches under one uniform shift, onsets, durations and rests. `
  + 'No per-note octave folding, compression or ornament removal is applied. Visual groups split at rests of at least one beat and500ms at source tempo.\n\n'
  + '## Evidence and limits\n\n'
  + report.map(item => `### ${item.title}\n\nSource: [transcription page](${item.source.page})\n\n${item.evidence.summary}\n\n`
    + item.evidence.urls.map(url => `- ${url}`).join('\n')).join('\n\n')
  + '\n\nPitch measurements check synthesized playback against configured frequencies. They do not validate an original recording. '
  + 'No physical game verification is claimed. Original excerpts and candidate alignments live separately under corpus; see corpus/index.json. '
  + 'Unvalidated pairs must not be treated as audio extraction labels.\n',
);
writeFileSync('src/core/songs/catalogue.ts',
  "import type { Note } from '../ir';\nimport type { MelodyNote } from '../project';\n\n"
  + `export const CURATED_SONGS = ${JSON.stringify(songs, null, 2)} satisfies readonly {\n`
  + '  id: string; title: string; subtitle: string; tempoBpm: number; beatsPerBar: number;\n'
  + '  melody: readonly MelodyNote[]; fixedNotes: readonly Note[]; phraseStarts: readonly number[];\n}[];\n',
);

if (process.argv.includes('--audio')) {
  for (const song of songs) {
    const check = execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/measure.ts', song.id], { encoding: 'utf8' });
    const folder = `${delivery}/${song.id.replace('catalogue-', '')}`;
    writeFileSync(`${folder}/audio-check.txt`, check);
    renameSync(`out/${song.id}.wav`, `${folder}/ocarina.wav`);
  }
}

function compareReference(selection: Selection, midi: InstanceType<typeof Midi>) {
  const reference = selection.reference;
  let selected = selection.indices.map(index => midi.tracks[selection.trackIndex]!.notes[index]!);
  if (reference.assembly) {
    const text = readFileSync(reference.file!, 'utf8');
    const section = text.split('Music_Routes1_Ch2::')[1]!.split('.sub1:')[1]!.split('.sub3:')[0]!;
    const pitches: number[] = [];
    const starts: number[] = [];
    const pitchClasses: Record<string, number> = { C_: 0, 'C#': 1, D_: 2, 'D#': 3, E_: 4, F_: 5, 'F#': 6, G_: 7, 'G#': 8, A_: 9, 'A#': 10, B_: 11 };
    let octave = 4;
    let position = 0;
    for (const line of section.split('\n')) {
      const octaveMatch = line.match(/octave (\d+)/);
      if (octaveMatch) octave = Number(octaveMatch[1]);
      const noteMatch = line.match(/note ([A-G][_#]), (\d+)/);
      if (!noteMatch) continue;
      pitches.push((octave + 1) * 12 + pitchClasses[noteMatch[1]!]! + 12);
      starts.push(position);
      position += Number(noteMatch[2]) / 4;
    }
    assertPitchSequence(selected.map(note => note.midi), pitches, selection.id);
    if (selected.some((note, index) => Math.abs(note.ticks / midi.header.ppq - starts[index]!) > 1e-8)) {
      throw new Error(`${selection.id}: game sequence onset mismatch`);
    }
    return { checkedNotes: pitches.length, pitchDifferences: 0, relativeOnsetDifferences: 0, source: reference.file };
  }
  if (reference.scorePitches) {
    const normalize = (pitches: number[]) => reference.collapseRepeated
      ? pitches.filter((pitch, index) => index === 0 || pitch !== pitches[index - 1]) : pitches;
    const expected = normalize(reference.scorePitches.map(pitch => pitch + (reference.pitchShift ?? 0)));
    assertPitchSequence(normalize(selected.map(note => note.midi)), expected, selection.id);
    return { checkedNotes: expected.length, pitchDifferences: 0, contourOnly: !!reference.collapseRepeated, source: selection.evidence.urls[0] };
  }
  const other = new Midi(readFileSync(reference.file!));
  const track = other.tracks[reference.trackIndex!]!;
  if (reference.absentIndices) {
    const absent = new Set(reference.absentIndices);
    selected = selected.filter((_, position) => !absent.has(position));
  }
  const matched = reference.matchOnset ? selected.map(note => {
    const found = track.notes.find(otherNote => otherNote.midi === note.midi
      && Math.abs(otherNote.ticks / other.header.ppq - note.ticks / midi.header.ppq) < 1e-8);
    if (!found) throw new Error(`${selection.id}: no reference pitch/onset match`);
    return found;
  }) : reference.indices!.map(index => track.notes[index]!);
  assertPitchSequence(selected.map(note => note.midi), matched.map(note => note.midi + (reference.pitchShift ?? 0)), selection.id);
  const first = selected[0]!.ticks / midi.header.ppq;
  const otherFirst = matched[0]!.ticks / other.header.ppq;
  const maximumOnsetDeviationBeats = Math.max(...selected.map((note, index) => Math.abs(
    note.ticks / midi.header.ppq - first - (matched[index]!.ticks / other.header.ppq - otherFirst),
  )));
  return { checkedNotes: selected.length, pitchDifferences: 0, maximumOnsetDeviationBeats, source: reference.file };
}

function assertPitchSequence(actual: number[], expected: number[], id: string): void {
  if (actual.length !== expected.length || actual.some((pitch, index) => pitch !== expected[index])) {
    throw new Error(`${id}: reference pitch sequence differs`);
  }
}
