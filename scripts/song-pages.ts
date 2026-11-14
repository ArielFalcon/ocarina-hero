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

/** A song as other pages link to it. */
export interface SongLink { readonly id: string; readonly title: string; readonly meta: string }
export interface SongGroup { readonly universe: string; readonly songs: readonly SongLink[] }

/** The franchise the app is named after leads; the other universes follow by size, then name. */
const LEAD_UNIVERSE = 'The Legend of Zelda';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!);
}

/** JSON for a script data block: "<" is escaped so no value can close the script element. */
function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function songGroups(songs: readonly SongbookEntry[]): SongGroup[] {
  const groups = new Map<string, SongLink[]>();
  for (const song of songs) groups.set(song.universe, [...groups.get(song.universe) ?? [], { id: song.id, title: song.title, meta: songMeta(song) }]);
  return [...groups].map(([universe, links]) => ({ universe, songs: links.sort((a, b) => a.title.localeCompare(b.title, 'en')) }))
    .sort((a, b) => Number(b.universe === LEAD_UNIVERSE) - Number(a.universe === LEAD_UNIVERSE) || b.songs.length - a.songs.length || a.universe.localeCompare(b.universe, 'en'));
}

function linkList(siteUrl: string, songs: readonly SongLink[]): string {
  return `<ul>${songs.map(song => `<li><a href="${escapeHtml(songUrl(siteUrl, song.id))}">${escapeHtml(song.title)}</a> (${escapeHtml(song.meta)})</li>`).join('')}</ul>`;
}

/** Fill the markup's crawlable song list, read by search engines and AI crawlers that do not run the app. */
function withDirectory(html: string, content: string): string {
  const slot = /(<noscript id="song-directory">)(<\/noscript>)/;
  if (!slot.test(html)) throw new Error('index.html has no empty <noscript id="song-directory"> to list the songs in.');
  return html.replace(slot, (_match, open: string, close: string) => open + content + close);
}

function withStructuredData(html: string, data: unknown): string {
  const block = /(<script type="application\/ld\+json">)[^<]*(<\/script>)/;
  if (!block.test(html)) throw new Error('index.html has no structured data block to describe the page in.');
  return html.replace(block, (_match, open: string, close: string) => open + jsonLd(data) + close);
}

const INTRO = 'Ocarina Hero turns songs into button tabs for the ocarina of The Legend of Zelda: Ocarina of Time. Open a song to listen to it and practice it one passage at a time with a controller, the keyboard or the on-screen pad, free in your browser.';

/** The home page with every song listed by universe for crawlers that do not run scripts. */
export function homePageHtml(indexHtml: string, groups: readonly SongGroup[], siteUrl: string): string {
  const count = groups.reduce((sum, group) => sum + group.songs.length, 0);
  return withDirectory(indexHtml, `<section><h2>Songs to play on the Zelda ocarina</h2><p>${escapeHtml(INTRO)}</p><p>${count} songs:</p>${groups.map(group => `<h3>${escapeHtml(group.universe)}</h3>${linkList(siteUrl, group.songs)}`).join('')}</section>`);
}

/** A plain-text guide to the site for language models (https://llmstxt.org). */
export function llmsTxt(siteUrl: string, groups: readonly SongGroup[]): string {
  return `# Ocarina Hero\n\n> ${INTRO}\n\n`
    + 'Each song page shows the button tab of the melody (for example "L + D-pad down, R + D-pad down"), the number of notes and passages, and opens an interactive lesson that plays the melody and checks each note. The Workshop imports a MIDI file or a short recording as a new tab. Fan project, not affiliated with or endorsed by Nintendo.\n\n'
    + `## Pages\n\n- [Songbook](${siteUrl}): search and filter every song by category, universe and difficulty\n- [Sitemap](${siteUrl}sitemap.xml)\n\n`
    + groups.map(group => `## ${group.universe}\n\n${group.songs.map(song => `- [${song.title}](${songUrl(siteUrl, song.id)}): ${song.meta}`).join('\n')}`).join('\n\n') + '\n';
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
export function songPageHtml(indexHtml: string, song: SongPage, siteUrl: string, related: readonly SongLink[]): string {
  const title = escapeHtml(songDocumentTitle(song.title, song.meta));
  const plainDescription = `Learn to play ${song.title} (${song.meta}) on the Zelda ocarina of Ocarina of Time: follow the button tab, listen to it and practice one passage at a time. Free, in your browser.`;
  const description = escapeHtml(plainDescription);
  const url = songUrl(siteUrl, song.id);
  const address = escapeHtml(url);
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
  const described = values.reduce((html, [opening, value]) => {
    if (!opening.test(html)) throw new Error(`index.html has no tag matching ${opening} to describe a song page.`);
    return html.replace(opening, (_match, start: string) => start + value);
  }, indexHtml);
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', url, name: songDocumentTitle(song.title, song.meta), description: plainDescription, inLanguage: 'en',
        isPartOf: { '@id': `${siteUrl}#website` },
        about: { '@type': 'MusicComposition', name: song.title, description: song.meta },
        mainEntity: { '@type': 'CreativeWork', name: `${song.title} ocarina button tab`, text: song.tab },
      },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Ocarina Hero', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: song.title, item: url },
      ] },
    ],
  };
  const more = related.length ? `<h2>More ${escapeHtml(song.universe)} songs on the Zelda ocarina</h2>${linkList(siteUrl, related)}` : '';
  return withDirectory(withStructuredData(described, data), `<section>${more}<p><a href="${escapeHtml(siteUrl)}">Every song in the Ocarina Hero songbook</a></p></section>`);
}

export function sitemapXml(siteUrl: string, songIds: readonly string[]): string {
  const urls = [siteUrl, ...songIds.map(id => songUrl(siteUrl, id))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

/** Writes one page per song, the home's song list, the sitemap, robots.txt and llms.txt next to the built app shell. */
export function writeSongPages(outDir: string): void {
  const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8');
  const siteUrl = siteUrlOf(indexHtml);
  const songs = createSongbookEntries(DEMOS);
  const groups = songGroups(songs);
  for (const song of songs) {
    const directory = join(outDir, songPath('', song.id));
    mkdirSync(directory, { recursive: true });
    const related = groups.find(group => group.universe === song.universe)!.songs.filter(link => link.id !== song.id);
    writeFileSync(join(directory, 'index.html'), songPageHtml(indexHtml, songPageOf(song), siteUrl, related));
  }
  writeFileSync(join(outDir, 'index.html'), homePageHtml(indexHtml, groups, siteUrl));
  writeFileSync(join(outDir, 'llms.txt'), llmsTxt(siteUrl, groups));
  writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml(siteUrl, songs.map(song => song.id)));
  // The popularity Function only scores songs listed here.
  writeFileSync(join(outDir, 'song-ids.json'), JSON.stringify(songs.map(song => song.id)));
  writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);
}
