import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { DEMOS } from '../src/core/demo';
import { songDocumentTitle, songPath } from '../src/ui/route';
import { createSongbookEntries, songMeta } from '../src/ui/songbook';

export interface SongPage {
  readonly id: string;
  readonly title: string;
  /** Universe, artist and version, as shown under the title in the Songbook. */
  readonly meta: string;
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

/** The app shell with the head of one song: title, description, canonical address and share preview. */
export function songPageHtml(indexHtml: string, song: SongPage, siteUrl: string): string {
  const title = escapeHtml(songDocumentTitle(song.title));
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

/** After a build, writes one page per song, the sitemap and robots.txt next to the app shell. */
export function createSongPagesPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'song-pages',
    apply: 'build',
    configResolved(config) { outDir = join(config.root, config.build.outDir); },
    closeBundle() {
      const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8');
      const siteUrl = siteUrlOf(indexHtml);
      const songs = createSongbookEntries(DEMOS);
      for (const song of songs) {
        const directory = join(outDir, songPath('', song.id));
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, 'index.html'), songPageHtml(indexHtml, { id: song.id, title: song.title, meta: songMeta(song) }, siteUrl));
      }
      writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml(siteUrl, songs.map(song => song.id)));
      writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);
    },
  };
}
