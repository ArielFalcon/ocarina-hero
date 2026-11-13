import type { ThreadIcon } from './thread-icons';
import type { DemoTrack } from '../core/demo';
import { rateDifficulty, type Difficulty, type DifficultyLevel } from '../core/difficulty';
import { prepareMelody } from '../core/prepare';

export type SongCategory = 'All' | 'Games' | 'Anime' | 'Film' | 'Pop' | 'Classics' | 'Other';
type EntryCategory = Exclude<SongCategory, 'All'>;

export interface SongbookEntry {
  track: DemoTrack;
  id: string;
  title: string;
  universe: string;
  categories: readonly EntryCategory[];
  icon: ThreadIcon;
  /** The universe's own mark; `icon` may vary per song. */
  universeIcon: ThreadIcon;
  version?: string;
  artist?: string;
  aliases: readonly string[];
  /** Rated on the arrangement the lesson opens with: bends on, ornaments kept. */
  difficulty: Difficulty;
}

type Metadata = Omit<SongbookEntry, 'track' | 'id' | 'difficulty'>;
const metadata = new Map<string, Metadata>();

function group(universe: string, categories: readonly EntryCategory[], icon: ThreadIcon,
  songs: readonly (readonly [id: string, title: string, extra?: Partial<Pick<Metadata, 'version' | 'artist' | 'aliases' | 'icon'>>])[]): void {
  for (const [id, title, extra] of songs) {
    metadata.set(id, { universe, categories, icon, universeIcon: icon, title, aliases: [], ...extra });
  }
}

// Display rules: `title` is the song name only; the card shows `universe · version`.
// `artist` is displayed only in the generic Pop and Classics collections; composers of a
// franchise are kept searchable as aliases instead.

