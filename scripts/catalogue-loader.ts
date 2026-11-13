import { readFileSync, readdirSync } from 'node:fs';
import { INLINE_DEMOS, type DemoTrack, type SongData } from '../src/core/demo';
import { CATALOGUE_INDEX } from '../src/core/songs/catalogue-index';
import type { SongSource } from '../src/core/track-loader';

const FOLDER = new URL('../src/core/songs/catalogue/', import.meta.url);

/** The notes of a curated song, read from its JSON file. */
export function readSongData(id: string): SongData {
  return JSON.parse(readFileSync(new URL(`${id}.json`, FOLDER), 'utf8'));
}

/** A curated song with its notes, read synchronously (Node scripts and tests have no lazy bundle). */
export function catalogueTrack(id: string): DemoTrack {
  const { difficulty: _difficulty, ...summary } = CATALOGUE_INDEX.find(song => song.id === id)!;
  return { ...summary, ...readSongData(id) };
}

/** Loader sources for every catalogue file, keyed by song id. */
export function catalogueSources(): Record<string, SongSource> {
  return Object.fromEntries(readdirSync(FOLDER).filter(name => name.endsWith('.json'))
    .map(name => name.slice(0, -5)).map(id => [id, async () => readSongData(id)]));
}

/** Every song with its notes: the curated catalogue, then the inline demos. */
export const DEMOS: readonly DemoTrack[] = [...CATALOGUE_INDEX.map(song => catalogueTrack(song.id)), ...INLINE_DEMOS];
