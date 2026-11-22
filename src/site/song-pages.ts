import type { DifficultyLevel } from '../core/difficulty';
import type { DemoTrack } from '../core/demo';
import { toTabText } from '../core/tab';
import { createPassages, lessonDetails } from '../ui/lesson';
import { popularPath, songDocumentTitle, songPath } from '../ui/route';
import { openingNotes, songMeta, songTitleQualifier, type SongbookEntry } from '../ui/songbook';
import { hubName, hubPath, hubUrl, plural, ZELDA_UNIVERSE, type Hub } from './hubs';
import type { PageHead } from './site';

export interface SongPage {
  readonly id: string;
  readonly title: string;
  /** Universe, artist and version, as shown under the title in the Songbook. */
  readonly meta: string;
  /** Tells the page title apart from songs that share its name. */
  readonly qualifier: string;
  /** Shown above the lesson title. */
  readonly universe: string;
  /** Version and size of the arrangement, as a first visit shows them under the lesson title. */
  readonly details: string;
  readonly version?: string;
  readonly artist?: string;
  /** Thematic collections the songbook files the song under. */
  readonly collections: readonly string[];
  readonly noteCount: number;
  readonly passageCount: number;
  readonly difficulty: DifficultyLevel;
  /** Button tab of the arrangement the lesson opens with. */
  readonly tab: string;
}

export function songPageOf(song: SongbookEntry & { track: DemoTrack }): SongPage {
  const notes = openingNotes(song.track);
  const passageCount = createPassages(notes, song.track.tempoBpm, song.track.phraseStarts).length;
  return {
    id: song.id,
    title: song.title,
    meta: songMeta(song),
    qualifier: songTitleQualifier(song),
    universe: song.universe,
    details: lessonDetails(song.version, notes.length, passageCount).join(' · '),
    version: song.version, artist: song.artist, collections: song.collections ?? [], noteCount: notes.length, passageCount, difficulty: song.difficulty.level,
    tab: toTabText(notes, song.track.beatsPerBar, song.track.tempoBpm, { noteSeparator: ', ' }),
  };
}

/** A song as other pages link to it. */
export interface SongLink { readonly id: string; readonly title: string; readonly meta: string }
export interface SongGroup { readonly universe: string; readonly songs: readonly SongLink[] }

/** The franchise the app is named after leads; the other universes follow by size, then name. */
const LEAD_UNIVERSE = ZELDA_UNIVERSE;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!);
}

export function songGroups(songs: readonly SongbookEntry[]): SongGroup[] {
  const groups = new Map<string, SongLink[]>();
  for (const song of songs) groups.set(song.universe, [...groups.get(song.universe) ?? [], { id: song.id, title: song.title, meta: songMeta(song) }]);
  return [...groups].map(([universe, links]) => ({ universe, songs: links.sort((a, b) => a.title.localeCompare(b.title, 'en')) }))
    .sort((a, b) => Number(b.universe === LEAD_UNIVERSE) - Number(a.universe === LEAD_UNIVERSE) || b.songs.length - a.songs.length || a.universe.localeCompare(b.universe, 'en'));
}

export function songUrl(siteUrl: string, id: string): string {
  return new URL(songPath('', id), siteUrl).href;
}

export function popularUrl(siteUrl: string): string {
  return new URL(popularPath(''), siteUrl).href;
}

function linkList(siteUrl: string, songs: readonly SongLink[]): string {
  return `<ul>${songs.map(song => `<li><a href="${escapeHtml(songUrl(siteUrl, song.id))}">${escapeHtml(song.title)}</a> (${escapeHtml(song.meta)})</li>`).join('')}</ul>`;
}

const INTRO = 'Ocarina Hero turns songs into button tabs for the ocarina of The Legend of Zelda: Ocarina of Time. Open a song to listen to it and practice it one passage at a time with a controller, the keyboard or the on-screen pad, free in your browser.';

/** Every song listed by universe, for crawlers that do not run scripts: the home page's <noscript> content. */
export function homeDirectoryHtml(groups: readonly SongGroup[], siteUrl: string, hubs: readonly Hub[] = []): string {
  const count = groups.reduce((sum, group) => sum + group.songs.length, 0);
  const hubLink = (hub: Hub, text: string) => `<a href="${escapeHtml(hubUrl(siteUrl, hub))}">${escapeHtml(text)}</a>`;
  const guides = hubs.filter(hub => hub.kind !== 'universe');
  const guideLinks = guides.length ? `<p>Guides: ${guides.map(hub => hubLink(hub, hub.h1)).join(', ')}.</p>` : '';
  const more = (universe: string) => {
    const hub = hubs.find(candidate => candidate.path === hubPath(universe));
    return hub ? `<p>${hubLink(hub, `All ${hub.name}`)}</p>` : '';
  };
  return `<section><h2>Songs to play on the Zelda ocarina</h2><p>${escapeHtml(INTRO)}</p>${guideLinks}<p>${count} songs:</p>${groups.map(group => `<h3>${escapeHtml(group.universe)}</h3>${linkList(siteUrl, group.songs)}${more(group.universe)}`).join('')}</section>`;
}

