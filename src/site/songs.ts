import { createSongbookEntries } from '../ui/songbook';
import { SITE_SONGS } from './catalogue';
import { buildHubs } from './hubs';
import { songLastModified } from './last-modified';
import { songGroups, songPageOf } from './song-pages';

/** The site's songs, their pages and their universes' groups, computed once per build. */
export const songbook = createSongbookEntries(SITE_SONGS);
export const pages = songbook.map(songPageOf);
export const groups = songGroups(songbook);
export const hubs = buildHubs(pages);
/** Song id → day its notes last changed, from git history; empty outside a checkout. */
export const modified = songLastModified();
