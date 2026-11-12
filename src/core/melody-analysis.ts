import type { SourceWindow } from './audio-window';
import audioLimits from './audio-limits.json';
import { groupPitchTrack, type SourcePitchEvent } from './pitch-track';
import type { MelodyNote } from './project';

export interface ModelPitchTrack {
  schemaVersion: 1;
  /** `decoder` and `basicPitchSha256` identify the fused decoder; tracks without them come from the earlier argmax decoder. */
  engine: { id: 'melodic-segnet'; revision: string; checkpointSha256: string; decoder?: string; basicPitchSha256?: string };
  sampleRate: 44100; durationSeconds: number; hopSeconds: number;
  frames: Array<{ timeSeconds: number; frequencyHz: number; modelScore: number }>;
}
export interface SourceAnalysis {
  sourceWindow?: SourceWindow;
  schemaVersion: 1; engine: ModelPitchTrack['engine']; durationSeconds: number; hopSeconds: number;
  contour: ModelPitchTrack['frames']; events: SourcePitchEvent[]; voicedFrameFraction: number;
  warnings: string[]; notes: readonly MelodyNote[]; tempoBpm: 60;
}
export function parseModelPitchTrack(value: unknown): ModelPitchTrack {
  const fail = (): never => { throw new Error('Invalid model pitch track'); };
  if (!value || typeof value !== 'object') return fail();
  const v = value as Record<string, unknown>;
  const e = v.engine as Record<string, unknown> | null;
  const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  if (v.schemaVersion !== 1 || !e || e.id !== 'melodic-segnet' || typeof e.revision !== 'string' || !e.revision.trim()
      || typeof e.checkpointSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(e.checkpointSha256)
      || (e.decoder !== undefined && (typeof e.decoder !== 'string' || !e.decoder.trim()))
      || (e.basicPitchSha256 !== undefined && (typeof e.basicPitchSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(e.basicPitchSha256)))
      || v.sampleRate !== 44100 || !finite(v.durationSeconds) || v.durationSeconds <= 0 || v.durationSeconds > audioLimits.maxDurationSeconds
      || !finite(v.hopSeconds) || v.hopSeconds < 256 / 44100 || !Array.isArray(v.frames)
      || v.frames.length > Math.floor(v.durationSeconds / v.hopSeconds) + 1) return fail();
  let previous = -1;
  for (const item of v.frames) {
    if (!item || typeof item !== 'object') return fail();
    const f = item as Record<string, unknown>;
    if (!finite(f.timeSeconds) || f.timeSeconds < 0 || f.timeSeconds > v.durationSeconds || f.timeSeconds <= previous
        || (previous >= 0 && Math.abs(f.timeSeconds - previous - v.hopSeconds) > 1e-8)
        || !finite(f.frequencyHz) || (f.frequencyHz !== 0 && (f.frequencyHz < 1 || f.frequencyHz > 22050))
        || !finite(f.modelScore) || f.modelScore < 0 || f.modelScore > 1) return fail();
    previous = f.timeSeconds;
  }
  return value as ModelPitchTrack;
}
export function analyzeModelPitchTrack(track: ModelPitchTrack): SourceAnalysis {
  const unit = 256 / 22050;
  const events = groupPitchTrack(track.frames, track.hopSeconds, track.durationSeconds,
    { lookbackSeconds: 6 * unit, lookaheadSeconds: 3 * unit, minChangeSeconds: 3 * unit });
  const uncertain = events.filter(event => event.insufficientSupport).length;
  return { schemaVersion: 1, engine: { ...track.engine }, durationSeconds: track.durationSeconds, hopSeconds: track.hopSeconds,
    contour: track.frames.map(frame => ({ ...frame })), events,
    voicedFrameFraction: track.frames.filter(frame => frame.frequencyHz > 0).length / Math.max(1, track.frames.length),
    warnings: uncertain ? [`${uncertain} candidates have insufficient pitch support and are included in the notes.`] : [],
    notes: events.map(event => ({ midi: event.midi, startBeat: event.startSeconds, durationBeats: event.durationSeconds })), tempoBpm: 60 };
}