/** The songs of a song's universe other than itself. */
export function relatedSongs(groups: readonly SongGroup[], song: Pick<SongPage, 'id' | 'universe'>): SongLink[] {
  return (groups.find(group => group.universe === song.universe)?.songs ?? []).filter(link => link.id !== song.id);
}

/** A plain-text guide to the site for language models (https://llmstxt.org). */
export function llmsTxt(siteUrl: string, groups: readonly SongGroup[], hubs: readonly Hub[] = []): string {
  return `# Ocarina Hero\n\n> ${INTRO}\n\n`
    + 'Each song page shows the button tab of the melody (for example "L + D-pad down, R + D-pad down"), the number of notes and passages, and opens an interactive lesson that plays the melody and checks each note. The Workshop imports a MIDI file or a short recording as a new tab. Fan project, not affiliated with or endorsed by Nintendo.\n\n'
    + `## Pages\n\n- [Songbook](${siteUrl}): search and filter every song by category, universe and difficulty\n- [Most popular](${popularUrl(siteUrl)}): the songs players practice most, ranked by plays\n- [Sitemap](${siteUrl}sitemap.xml)\n\n`
    + (hubs.length ? `## Hubs\n\n${hubs.filter(hub => hub.indexable).map(hub => `- [${hub.h1}](${hubUrl(siteUrl, hub)}): ${plural(hub.songIds.length, 'song')}`).join('\n')}\n\n` : '')
    + groups.map(group => `## ${group.universe}\n\n${group.songs.map(song => `- [${song.title}](${songUrl(siteUrl, song.id)}): ${song.meta}`).join('\n')}`).join('\n\n') + '\n';
}

export function robotsTxt(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`;
}

/** What a song page tells search engines and link previews: title, description, canonical address and structured data; `modified` is the day (YYYY-MM-DD) its notes last changed, when known. */
export function songHead(song: SongPage, siteUrl: string, modified?: string): PageHead {
  const title = songDocumentTitle(song.title, song.qualifier);
  const description = `How to play ${song.title} (${song.meta}) on the Zelda ocarina: button tabs and notes for the ocarina of Ocarina of Time. Listen, then practice one passage at a time. Free, in your browser.`;
  const url = songUrl(siteUrl, song.id);
  return {
    title, description, url, shareTitle: title,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage', url, name: title, description, inLanguage: 'en',
          isPartOf: { '@id': `${siteUrl}#website` },
          ...modified && { dateModified: modified },
          about: { '@type': 'MusicComposition', name: song.title, description: song.meta },
          mainEntity: { '@type': 'CreativeWork', name: `${song.title} ocarina button tab`, text: song.tab },
        },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ocarina Hero', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: hubName(song.universe), item: new URL(hubPath(song.universe), siteUrl).href },
          { '@type': 'ListItem', position: 3, name: song.title, item: url },
        ] },
      ],
    },
  };
}

/**
 * The sitemap: the home, the Popular page and every song. `lastModified` maps a song id to the day (YYYY-MM-DD) its notes last changed;
 * the home carries the newest of them. Songs without a known day omit the tag rather than claim one.
 */
export function sitemapXml(siteUrl: string, songIds: readonly string[], lastModified: ReadonlyMap<string, string> = new Map(), hubs: readonly Hub[] = []): string {
  const newest = [...lastModified.values()].sort().at(-1);
  const entries = [
    { url: siteUrl, day: newest },
    { url: popularUrl(siteUrl), day: undefined },
    ...songIds.map(id => ({ url: songUrl(siteUrl, id), day: lastModified.get(id) })),
    // A hub changes when its newest song does; one that is kept out of the index stays out of the sitemap.
    ...hubs.filter(hub => hub.indexable).map(hub => ({ url: hubUrl(siteUrl, hub), day: hub.songIds.map(id => lastModified.get(id)).filter(Boolean).sort().at(-1) })),
  ];
  const lines = entries.map(({ url, day }) => `  <url><loc>${escapeHtml(url)}</loc>${day ? `<lastmod>${day}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join('\n')}\n</urlset>\n`;
}