// Games
group('The Legend of Zelda', ['Games'], 'triforce', [
  ['lullaby-game', 'Zelda’s Lullaby', { version: 'Complete, adapted', aliases: ['Lullaby'] }],
  ['lullaby-trigger', 'Zelda’s Lullaby', { version: 'Manual trigger', aliases: ['Lullaby'] }],
  ['catalogue-gerudo-valley', 'Gerudo Valley'],
  ['catalogue-fairy-fountain', 'Great Fairy Fountain'],
  ['catalogue-zelda-secret-discovered', 'Secret Discovered', { version: 'A Link to the Past', aliases: ['Found Secret', 'Secret Sound', 'Koji Kondo'] }],
  ['catalogue-ww-title-theme', 'Title Theme', { version: 'The Wind Waker', aliases: ['Kenta Nagata', 'Wind Waker Title'] }],
  ['catalogue-mm-clock-town-day1', 'Clock Town', { version: 'Majora’s Mask', aliases: ['Clock Town Day 1', 'Koji Kondo', 'First Day', 'Clock Town, First Day'] }],
  ['catalogue-alttp-kakariko-village', 'Kakariko Village', { version: 'A Link to the Past', aliases: ['Koji Kondo'] }],
  ['catalogue-oot-bolero-of-fire', 'Bolero of Fire', { version: 'Ocarina of Time', aliases: ['Koji Kondo', 'Warp song'] }],
  ['catalogue-oot-minuet-of-forest', 'Minuet of Forest', { version: 'Ocarina of Time', aliases: ['Koji Kondo', 'Warp song'] }],
]);
group('Pokémon', ['Games'], 'pokeball', [
  ['catalogue-pokemon-route1', 'Route 1'],
  ['catalogue-pallet-town', 'Pallet Town'],
  ['catalogue-lavender-town', 'Lavender Town'],
  ['littleroot', 'Littleroot Town'],
  ['catalogue-pokemon-caught', 'Wild Pokémon Caught', { version: 'Red / Blue / Yellow', aliases: ['Capture fanfare'] }],
  ['catalogue-pokemon-gym-victory', 'Gym Battle Victory', { version: 'Gold / Silver' }],
  ['catalogue-pokemon-rby-bicycle', 'Cycling', { version: 'Red / Blue / Yellow', aliases: ['Bicycle', 'Bike Riding', 'Junichi Masuda'] }],
  ['catalogue-pokemon-rby-celadon-city', 'Celadon City', { version: 'Red / Blue / Yellow', aliases: ['Junichi Masuda'] }],
]);
group('Undertale', ['Games'], 'heart', [
  ['catalogue-megalovania', 'Megalovania'],
  ['catalogue-once-upon-a-time', 'Once Upon a Time'],
  ['catalogue-fallen-down', 'Fallen Down'],
]);
group('Tetris', ['Games'], 'tetromino', [['catalogue-tetris', 'Music A', { aliases: ['Korobeiniki'] }]]);
group('Sonic', ['Games'], 'ring', [
  ['catalogue-green-hill', 'Green Hill Zone', { version: 'Sonic the Hedgehog' }],
  ['catalogue-sonic-extra-life', 'Extra Life', { version: 'Sonic the Hedgehog', aliases: ['1UP'] }],
  ['catalogue-sonic3-act-complete', 'Act Complete', { version: 'Sonic the Hedgehog 3' }],
  ['catalogue-sonic2-emerald-hill', 'Emerald Hill Zone', { version: 'Sonic the Hedgehog 2', aliases: ['Masato Nakamura'] }],
]);
group('Super Mario', ['Games'], 'mushroom', [
  ['catalogue-dire-dire-docks', 'Dire, Dire Docks', { version: 'Super Mario 64' }],
  ['catalogue-smb-world-clear', 'Castle Clear', { version: 'Super Mario Bros.', aliases: ['World Clear'] }],
  ['catalogue-smb-game-over', 'Game Over', { version: 'Super Mario Bros.' }],
  ['catalogue-smw-overworld', 'Overworld', { version: 'Super Mario World', aliases: ['Koji Kondo'] }],
]);
group('Metroid', ['Games'], 'gamepad', [['catalogue-super-metroid-item', 'Item Acquisition', { version: 'Super Metroid' }]]);
group('Donkey Kong Country', ['Games'], 'gamepad', [
  ['catalogue-dkc-bonus-win', 'Bonus Win', { aliases: ['Boss Defeated', 'Bonus Victory'] }],
]);
group('Final Fantasy VII', ['Games'], 'meteor', [['catalogue-ff7-victory', 'Victory Fanfare', { aliases: ['FF7'] }]]);
group('Chrono Trigger', ['Games'], 'clock', [['catalogue-wind-scene', 'Wind Scene']]);
group('Minecraft', ['Games'], 'grassBlock', [
  ['catalogue-wet-hands', 'Wet Hands', { aliases: ['C418'] }],
  ['catalogue-sweden', 'Sweden', { aliases: ['C418'] }],
]);
group('Wii', ['Games'], 'remote', [['catalogue-mii-channel', 'Mii Channel']]);
group('EarthBound', ['Games'], 'gamepad', [
  ['catalogue-earthbound-eight-melodies', 'Eight Melodies', { aliases: ['Mother 2', 'Keiichi Suzuki', 'Hirokazu Tanaka'] }],
]);
group('Castlevania', ['Games'], 'gamepad', [
  ['catalogue-castlevania-ii-bloody-tears', 'Bloody Tears', { version: 'Castlevania II: Simon’s Quest', aliases: ['Kenichi Matsubara'] }],
]);
group('Kirby', ['Games'], 'gamepad', [
  ['catalogue-kirby-butter-building', 'Butter Building', { version: 'Kirby’s Adventure', aliases: ['Hirokazu Ando'] }],
]);
group('Professor Layton', ['Games'], 'gamepad', [
  ['catalogue-layton-theme', 'Professor Layton’s Theme', { version: 'Professor Layton and the Curious Village', aliases: ['Tomohito Nishiura', 'Layton’s Theme'] }],
]);

