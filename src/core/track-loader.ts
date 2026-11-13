import type { DemoTrack, SongData, TrackSummary } from './demo';

export type SongSource = () => Promise<SongData>;

export interface TrackLoader {
  /** The full track once its notes were loaded (or at once for an inline demo). */
  cached(id: string): DemoTrack | undefined;
  /** Full track; concurrent and repeated calls for a song share one request. A failed request is retried by the next call. */
  load(id: string): Promise<DemoTrack>;
  /** Starts loading in the background so a later `load` or `cached` is ready; never rejects. */
  prefetch(id: string): void;
}

/**
 * Songs listed as light summaries get their notes from `sources` (one lazy import per id);
 * a listed track that already carries its notes resolves without a source.
 */
export function createTrackLoader(listing: readonly (DemoTrack | TrackSummary)[], sources: Readonly<Record<string, SongSource>>): TrackLoader {
  const summaries = new Map(listing.map(track => [track.id, track]));
  const pending = new Map<string, Promise<DemoTrack>>();
  const ready = new Map<string, DemoTrack>();

  function load(id: string): Promise<DemoTrack> {
    const known = ready.get(id);
    if (known) return Promise.resolve(known);
    const running = pending.get(id);
    if (running) return running;
    const summary = summaries.get(id);
    if (!summary) return Promise.reject(new Error(`Unknown song "${id}"`));
    if ('melody' in summary) {
      ready.set(id, summary);
      return Promise.resolve(summary);
    }
    const source = sources[id];
    if (!source) return Promise.reject(new Error(`No notes available for "${id}"`));
    const { difficulty: _difficulty, ...fields } = summary;
    const request = source().then(data => {
      const track: DemoTrack = { ...fields, melody: data.melody, fixedNotes: data.fixedNotes, phraseStarts: data.phraseStarts };
      ready.set(id, track);
      return track;
    }).finally(() => pending.delete(id));
    pending.set(id, request);
    return request;
  }

  return {
    cached: id => {
      const summary = summaries.get(id);
      return ready.get(id) ?? (summary && 'melody' in summary ? summary : undefined);
    },
    load,
    prefetch: id => { load(id).catch(() => {}); },
  };
}

/** Maps lazy imports keyed by file path (`import.meta.glob`) to loader sources keyed by song id. */
export function sourcesByFile(files: Readonly<Record<string, SongSource>>): Record<string, SongSource> {
  return Object.fromEntries(Object.entries(files).map(([path, source]) => [path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, ''), source]));
}

/**
 * Guards asynchronous work started by a selection: only the most recent `begin()` stays current,
 * so a slow load of an earlier choice never replaces a newer one.
 */
export function latestRequest(): { begin(): () => boolean; cancel(): void } {
  let latest = 0;
  return {
    begin: () => { const mine = ++latest; return () => mine === latest; },
    cancel: () => { latest++; },
  };
}
