import { songPath } from '../ui/route';
import { universeLabel } from '../ui/songbook';
import type { PageHead } from './site';
import type { SongPage } from './song-pages';

/** The franchise the app is named after: its hub lists every song with its tab, at its own address. */
export const ZELDA_UNIVERSE = 'The Legend of Zelda';
/** The games whose songs lead the Zelda hub, in this order (names as the songbook spells them). */
export const OCARINA_GAMES = ['Ocarina of Time', 'Majora’s Mask'] as const;
/** A hub with fewer songs is too thin to rank: it is linked but kept out of the index and the sitemap. */
export const MIN_INDEXED_SONGS = 3;
/** The notes of a song's tab the Zelda hub shows before it sends the reader to the lesson. */
export const OPENING_NOTES = 12;

const ZELDA_PATH = 'zelda-ocarina-songs/';

/** URL-safe name of a universe: lowercase ASCII words joined by hyphens. */
export function universeSlug(universe: string): string {
  const slug = universe.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) throw new Error(`The universe "${universe}" has no ASCII letters or digits to build a hub address from`);
  return slug;
}

/** Address of a universe's hub below the site root, ending with a slash. */
export function hubPath(universe: string): string {
  return universe === ZELDA_UNIVERSE ? ZELDA_PATH : `songs/${universeSlug(universe)}/`;
}

/** The name a hub goes by in a breadcrumb trail and a link. */
export function hubName(universe: string): string {
  return `${universeLabel(universe)} songs`;
}

/** A thematic collection: songs from several universes that a search for the theme should find together. */
export interface Collection {
  readonly name: string;
  readonly title: string;
  readonly h1: string;
  readonly description: string;
  readonly intro: string;
}
/** The collections a song may declare in the songbook, by slug; the slug is the address `songs/<slug>/`. */
export const COLLECTIONS: Readonly<Record<string, Collection>> = {
  christmas: {
    name: 'Christmas songs',
    title: 'Christmas Songs on the Zelda Ocarina: Button Tabs',
    h1: 'Christmas songs on the ocarina',
    description: 'Play Christmas songs and carols on the Zelda ocarina: button tabs and notes for classics and pop hits. Listen, then practice one passage at a time. Free, in your browser.',
    intro: 'Christmas carols and holiday hits as button tabs for the ocarina of The Legend of Zelda: Ocarina of Time. Open one to listen to it and practice it one passage at a time.',
  },
};

export interface HubSong {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  /** Opening notes of the button tab, on the ocarina hub only. */
  readonly tab?: string;
  /** The tab stops before the song's last note. */
  readonly tabCut?: boolean;
}
export interface HubSection { readonly heading: string; readonly songs: readonly HubSong[] }
export interface Hub {
  readonly kind: 'zelda' | 'universe' | 'collection';
  /** Below the site root, ending with a slash. */
  readonly path: string;
  readonly name: string;
  readonly title: string;
  readonly h1: string;
  readonly description: string;
  readonly intro: string;
  readonly sections: readonly HubSection[];
  readonly songIds: readonly string[];
  readonly indexable: boolean;
}

export const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;
const byTitle = (a: { title: string }, b: { title: string }): number => a.title.localeCompare(b.title, 'en');

const idsOf = (sections: readonly HubSection[]): string[] => sections.flatMap(section => section.songs.map(song => song.id));

function hubSong(page: SongPage, withTab: boolean, underItsGame = false): HubSong {
  const detail = [page.artist, underItsGame ? undefined : page.version].filter(Boolean).join(' · ');
  if (!withTab) return { id: page.id, title: page.title, detail };
  const notes = page.tab.split(', ');
  return { id: page.id, title: page.title, detail, tab: notes.slice(0, OPENING_NOTES).join(', '), tabCut: notes.length > OPENING_NOTES };
}

/** Songs grouped by version; the ocarina games lead, the other versions follow by size, then name, and songs without one come last. */
function byGame(songs: readonly SongPage[], withTab: boolean): HubSection[] {
  const games = new Map<string, SongPage[]>();
  for (const song of songs) games.set(song.version ?? '', [...games.get(song.version ?? '') ?? [], song]);
  const rank = (game: string): number => (OCARINA_GAMES as readonly string[]).indexOf(game);
  return [...games].sort(([a, listA], [b, listB]) =>
    Number(a === '') - Number(b === '') || Number(rank(b) >= 0) - Number(rank(a) >= 0) || rank(a) - rank(b) || listB.length - listA.length || a.localeCompare(b, 'en'))
    .map(([game, list]) => ({ heading: game || 'Other Zelda songs', songs: list.map(song => hubSong(song, withTab, true)).sort(byTitle) }));
}

