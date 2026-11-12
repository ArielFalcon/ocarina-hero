import type { Midi } from '@tonejs/midi';
import type { MelodyNote } from './project';

export interface ExtractedMelody {
  readonly notes: readonly MelodyNote[];
  readonly trackName: string;
  readonly trackIndex: number;
  readonly trackCount: number;
}

interface TrackScore {
  readonly index: number;
  readonly name: string;
  readonly monophony: number;
  readonly averagePitch: number;
  readonly notes: readonly MelodyNote[];
  score: number;
}

interface RawNote {
  readonly midi: number;
  readonly ticks: number;
  readonly durationTicks: number;
}

function scoreTrack(
  track: { name: string; notes: Iterable<RawNote> },
  index: number,
  ppq: number,
): TrackScore | null {
  const buckets = new Map<number, RawNote[]>();

  for (const note of track.notes) {
    const tick = Math.round(note.ticks);
    const bucket = buckets.get(tick) ?? [];
    bucket.push({ midi: note.midi, ticks: tick, durationTicks: note.durationTicks });
    buckets.set(tick, bucket);
  }

  const onsets = [...buckets.keys()].sort((a, b) => a - b);
  if (onsets.length === 0) return null;

  const notes: MelodyNote[] = [];
  let pitchSum = 0;
  let total = 0;

  for (const note of track.notes) total += 1;

  for (let i = 0; i < onsets.length; i += 1) {
    const tick = onsets[i] ?? 0;
    const bucket = buckets.get(tick) ?? [];
    const top = bucket.reduce((a, b) => (b.midi > a.midi ? b : a));

    const nextTick = onsets[i + 1] ?? tick + top.durationTicks;
    const endTick = Math.min(tick + top.durationTicks, nextTick);
    const durationTicks = Math.max(endTick - tick, ppq / 16);

    notes.push({
      midi: top.midi,
      startBeat: tick / ppq,
      durationBeats: durationTicks / ppq,
    });
    pitchSum += top.midi;
  }

  const monophony = onsets.length / Math.max(total, 1);

  return {
    index,
    name: track.name || `Track ${index + 1}`,
    monophony,
    averagePitch: pitchSum / notes.length,
    notes,
    score: monophony * 2 + (pitchSum / notes.length - 60) / 24,
  };
}

/**
 * Picks the most likely melody track and flattens it to one voice.
 *
 * Drums are excluded by channel, the bass loses on register, and chords are
 * reduced to their top note. This is a heuristic: the track name is surfaced
 * so a wrong pick is visible instead of silent. `forceTrack` overrides the
 * choice, which is useful while inspecting a file.
 */
export function extractMelody(midi: Midi, forceTrack?: number): ExtractedMelody | null {
  const ppq = midi.header.ppq;
  const tracks: TrackScore[] = [];
  let forced: TrackScore | null = null;

  midi.tracks.forEach((track, index) => {
    if (track.instrument.percussion || track.channel === 9) return;
    if (track.notes.length < 8) return;

    const scored = scoreTrack(track, index, ppq);
    if (!scored) return;

    tracks.push(scored);
    if (forceTrack === index) forced = scored;
  });

  const best = forced ?? [...tracks].sort((a, b) => b.score - a.score)[0];
  if (!best) return null;

  return {
    notes: best.notes,
    trackName: best.name,
    trackIndex: best.index,
    trackCount: midi.tracks.length,
  };
}
