import { createSongbookEntries } from '../ui/songbook';
import { SITE_SONGS } from './catalogue';
import { songGroups, songPageOf } from './song-pages';

/** The site's songs, their pages and their universes' groups, computed once per build. */
export const songbook = createSongbookEntries(SITE_SONGS);
export const pages = songbook.map(songPageOf);
export const groups = songGroups(songbook);