// Anime
group('Naruto', ['Anime'], 'leaf', [
  ['catalogue-naruto', 'Sadness and Sorrow'],
  ['catalogue-blue-bird', 'Blue Bird', { version: 'Shippuden', aliases: ['Ikimono-gakari'] }],
]);
group('Neon Genesis Evangelion', ['Anime'], 'unit', [['catalogue-evangelion', 'A Cruel Angel’s Thesis', { aliases: ['Evangelion'] }]]);
group('Elfen Lied', ['Anime'], 'lily', [['catalogue-lilium', 'Lilium']]);
group('Death Note', ['Anime'], 'notebook', [['catalogue-l-theme', 'L’s Theme']]);
group('Sailor Moon', ['Anime'], 'moon', [['catalogue-moonlight', 'Moonlight Densetsu']]);
group('Dragon Ball Z', ['Anime'], 'dragonball', [['catalogue-tapion', 'Tapion’s Theme']]);
group('Attack on Titan', ['Anime'], 'wings', [['catalogue-shinzou', 'Shinzou wo Sasageyo!']]);
group('Jujutsu Kaisen', ['Anime'], 'anime', [['catalogue-aizo', 'AIZO', { version: 'Culling Game opening', aliases: ['King Gnu'] }]]);
group('Dandadan', ['Anime'], 'anime', [['catalogue-kakumei-douchuu', 'Kakumei Douchuu', { version: 'Season 2 opening', aliases: ['On The Way', 'AiNA THE END'] }]]);
group('Chainsaw Man', ['Anime', 'Film'], 'anime', [['catalogue-iris-out', 'IRIS OUT', { version: 'The Movie: Reze Arc', aliases: ['Kenshi Yonezu'] }]]);
group('Orb: On the Movements of the Earth', ['Anime'], 'anime', [['catalogue-kaiju', 'Kaiju', { version: 'Opening', aliases: ['Sakanaction', 'Chi'] }]]);
group('Detective Conan', ['Anime'], 'anime', [
  ['catalogue-detective-conan-main-theme', 'Main Theme', { aliases: ['Katsuo Ono', 'Detective Conan Main Theme', 'Case Closed', '名探偵コナン メイン・テーマ'] }],
]);
group('Studio Ghibli', ['Anime', 'Film'], 'forestSpirit', [
  ['catalogue-laputa', 'Main Theme', { version: 'Castle in the Sky', aliases: ['Laputa'] }],
  ['catalogue-always-with-me', 'Always With Me', { version: 'Spirited Away' }],
  ['catalogue-merry-go-round', 'Merry-Go-Round of Life', { version: 'Howl’s Moving Castle' }],
  ['catalogue-totoro', 'Tonari no Totoro', { version: 'My Neighbor Totoro' }],
  ['catalogue-mononoke-hime-song', 'Mononoke Hime', { version: 'Princess Mononoke', aliases: ['Joe Hisaishi', 'Yoshikazu Mera', 'Princess Mononoke Theme', 'もののけ姫'] }],
  ['catalogue-path-of-the-wind-totoro', 'Path of the Wind', { version: 'My Neighbor Totoro', aliases: ['Joe Hisaishi', 'Kaze no Toorimichi', '風のとおり道'] }],
  ['catalogue-nausicaa-legend-of-the-wind', 'Legend of the Wind', { version: 'Nausicaä of the Valley of the Wind', aliases: ['Joe Hisaishi', 'Kaze no Densetsu', '風の伝説', 'Nausicaä Opening Theme'] }],
]);

