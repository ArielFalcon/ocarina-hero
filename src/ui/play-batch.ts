/**
 * The queue of plays not yet sent to the shared ranking, kept in browser storage so a closed or crashed page loses
 * none: they leave with the next page's flush. Every tab shares the queue; a send empties it before it goes.
 */
export const PENDING_PLAYS_STORAGE = 'ocarina.pending-plays.v1';

export interface PlayStore {
  read(): Record<string, number>;
  write(plays: Record<string, number>): void;
}

/** How a send ended: stored, worth retrying later (offline, rate limited, server error), or refused for good. */
export type SendResult = 'delivered' | 'retry' | 'rejected';

export interface PlayBatchOptions {
  store: PlayStore;
  send(plays: Record<string, number>): Promise<SendResult>;
  /** The server's limit per request; the queue also leaves on its own once it holds this many. */
  maxBatchPlays: number;
  /** Plays kept while sends keep failing; later plays are not queued. */
  maxQueuedPlays: number;
}

const sum = (plays: Record<string, number>) => Object.values(plays).reduce((total, count) => total + count, 0);

/** Splits the queue into batches of at most `size` plays. */
function batches(plays: Record<string, number>, size: number): Record<string, number>[] {
  const out: Record<string, number>[] = [];
  let current: Record<string, number> = {};
  let room = size;
  for (const [song, count] of Object.entries(plays)) {
    let left = count;
    while (left > 0) {
      const take = Math.min(left, room);
      current[song] = (current[song] ?? 0) + take;
      left -= take;
      room -= take;
      if (room === 0) { out.push(current); current = {}; room = size; }
    }
  }
  if (room < size) out.push(current);
  return out;
}

export function createPlayBatch(options: PlayBatchOptions) {
  const { store } = options;
  let holdUntilFlush = false;

  const requeue = (plays: Record<string, number>): void => {
    const queue = store.read();
    let room = options.maxQueuedPlays - sum(queue);
    for (const [song, count] of Object.entries(plays)) {
      const kept = Math.min(count, room);
      if (kept <= 0) break;
      queue[song] = (queue[song] ?? 0) + kept;
      room -= kept;
    }
    store.write(queue);
  };

  const flush = (): void => {
    const queue = store.read();
    if (sum(queue) === 0) return;
    store.write({});
    holdUntilFlush = false;
    for (const plays of batches(queue, options.maxBatchPlays)) {
      void options.send(plays).then(result => {
        if (result === 'retry') { holdUntilFlush = true; requeue(plays); }
      });
    }
  };

  const add = (song: string): void => {
    const queue = store.read();
    const queued = sum(queue);
    if (queued >= options.maxQueuedPlays) return;
    queue[song] = (queue[song] ?? 0) + 1;
    store.write(queue);
    if (!holdUntilFlush && queued + 1 >= options.maxBatchPlays) flush();
  };

  return { add, flush };
}

/** A queue that lives only as long as the page, for when browser storage is unavailable. */
export function memoryStore(): PlayStore {
  let plays: Record<string, number> = {};
  return { read: () => ({ ...plays }), write: next => { plays = { ...next }; } };
}

/** The queue in `storage`; anything unreadable counts as empty, and a failed write falls back to memory. */
export function browserStore(storage: Storage | undefined): PlayStore {
  const fallback = memoryStore();
  let usable = storage !== undefined;
  return {
    read() {
      if (!usable) return fallback.read();
      try {
        const value: unknown = JSON.parse(storage!.getItem(PENDING_PLAYS_STORAGE) ?? '{}');
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
        return Object.fromEntries(Object.entries(value).filter(([, count]) => Number.isInteger(count) && (count as number) > 0)) as Record<string, number>;
      } catch {
        return {};
      }
    },
    write(plays) {
      if (usable) {
        try {
          if (Object.keys(plays).length) storage!.setItem(PENDING_PLAYS_STORAGE, JSON.stringify(plays));
          else storage!.removeItem(PENDING_PLAYS_STORAGE);
          return;
        } catch {
          usable = false;
        }
      }
      fallback.write(plays);
    },
  };
}
