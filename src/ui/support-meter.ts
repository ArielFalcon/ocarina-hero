/**
 * When to ask for a tip: songs listened to or browsed in this session earn points, and the tip card shows once
 * the session reaches a threshold drawn when it starts. Everything stays in session storage; nothing is sent.
 * No DOM, so the rules are testable; features/support.ts wires it to the page.
 */
export const SUPPORT_SESSION_STORAGE = 'ocarina.support-session.v1';

/** A song played for `LISTEN_MS` in the lesson. */
export const LISTEN_POINTS = 1;
/** A song view opened, or a song played for `LISTEN_MS` in the quick-play preview. */
export const BROWSE_POINTS = 0.5;
/** Playback a song needs, summed across pauses, to count as heard. */
export const LISTEN_MS = 10_000;
/** Session points that bring up the tip card; one is drawn when the session starts. */
export const THRESHOLDS = [3, 3.5, 4] as const;

export interface SupportSession {
  readonly threshold: number;
  /** Each song's best score this session. */
  readonly points: Readonly<Record<string, number>>;
  /** The card has been asked for this session; set before it shows. */
  readonly asked: boolean;
}

/** A stored session, or null when it is missing or not one this code wrote. */
export function readSupportSession(stored: unknown): SupportSession | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const { threshold, points, asked } = stored as Record<string, unknown>;
  if (!(THRESHOLDS as readonly unknown[]).includes(threshold) || typeof asked !== 'boolean') return null;
  if (typeof points !== 'object' || points === null || Array.isArray(points)) return null;
  if (!Object.values(points).every(value => value === LISTEN_POINTS || value === BROWSE_POINTS)) return null;
  return { threshold: threshold as number, points: { ...points as Record<string, number> }, asked };
}

export interface SupportMeterOptions {
  load(): SupportSession | null;
  save(session: SupportSession): void;
  /** In [0, 1), as `Math.random`. */
  random(): number;
  /** True while the visitor is a confirmed supporter: they are never asked. */
  suppressed(): boolean;
  ask(): void;
}

export function createSupportMeter(options: SupportMeterOptions) {
  let session: SupportSession = options.load() ?? {
    threshold: THRESHOLDS[Math.min(THRESHOLDS.length - 1, Math.floor(options.random() * THRESHOLDS.length))]!,
    points: {},
    asked: false,
  };
  const total = () => Object.values(session.points).reduce((sum, value) => sum + value, 0);

  /** Scores `song` with `value` unless it already scored as much this session; may ask for the card. */
  function credit(song: string, value: number): void {
    if ((session.points[song] ?? 0) >= value) return;
    session = { ...session, points: { ...session.points, [song]: value } };
    const due = !session.asked && !options.suppressed() && total() >= session.threshold;
    if (due) session = { ...session, asked: true };
    options.save(session);
    if (due) options.ask();
  }

  return { credit, points: total, threshold: () => session.threshold };
}

export type ListenSource = 'lesson' | 'preview';

export interface ListenClockOptions {
  now(): number;
  setTimer(run: () => void, ms: number): number;
  clearTimer(id: number): void;
  /** Called once per song and source when its playback reaches `LISTEN_MS`. */
  heard(song: string, source: ListenSource): void;
}

/** Sums playback time per song and source; each source plays at most one song at a time. */
export function createListenClock(options: ListenClockOptions) {
  const played = new Map<string, number>();
  const heard = new Set<string>();
  const running = new Map<ListenSource, { song: string; since: number; timer: number }>();

  function stop(source: ListenSource): void {
    const current = running.get(source);
    if (!current) return;
    running.delete(source);
    options.clearTimer(current.timer);
    const key = `${source}:${current.song}`;
    played.set(key, (played.get(key) ?? 0) + options.now() - current.since);
  }

  /** `song` started (`playing`) or stopped sounding in `source`; null stops whatever the source played. */
  function playing(source: ListenSource, song: string | null, isPlaying: boolean): void {
    const current = running.get(source);
    if (current && current.song === song && isPlaying) return;
    stop(source);
    if (!song || !isPlaying) return;
    const key = `${source}:${song}`;
    if (heard.has(key)) return;
    const timer = options.setTimer(() => {
      running.delete(source);
      heard.add(key);
      options.heard(song, source);
    }, Math.max(0, LISTEN_MS - (played.get(key) ?? 0)));
    running.set(source, { song, since: options.now(), timer });
  }

  return { playing };
}