// Film and TV
group('KPop Demon Hunters', ['Film', 'Pop'], 'hunter', [['catalogue-golden', 'Golden', { aliases: ['HUNTR/X'] }]]);
group('Star Wars', ['Film'], 'empire', [
  ['catalogue-imperial-march', 'The Imperial March', { aliases: ['John Williams'] }],
  ['catalogue-mandalorian', 'Main Theme', { version: 'The Mandalorian', aliases: ['Ludwig Göransson'], icon: 'film' }],
]);
group('Pirates of the Caribbean', ['Film'], 'pirate', [['catalogue-pirate', 'He’s a Pirate', { aliases: ['Hans Zimmer', 'Klaus Badelt'] }]]);
group('Harry Potter', ['Film'], 'wizard', [['catalogue-hedwig', 'Hedwig’s Theme', { aliases: ['John Williams'] }]]);
group('The Lord of the Rings', ['Film'], 'film', [
  ['catalogue-concerning-hobbits', 'Concerning Hobbits', { aliases: ['Howard Shore'] }],
  ['catalogue-evenstar', 'Evenstar', { aliases: ['Howard Shore'] }],
  ['catalogue-may-it-be', 'May It Be', { aliases: ['Enya'] }],
]);
group('Indiana Jones', ['Film'], 'film', [['catalogue-raiders-march', 'The Raiders March', { aliases: ['John Williams'] }]]);
group('Jurassic Park', ['Film'], 'film', [['catalogue-jurassic-park', 'Main Theme', { aliases: ['John Williams'] }]]);
group('James Bond', ['Film'], 'film', [['catalogue-james-bond', 'Main Theme', { aliases: ['James Bond Theme', 'Monty Norman'] }]]);
group('Mission: Impossible', ['Film'], 'film', [['catalogue-mission-impossible', 'Main Theme', { aliases: ['Lalo Schifrin'] }]]);
group('The Pink Panther', ['Film'], 'film', [['catalogue-pink-panther', 'Main Theme', { aliases: ['Henry Mancini'] }]]);
group('Chariots of Fire', ['Film'], 'film', [['catalogue-chariots-of-fire', 'Main Theme', { aliases: ['Vangelis'] }]]);
group('Rocky', ['Film'], 'film', [['catalogue-gonna-fly-now', 'Gonna Fly Now', { aliases: ['Bill Conti'] }]]);
group('Interstellar', ['Film'], 'film', [['catalogue-cornfield-chase', 'Cornfield Chase', { aliases: ['Hans Zimmer'] }]]);
group('The X-Files', ['Film'], 'film', [['catalogue-x-files', 'Main Theme', { aliases: ['Mark Snow'] }]]);
group('Knight Rider', ['Film'], 'film', [['catalogue-knight-rider', 'Main Theme', { aliases: ['Stu Phillips'] }]]);
group('The Simpsons', ['Film'], 'film', [['catalogue-simpsons', 'Main Theme', { aliases: ['Danny Elfman'] }]]);
group('The Good, the Bad and the Ugly', ['Film'], 'film', [
  ['catalogue-good-bad-ugly-main-theme', 'Main Theme', { aliases: ['Ennio Morricone', 'Il buono, il brutto, il cattivo'] }],
]);
group('The Godfather', ['Film'], 'film', [
  ['catalogue-godfather-love-theme', 'Love Theme', { aliases: ['Nino Rota', 'Speak Softly, Love', 'Love Theme from The Godfather'] }],
]);
group('El Chavo del Ocho', ['Film'], 'film', [
  ['catalogue-el-chavo-del-ocho-theme', 'Main Theme', { aliases: ['The Elephant Never Forgets', 'Jean-Jacques Perrey', 'Marcha turca', 'Turkish March', 'Ludwig van Beethoven', 'Chespirito'] }],
]);
group('The Flintstones', ['Film'], 'film', [
  ['catalogue-meet-the-flintstones', 'Meet the Flintstones', { aliases: ['Hoyt Curtin', 'The Flintstones Theme'] }],
]);
group('The Jungle Book', ['Film'], 'film', [
  ['catalogue-bare-necessities', 'The Bare Necessities', { version: '1967 film', aliases: ['Terry Gilkyson', 'Phil Harris', 'Bare Necessities'] }],
]);
group('Disney Parks', ['Film'], 'film', [
  ['catalogue-its-a-small-world', 'It’s a Small World', { version: '1964 attraction', aliases: ['Sherman Brothers', 'Richard M. Sherman', 'Robert B. Sherman', 'Small World', 'Its a Small World'] }],
]);
group('Animaniacs', ['Film'], 'film', [
  ['catalogue-animaniacs-theme', 'Main Theme', { version: 'TV series (1993)', aliases: ['Richard Stone', 'Tom Ruegger', 'Animaniacs Theme', 'It’s Time for Animaniacs'] }],
]);
group('Winnie the Pooh', ['Film'], 'film', [
  ['catalogue-winnie-the-pooh-theme', 'Winnie the Pooh', { version: 'Winnie the Pooh and the Honey Tree (1966)', aliases: ['Sherman Brothers', 'Richard M. Sherman', 'Robert B. Sherman', 'Winnie the Pooh Theme'] }],
]);