function zeldaHub(zelda: readonly SongPage[]): Hub {
  const sections = byGame(zelda, true);
  const split = sections.filter(section => (OCARINA_GAMES as readonly string[]).includes(section.heading)).map(section => `${section.songs.length} from ${section.heading}`).join(', ');
  return {
    kind: 'zelda', path: ZELDA_PATH, name: 'Zelda ocarina songs',
    title: 'Zelda Ocarina Songs: Ocarina of Time Button Tabs by Game',
    h1: 'Zelda ocarina songs',
    description: `Button tabs for ${plural(zelda.length, 'Zelda song')} on the ocarina, grouped by game: ${split} and more. Each tab is on the page; open a song to listen and practice it one passage at a time. Free, in your browser.`,
    intro: `${plural(zelda.length, 'song')} from The Legend of Zelda to play on the ocarina, grouped by game: ${split} and more. Each one lists the controller buttons of its melody in order; a plus sign joins buttons held together. Long songs show their opening notes here and the whole melody in the lesson.`,
    sections, songIds: idsOf(sections), indexable: zelda.length >= MIN_INDEXED_SONGS,
  };
}

function universeHub(universe: string, songs: readonly SongPage[]): Hub {
  const name = universeLabel(universe);
  const sections = [{ heading: `${name} songs`, songs: songs.map(song => hubSong(song, false)).sort(byTitle) }];
  return {
    kind: 'universe', path: hubPath(universe), name: hubName(universe),
    title: `${name} Songs: Ocarina of Time Button Tabs`,
    h1: `${name} songs`,
    description: `Play ${plural(songs.length, `${name} song`)} on the Zelda ocarina: button tabs and notes for the ocarina of Ocarina of Time. Listen, then practice one passage at a time. Free, in your browser.`,
    intro: `${plural(songs.length, `${name} song`)} as button tabs for the ocarina of The Legend of Zelda: Ocarina of Time. Open one to listen to it and practice it one passage at a time.`,
    sections, songIds: idsOf(sections), indexable: songs.length >= MIN_INDEXED_SONGS,
  };
}

function collectionHub(slug: string, songs: readonly SongPage[]): Hub {
  const collection = COLLECTIONS[slug]!;
  const sections = [{ heading: collection.name, songs: songs.map(song => hubSong(song, false)).sort(byTitle) }];
  return {
    kind: 'collection', path: `songs/${slug}/`, name: collection.name,
    title: collection.title, h1: collection.h1, description: collection.description, intro: collection.intro,
    sections, songIds: idsOf(sections), indexable: songs.length >= MIN_INDEXED_SONGS,
  };
}

/** Every hub of the site, built from the songbook's pages: the Zelda hub first, then a hub per collection a song declares, then a hub per other universe. Throws when a song names an unknown collection or two hubs would share an address. */
export function buildHubs(pages: readonly SongPage[]): Hub[] {
  const universes = new Map<string, SongPage[]>();
  for (const page of pages) universes.set(page.universe, [...universes.get(page.universe) ?? [], page]);
  const zelda = universes.get(ZELDA_UNIVERSE) ?? [];
  const hubs: Hub[] = zelda.length ? [zeldaHub(zelda)] : [];
  for (const [universe, songs] of [...universes].sort(([a, listA], [b, listB]) => listB.length - listA.length || a.localeCompare(b, 'en'))) {
    if (universe !== ZELDA_UNIVERSE) hubs.push(universeHub(universe, songs));
  }
  const collections = new Map<string, SongPage[]>();
  for (const page of pages) for (const slug of page.collections) {
    if (!COLLECTIONS[slug]) throw new Error(`The song "${page.id}" names the unknown collection "${slug}"`);
    collections.set(slug, [...collections.get(slug) ?? [], page]);
  }
  hubs.splice(zelda.length ? 1 : 0, 0, ...Object.keys(COLLECTIONS).filter(slug => collections.has(slug)).map(slug => collectionHub(slug, collections.get(slug)!)));
  const seen = new Map<string, string>();
  for (const hub of hubs) {
    if (seen.has(hub.path)) throw new Error(`The hubs "${seen.get(hub.path)}" and "${hub.name}" share the address ${hub.path}`);
    seen.set(hub.path, hub.name);
  }
  return hubs;
}

export const hubUrl = (siteUrl: string, hub: Pick<Hub, 'path'>): string => new URL(hub.path, siteUrl).href;

/** What a hub tells search engines and link previews: title, description, canonical address, robots and structured data. */
export function hubHead(hub: Hub, siteUrl: string): PageHead {
  const url = hubUrl(siteUrl, hub);
  return {
    title: hub.title, description: hub.description, url, shareTitle: hub.title,
    ...!hub.indexable && { robots: 'noindex,follow' },
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage', url, name: hub.title, description: hub.description, inLanguage: 'en',
          isPartOf: { '@id': `${siteUrl}#website` },
          mainEntity: {
            '@type': 'ItemList', numberOfItems: hub.songIds.length,
            itemListElement: hub.songIds.map((id, index) => ({ '@type': 'ListItem', position: index + 1, url: new URL(songPath('', id), siteUrl).href })),
          },
        },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ocarina Hero', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: hub.name, item: url },
        ] },
      ],
    },
  };
}
