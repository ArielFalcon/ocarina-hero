import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMOS } from './catalogue-loader';
import { toTabText } from '../src/core/tab';
import { createPassages, lessonDetails } from '../src/ui/lesson';
import { songDocumentTitle, songPath } from '../src/ui/route';
import { createSongbookEntries, openingNotes, songMeta, type SongbookEntry } from '../src/ui/songbook';

export interface SongPage {
  readonly id: string;
  readonly title: string;
  /** Universe, artist and version, as shown under the title in the Songbook. */
  readonly meta: string;
  /** Shown above the lesson title. */
  readonly universe: string;
  /** Version and size of the arrangement, as a first visit shows them under the lesson title. */
  readonly details: string;
  /** Button tab of the arrangement the lesson opens with. */
  readonly tab: string;
}

export function songPageOf(song: SongbookEntry): SongPage {
  const notes = openingNotes(song.track);
  return {
    id: song.id,
    title: song.title,
    meta: songMeta(song),
    universe: song.universe,
    details: lessonDetails(song.version, notes.length, createPassages(notes, song.track.tempoBpm, song.track.phraseStarts).length).join(' · '),
    tab: toTabText(notes, song.track.beatsPerBar, song.track.tempoBpm, { noteSeparator: ', ' }),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!);
}

/** The site address declared by the page's canonical link, ending with a slash. */
export function siteUrlOf(indexHtml: string): string {
  const canonical = indexHtml.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (!canonical) throw new Error('index.html has no canonical link to derive the site address from.');
  return canonical;
}

function songUrl(siteUrl: string, id: string): string {
  return new URL(songPath('', id), siteUrl).href;
}

/**
 * The app shell opened on one song: its head (title, description, canonical address, share preview) and the
 * lesson view with its heading and text tab, so the page says what it is before the app starts.
 */
export function songPageHtml(indexHtml: string, song: SongPage, siteUrl: string): string {
  const title = escapeHtml(songDocumentTitle(song.title, song.meta));
  const description = escapeHtml(`Learn to play ${song.title} (${song.meta}) on the ocarina: follow the button tab, listen to it and practice one passage at a time. Free, in your browser.`);
  const address = escapeHtml(songUrl(siteUrl, song.id));
  const values: readonly (readonly [opening: RegExp, value: string])[] = [
    [/(<title>)[^<]*/, title],
    [/(<meta name="description" content=")[^"]*/, description],
    [/(<link rel="canonical" href=")[^"]*/, address],
    [/(<meta property="og:title" content=")[^"]*/, title],
    [/(<meta property="og:description" content=")[^"]*/, description],
    [/(<meta property="og:url" content=")[^"]*/, address],
    [/(<meta name="twitter:title" content=")[^"]*/, title],
    [/(<meta name="twitter:description" content=")[^"]*/, description],
    [/(<div class="app)(?=">)/, ' is-lesson has-song'],
    [/(<section id="catalog-view"[^>]*)(?=>)/, ' hidden'],
    [/(<section id="lesson-view"[^>]*?) hidden(?=>)/, ''],
    [/(<p id="lesson-universe"[^>]*>)[^<]*/, escapeHtml(song.universe)],
    [/(<h1 id="lesson-title"[^>]*>)[^<]*/, escapeHtml(song.title)],
    [/(<p id="lesson-meta"[^>]*>)[^<]*/, escapeHtml(song.details)],
    [/(<p id="tab-text"[^>]*>)[^<]*/, escapeHtml(song.tab)],
  ];
  return values.reduce((html, [opening, value]) => {
    if (!opening.test(html)) throw new Error(`index.html has no tag matching ${opening} to describe a song page.`);
    return html.replace(opening, (_match, start: string) => start + value);
  }, indexHtml);
}

export function sitemapXml(siteUrl: string, songIds: readonly string[]): string {
  const urls = [siteUrl, ...songIds.map(id => songUrl(siteUrl, id))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

/** Writes one page per song, the sitemap and robots.txt next to the built app shell. */
export function writeSongPages(outDir: string): void {
  const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8');
  const siteUrl = siteUrlOf(indexHtml);
  const songs = createSongbookEntries(DEMOS);
  for (const song of songs) {
    const directory = join(outDir, songPath('', song.id));
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'index.html'), songPageHtml(indexHtml, songPageOf(song), siteUrl));
  }
  writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml(siteUrl, songs.map(song => song.id)));
  // The popularity Function only scores songs listed here.
  writeFileSync(join(outDir, 'song-ids.json'), JSON.stringify(songs.map(song => song.id)));
  writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);
}