// Pop: no franchise, so the artist is the context shown with each song.
group('Pop', ['Pop'], 'microphone', [
  ['catalogue-never-gonna', 'Never Gonna Give You Up', { artist: 'Rick Astley', icon: 'heart' }],
  ['catalogue-take-on-me', 'Take On Me', { artist: 'a-ha', icon: 'cassette' }],
  ['catalogue-final-countdown', 'The Final Countdown', { artist: 'Europe', icon: 'rocket' }],
  ['catalogue-numb', 'Numb', { artist: 'Linkin Park', icon: 'waveform' }],
  ['v1', 'In the End', { artist: 'Linkin Park', icon: 'hourglass' }],
  ['catalogue-all-star', 'All Star', { artist: 'Smash Mouth', icon: 'star' }],
  ['catalogue-eye-of-the-tiger', 'Eye of the Tiger', { artist: 'Survivor' }],
  ['catalogue-everybody-wants-to-rule-the-world', 'Everybody Wants to Rule the World', { artist: 'Tears for Fears' }],
  ['catalogue-smooth-criminal', 'Smooth Criminal', { artist: 'Michael Jackson' }],
  ['catalogue-gimme-gimme-gimme', 'Gimme! Gimme! Gimme!', { artist: 'ABBA' }],
  ['catalogue-another-one-bites-the-dust', 'Another One Bites the Dust', { artist: 'Queen', icon: 'waveform' }],
  ['catalogue-seven-nation-army', 'Seven Nation Army', { artist: 'The White Stripes', icon: 'waveform' }],
  ['catalogue-children', 'Children', { artist: 'Robert Miles', icon: 'cassette' }],
  ['catalogue-sandstorm', 'Sandstorm', { artist: 'Darude', icon: 'waveform' }],
  ['catalogue-astronomia', 'Astronomia', { artist: 'Vicetone & Tony Igy', aliases: ['Coffin Dance'], icon: 'cassette' }],
  ['catalogue-blinding-lights', 'Blinding Lights', { artist: 'The Weeknd', icon: 'cassette' }],
  ['catalogue-fate-of-ophelia', 'The Fate of Ophelia', { artist: 'Taylor Swift', icon: 'flower' }],
  ['catalogue-stateside', 'Stateside', { artist: 'PinkPantheress & Zara Larsson' }],
  ['catalogue-man-i-need', 'Man I Need', { artist: 'Olivia Dean' }],
  ['catalogue-wind-of-change-whistle', 'Wind of Change', { artist: 'Scorpions', aliases: ['Klaus Meine'], icon: 'leaf' }],
  ['catalogue-cant-help-falling-in-love', 'Can’t Help Falling in Love', { artist: 'Elvis Presley', aliases: ['Cant Help Falling in Love'], icon: 'heart' }],
  ['catalogue-hey-jude-opening', 'Hey Jude', { artist: 'The Beatles', aliases: ['Lennon-McCartney', 'Paul McCartney'] }],
  ['catalogue-lambada', 'Lambada', { artist: 'Kaoma', aliases: ['Chorando se foi', 'Llorando se fue', 'Los Kjarkas', 'Gonzalo Hermosa', 'Ulises Hermosa'], icon: 'waveform' }],
]);

