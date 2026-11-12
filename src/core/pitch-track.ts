export interface PitchFrame { timeSeconds: number; frequencyHz: number }
export interface SourcePitchEvent {
  startSeconds: number; durationSeconds: number; midi: number; fractionalMidi: number;
  representativeHz: number; frameCount: number; stableSeconds: number; insufficientSupport: boolean;
}
export interface PitchGroupingSettings { lookbackSeconds: number; lookaheadSeconds: number; minChangeSeconds: number }

/** Groups contiguous voiced frames without interpreting their voicing policy. */
export function groupPitchTrack(frames: readonly PitchFrame[], hopSeconds: number, durationSeconds: number, settings: PitchGroupingSettings): SourcePitchEvent[] {
  const pitches = frames.map(f => f.frequencyHz > 0 ? 69 + 12 * Math.log2(f.frequencyHz / 440) : null);
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  const beforeCount = Math.max(1, Math.round(settings.lookbackSeconds / hopSeconds));
  const afterCount = Math.max(1, Math.round(settings.lookaheadSeconds / hopSeconds));
  const minCount = Math.max(1, Math.round(settings.minChangeSeconds / hopSeconds));
  const events: SourcePitchEvent[] = [];
  let start = 0;
  while (start < frames.length) {
    if (pitches[start] === null) { start++; continue; }
    let end = start + 1;
    while (end < frames.length && pitches[end] !== null) {
      const before = pitches.slice(Math.max(start, end - beforeCount), end) as number[];
      const after = pitches.slice(end, end + afterCount);
      if (before.length >= minCount && after.length === afterCount && after.every(p => p !== null)
          && Math.abs(median(before) - median(after as number[])) > 0.65) break;
      end++;
    }
    const values = pitches.slice(start, end) as number[];
    const center = median(values);
    const stable = values.filter(p => Math.abs(p - center) < 0.3).length;
    const from = Math.max(0, start === 0 ? frames[start]!.timeSeconds - hopSeconds / 2
      : (frames[start - 1]!.timeSeconds + frames[start]!.timeSeconds) / 2);
    const to = Math.min(durationSeconds, end === frames.length ? frames[end - 1]!.timeSeconds + hopSeconds / 2
      : (frames[end - 1]!.timeSeconds + frames[end]!.timeSeconds) / 2);
    if (to > from) events.push({ startSeconds: from, durationSeconds: to - from, midi: Math.round(center), fractionalMidi: center,
      representativeHz: 440 * 2 ** ((center - 69) / 12), frameCount: values.length, stableSeconds: stable * hopSeconds,
      insufficientSupport: stable < minCount });
    start = end;
  }
  return events;
}