// Classics
group('Classics', ['Classics'], 'lyre', [
  ['ode', 'Ode to Joy', { artist: 'Ludwig van Beethoven', aliases: ['Beethoven'] }],
  ['birthday', 'Happy Birthday', { artist: 'Traditional', icon: 'cake' }],
  ['twinkle', 'Twinkle, Twinkle, Little Star', { artist: 'Traditional', aliases: ['Twinkle Twinkle'], icon: 'star' }],
  ['catalogue-hall-of-the-mountain-king', 'In the Hall of the Mountain King', { artist: 'Edvard Grieg', version: 'Peer Gynt', aliases: ['Grieg', 'I Dovregubbens hall'] }],
  ['catalogue-fur-elise', 'Für Elise', { artist: 'Ludwig van Beethoven', aliases: ['Beethoven', 'Fur Elise', 'Bagatelle WoO 59'] }],
  ['catalogue-eine-kleine-nachtmusik', 'Eine kleine Nachtmusik', { artist: 'Wolfgang Amadeus Mozart', aliases: ['Mozart', 'Serenade K. 525'] }],
  ['catalogue-vivaldi-spring-ritornello', 'Spring', { artist: 'Antonio Vivaldi', version: 'The Four Seasons, I. Allegro', aliases: ['Vivaldi', 'La Primavera', 'The Four Seasons', 'Le quattro stagioni', 'RV 269', 'Op. 8 No. 1'], icon: 'flower' }],
  ['catalogue-mozart-rondo-alla-turca', 'Rondo alla Turca', { artist: 'Wolfgang Amadeus Mozart', version: 'Piano Sonata No. 11, K. 331', aliases: ['Mozart', 'Turkish March', 'Alla Turca', 'K. 331', 'Marcia alla turca'] }],
  ['catalogue-bach-minuet-in-g', 'Minuet in G', { artist: 'Christian Petzold', version: 'Notebook for Anna Magdalena Bach, BWV Anh. 114', aliases: ['Johann Sebastian Bach', 'Bach', 'BWV Anh. 114', 'Minuet in G major', 'Menuet', 'Petzold'] }],
  ['catalogue-greensleeves-verse', 'Greensleeves', { artist: 'Traditional', aliases: ['Green Sleeves', 'English folk song'], icon: 'leaf' }],
  ['catalogue-brahms-lullaby', 'Lullaby', { artist: 'Johannes Brahms', version: 'Wiegenlied, Op. 49 No. 4', aliases: ['Brahms', 'Brahms’ Lullaby', 'Wiegenlied', 'Cradle Song', 'Op. 49 No. 4'], icon: 'moon' }],
  ['catalogue-swan-lake-theme', 'Swan Lake', { artist: 'Pyotr Ilyich Tchaikovsky', version: 'Swan theme, Op. 20', aliases: ['Tchaikovsky', 'Swan Theme', 'Le Lac des cygnes', 'Lebedinoye ozero', 'Op. 20'], icon: 'wings' }],
  ['catalogue-we-wish-you-a-merry-christmas', 'We Wish You a Merry Christmas', { artist: 'Traditional', aliases: ['English carol', 'West Country carol', 'Christmas carol'], icon: 'star' }],
  ['catalogue-joy-to-the-world', 'Joy to the World', { artist: 'George Frideric Handel & Isaac Watts', version: 'Hymn tune Antioch', aliases: ['Handel', 'Isaac Watts', 'Lowell Mason', 'Antioch'], icon: 'star' }],
  ['catalogue-deck-the-halls', 'Deck the Halls', { artist: 'Traditional', aliases: ['Deck the Hall', 'Nos Galan', 'Welsh carol', 'Thomas Oliphant'], icon: 'leaf' }],
  ['catalogue-pachelbel-canon', 'Canon in D', { artist: 'Johann Pachelbel', version: 'Canon per 3 Violini e Basso', aliases: ['Pachelbel', 'Pachelbel’s Canon', 'Kanon und Gigue', 'P. 37'] }],
  ['catalogue-auld-lang-syne', 'Auld Lang Syne', { artist: 'Traditional', aliases: ['Robert Burns', 'Scottish song', 'New Year song'], icon: 'clock' }],
]);

export function createSongbookEntries(tracks: readonly DemoTrack[]): SongbookEntry[] {
  return tracks.map((track) => ({
    track, id: track.id,
    difficulty: rateDifficulty(prepareMelody(track, { simplify: false, maxBend: 2 }).notes, track.tempoBpm),
    ...(metadata.get(track.id) ?? { title: track.title, universe: 'Other melodies', categories: ['Other'] as const, icon: 'music', universeIcon: 'music', aliases: [] }),
  }));
}

export interface LetterAnchor { letter: string; id: string }

/** Index letter of a title: its first letter or digit, accents folded; digits and non-Latin letters become '#'. */
function indexLetter(title: string): string {
  const first = title.normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? '';
  return /^[A-Z]$/.test(first) ? first : '#';
}

/** The first entry of each run of index letters, in list order, for the letter rail. */
/** Universe name as shown on compact labels. */
export function universeLabel(universe: string): string {
  return universe === 'The Legend of Zelda' ? 'Zelda' : universe;
}

/** One-line song detail: universe, then artist and version when present. */
export function songMeta(entry: SongbookEntry): string {
  return [universeLabel(entry.universe), entry.artist, entry.version].filter(Boolean).join(' · ');
}

export function letterAnchors(entries: readonly SongbookEntry[]): LetterAnchor[] {
  const anchors: LetterAnchor[] = [];
  for (const entry of entries) {
    const letter = indexLetter(entry.title);
    if (anchors.at(-1)?.letter !== letter) anchors.push({ letter, id: entry.id });
  }
  return anchors;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function filterSongbook(entries: readonly SongbookEntry[], options: {
  query?: string; category?: SongCategory; universe?: string; savedIds?: ReadonlySet<string>; onlySaved?: boolean;
  difficulty?: DifficultyLevel;
}): SongbookEntry[] {
  const words = normalize(options.query ?? '').split(' ').filter(Boolean);
  return entries.filter((entry) => {
    if (options.category && options.category !== 'All' && !entry.categories.includes(options.category)) return false;
    if (options.universe && entry.universe !== options.universe) return false;
    if (options.onlySaved && !options.savedIds?.has(entry.id)) return false;
    if (options.difficulty && entry.difficulty.level !== options.difficulty) return false;
    const searchable = normalize([entry.title, entry.track.title, entry.universe, entry.artist ?? '', entry.version ?? '', ...entry.aliases].join(' '));
    return words.every((word) => searchable.includes(word));
  });
}

export interface UniverseOption { name: string; icon: ThreadIcon; count: number }
export interface UniverseGroup { category: EntryCategory; universes: UniverseOption[] }

const CATEGORY_ORDER: readonly EntryCategory[] = ['Games', 'Anime', 'Film', 'Pop', 'Classics', 'Other'];

/**
 * Universes grouped by category. Without a category each universe appears once, under
 * its primary (first) category; with one, only that category's universes are listed.
 */
export function listUniverses(entries: readonly SongbookEntry[], category: SongCategory = 'All'): UniverseGroup[] {
  const groups = new Map<EntryCategory, Map<string, UniverseOption>>();
  for (const entry of entries) {
    const home = category === 'All' ? entry.categories[0] : entry.categories.includes(category) ? category : undefined;
    if (!home) continue;
    const universes = groups.get(home) ?? new Map<string, UniverseOption>();
    groups.set(home, universes);
    const option = universes.get(entry.universe) ?? { name: entry.universe, icon: entry.universeIcon, count: 0 };
    option.count++;
    universes.set(entry.universe, option);
  }
  return CATEGORY_ORDER.filter(name => groups.has(name)).map(name => ({
    category: name,
    universes: [...groups.get(name)!.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')),
  }));
}
