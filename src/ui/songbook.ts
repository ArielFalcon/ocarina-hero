import type { ThreadIcon } from './thread-icons';
import type { DemoTrack } from '../core/demo';
import { rateDifficulty, type Difficulty, type DifficultyLevel } from '../core/difficulty';
import type { Note } from '../core/ir';
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
  ['catalogue-oot-song-of-time', 'Song of Time', { version: 'Ocarina of Time', aliases: ['Koji Kondo', 'Temple of Time'] }],
  ['catalogue-oot-eponas-song', 'Epona’s Song', { version: 'Ocarina of Time', aliases: ['Koji Kondo', 'Lon Lon Ranch'] }],
  ['catalogue-oot-sarias-song', 'Saria’s Song', { version: 'Ocarina of Time', aliases: ['Koji Kondo', 'Lost Woods'] }],
  ['catalogue-oot-song-of-storms', 'Song of Storms', { version: 'Ocarina of Time', aliases: ['Koji Kondo', 'Windmill Hut'] }],
  ['catalogue-oot-serenade-of-water', 'Serenade of Water', { version: 'Ocarina of Time', aliases: ['Koji Kondo', 'Warp song'] }],
  ['catalogue-oot-nocturne-of-shadow', 'Nocturne of Shadow', { version: 'Ocarina of Time', aliases: ['Koji Kondo', 'Warp song'] }],
  ['catalogue-mm-elegy-of-emptiness', 'Elegy of Emptiness', { version: 'Majora’s Mask', aliases: ['Koji Kondo'] }],
  ['catalogue-ss-ballad-of-the-goddess', 'Ballad of the Goddess', { version: 'Skyward Sword', aliases: ['Hajime Wakai', 'Takeshi Hama'] }],
  ['catalogue-oot-kokiri-forest', 'Kokiri Forest', { version: 'Ocarina of Time', aliases: ['Koji Kondo', 'Kokiri Forest Theme'] }],
  ['catalogue-zelda-alttp-hyrule-castle', 'Hyrule Castle', { version: 'A Link to the Past', aliases: ['Koji Kondo', 'Hyrule Castle Theme', 'Castle Theme', 'Nintendo'] }],
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
  ['catalogue-pokemon-rby-trainer-battle', 'Trainer Battle', { version: 'Red / Blue / Yellow', aliases: ['Junichi Masuda', 'Pokémon Red and Blue', 'Battle theme'] }],
  ['catalogue-pokemon-rby-mt-moon', 'Mt. Moon', { version: 'Red / Blue / Yellow', aliases: ['Junichi Masuda', 'Mt Moon', 'Pokémon Red and Blue'] }],
]);
group('Undertale', ['Games'], 'heart', [
  ['catalogue-megalovania', 'Megalovania'],
  ['catalogue-once-upon-a-time', 'Once Upon a Time'],
  ['catalogue-fallen-down', 'Fallen Down'],
  ['catalogue-undertale-hopes-and-dreams', 'Hopes and Dreams', { aliases: ['Toby Fox'] }],
]);
group('Tetris', ['Games'], 'tetromino', [['catalogue-tetris', 'Music A', { aliases: ['Korobeiniki'] }]]);
group('Sonic', ['Games'], 'ring', [
  ['catalogue-green-hill', 'Green Hill Zone', { version: 'Sonic the Hedgehog' }],
  ['catalogue-sonic-extra-life', 'Extra Life', { version: 'Sonic the Hedgehog', aliases: ['1UP'] }],
  ['catalogue-sonic3-act-complete', 'Act Complete', { version: 'Sonic the Hedgehog 3' }],
  ['catalogue-sonic2-emerald-hill', 'Emerald Hill Zone', { version: 'Sonic the Hedgehog 2', aliases: ['Masato Nakamura'] }],
  ['catalogue-sonic1-marble-zone', 'Marble Zone', { version: 'Sonic the Hedgehog', aliases: ['Masato Nakamura', 'Marble Zone Act 1'] }],
  ['catalogue-sonic1-scrap-brain-zone', 'Scrap Brain Zone', { version: 'Sonic the Hedgehog', aliases: ['Masato Nakamura', 'Scrap Brain Zone Act 1'] }],
]);
group('Super Mario', ['Games'], 'mushroom', [
  ['catalogue-dire-dire-docks', 'Dire, Dire Docks', { version: 'Super Mario 64' }],
  ['catalogue-smb-world-clear', 'Castle Clear', { version: 'Super Mario Bros.', aliases: ['World Clear'] }],
  ['catalogue-smb-game-over', 'Game Over', { version: 'Super Mario Bros.' }],
  ['catalogue-smw-overworld', 'Overworld', { version: 'Super Mario World', aliases: ['Koji Kondo'] }],
  ['catalogue-sm64-select-a-file', 'Select a File', { version: 'Super Mario 64', aliases: ['Koji Kondo', 'File Select', 'SM64'] }],
  ['catalogue-smario-64-bob-omb-battlefield', 'Bob-omb Battlefield', { version: 'Super Mario 64', aliases: ['Koji Kondo', 'SM64', 'Course 1', 'Super Mario 64 Main Theme'] }],
]);
group('Metroid', ['Games'], 'gamepad', [['catalogue-super-metroid-item', 'Item Acquisition', { version: 'Super Metroid' }]]);
group('Donkey Kong Country', ['Games'], 'gamepad', [
  ['catalogue-dkc-bonus-win', 'Bonus Win', { aliases: ['Boss Defeated', 'Bonus Victory'] }],
  ['catalogue-donkey-kong-country-main-theme', 'Main Theme', { aliases: ['Donkey Kong Country Theme', 'Theme Song', 'David Wise', 'Rare'] }],
]);
group('Final Fantasy VII', ['Games'], 'meteor', [
  ['catalogue-ff7-victory', 'Victory Fanfare', { aliases: ['FF7'] }],
  ['catalogue-ff7-main-theme', 'Main Theme', { aliases: ['Nobuo Uematsu', 'Main Theme of Final Fantasy VII', 'FF7', 'World Map'] }],
  ['catalogue-ff7-fighting', 'Fighting', { aliases: ['Nobuo Uematsu', 'Battle Theme', 'Standard Battle', 'FF7'] }],
]);
group('Chrono Trigger', ['Games'], 'clock', [
  ['catalogue-wind-scene', 'Wind Scene'],
  ['catalogue-chrono-trigger-main-theme', 'Main Theme', { aliases: ['Chrono Trigger Theme', 'Opening Theme', 'Yasunori Mitsuda'] }],
  ['catalogue-chrono-cross-scars-of-time', 'Scars of Time', { version: 'Chrono Cross', aliases: ['Yasunori Mitsuda', 'Chrono Cross ~Scars Left by Time~', 'Scars Left by Time', 'Chrono Cross'] }],
]);
group('Fire Emblem', ['Games'], 'gamepad', [
  ['catalogue-fire-emblem-theme', 'Main Theme', { version: 'Series theme', aliases: ['Fire Emblem Theme', 'Yuka Tsujiyoko', 'Fire Emblem Main Theme'] }],
]);
group('Minecraft', ['Games'], 'grassBlock', [
  ['catalogue-wet-hands', 'Wet Hands', { aliases: ['C418'] }],
  ['catalogue-sweden', 'Sweden', { aliases: ['C418'] }],
]);
group('Wii', ['Games'], 'remote', [['catalogue-mii-channel', 'Mii Channel']]);
group('EarthBound', ['Games'], 'gamepad', [
  ['catalogue-earthbound-eight-melodies', 'Eight Melodies', { aliases: ['Mother 2', 'Keiichi Suzuki', 'Hirokazu Tanaka'] }],
  ['catalogue-earthbound-onett', 'Onett', { aliases: ['Mother 2', 'Onett Theme', 'Keiichi Suzuki', 'Hirokazu Tanaka'] }],
]);
group('Castlevania', ['Games'], 'gamepad', [
  ['catalogue-castlevania-ii-bloody-tears', 'Bloody Tears', { version: 'Castlevania II: Simon’s Quest', aliases: ['Kenichi Matsubara'] }],
  ['catalogue-castlevania-3-beginning', 'Beginning', { version: 'Castlevania III: Dracula’s Curse', aliases: ['Akumajō Densetsu', 'Stage 1', 'Konami'] }],
]);
group('Kirby', ['Games'], 'gamepad', [
  ['catalogue-kirby-butter-building', 'Butter Building', { version: 'Kirby’s Adventure', aliases: ['Hirokazu Ando'] }],
  ['catalogue-kirby-king-dededes-theme', 'King Dedede’s Theme', { version: 'Kirby Super Star', aliases: ['King Dedede\'s Theme', 'Dedede', 'King Dedede', 'Kirby Super Star Ultra'] }],
]);
group('Professor Layton', ['Games'], 'gamepad', [
  ['catalogue-layton-theme', 'Professor Layton’s Theme', { version: 'Professor Layton and the Curious Village', aliases: ['Tomohito Nishiura', 'Layton’s Theme'] }],
]);
group('The Elder Scrolls', ['Games'], 'gamepad', [
  ['catalogue-morrowind-nerevar-rising', 'Nerevar Rising', { version: 'Morrowind', aliases: ['Jeremy Soule', 'Call of Magic', 'Main Theme', 'The Elder Scrolls III: Morrowind', 'Morrowind Theme'] }],
  ['catalogue-oblivion-reign-of-the-septims', 'Reign of the Septims', { version: 'Oblivion', aliases: ['Jeremy Soule', 'Main Theme', 'The Elder Scrolls IV: Oblivion', 'Oblivion Theme'] }],
]);
group('Bubble Bobble', ['Games'], 'gamepad', [
  ['catalogue-bubble-bobble-main-stage-theme', 'Main Theme', { aliases: ['Main Stage Theme', 'Stage Theme', 'Tadashi Kimijima', 'Taito'] }],
]);
group('Street Fighter', ['Games'], 'gamepad', [
  ['catalogue-sf2-kens-theme', 'Ken’s Theme', { version: 'Street Fighter II', aliases: ['Ken\'s Theme', 'Ken Stage', 'Yoko Shimomura', 'Capcom'] }],
  ['catalogue-sf2-ryus-theme', 'Ryu’s Theme', { version: 'Street Fighter II', aliases: ['Ryu\'s Theme', 'Ryu Stage', 'Yoko Shimomura', 'Capcom'] }],
]);
group('F-Zero', ['Games'], 'gamepad', [
  ['catalogue-fzero-mute-city', 'Mute City', { aliases: ['Yumiko Kanki', 'F-Zero X', 'F-Zero GP Legend'] }],
]);
group('Mega Man', ['Games'], 'gamepad', [
  ['catalogue-mm2-wood-man-stage', 'Wood Man Stage', { version: 'Mega Man 2', aliases: ['Woodman', 'Takashi Tateishi', 'Capcom'] }],
  ['catalogue-mega-man-3-spark-man', 'Spark Man Stage', { version: 'Mega Man 3', aliases: ['Spark Man', 'Rockman 3', 'Capcom'] }],
  ['catalogue-mega-man-3-snake-man', 'Snake Man Stage', { version: 'Mega Man 3', aliases: ['Snake Man', 'Rockman 3', 'Capcom'] }],
]);
group('Kid Icarus', ['Games'], 'gamepad', [
  ['catalogue-kid-icarus-underworld', 'Underworld', { aliases: ['Stage 1 Underworld', 'Hirokazu Tanaka', 'Nintendo'] }],
]);
group('Kingdom Hearts', ['Games'], 'gamepad', [
  ['catalogue-kh-traverse-town', 'Traverse Town', { aliases: ['Yoko Shimomura', 'Square'] }],
]);
group('Doom', ['Games'], 'gamepad', [
  ['catalogue-doom-at-dooms-gate', 'At Doom’s Gate', { aliases: ['At Doom\'s Gate', 'E1M1', 'Bobby Prince', 'id Software'] }],
]);
group('Super Smash Bros.', ['Games'], 'gamepad', [
  ['catalogue-smash-melee-menu', 'Menu', { version: 'Super Smash Bros. Melee', aliases: ['Main Menu', 'Melee Menu', 'SSBM', 'Nintendo'] }],
]);
group('Animal Crossing', ['Games'], 'gamepad', [
  ['catalogue-animal-crossing-8-am', '8:00 AM', { aliases: ['Hourly Music', '8 AM', 'Kazumi Totaka', 'Nintendo'] }],
]);
group('Excitebike', ['Games'], 'gamepad', [
  ['catalogue-excitebike-title-theme', 'Title Theme', { aliases: ['Title Screen', 'Nintendo'] }],
]);
group('Cave Story', ['Games'], 'gamepad', [
  ['catalogue-cave-story-main-theme', 'Main Theme', { aliases: ['Cave Story', 'Daisuke Amaya', 'Pixel', 'Studio Pixel'] }],
]);

// Anime
group('Naruto', ['Anime'], 'konohaLeaf', [
  ['catalogue-naruto', 'Sadness and Sorrow'],
  ['catalogue-blue-bird', 'Blue Bird', { version: 'Shippuden', aliases: ['Ikimono-gakari'] }],
  ['catalogue-naruto-hokage-funeral', 'Grief and Sorrow', { aliases: ['Toshio Masuda', 'Hokage’s Funeral', 'Hokages Funeral', 'Ai to Shū', '哀と愁'] }],
  ['catalogue-naruto-raising-fighting-spirit', 'The Raising Fighting Spirit', { aliases: ['Toshio Masuda', 'The Rising Fighting Spirit', 'Raising Fighting Spirit', 'Wakiagaru Tōshi', '湧き上がる闘志'] }],
  ['catalogue-naruto-go', 'GO!!!', { version: 'Opening 4', aliases: ['FLOW', 'Go', 'Naruto opening 4', 'GO!!! FLOW'] }],
]);
group('Neon Genesis Evangelion', ['Anime'], 'unit', [['catalogue-evangelion', 'A Cruel Angel’s Thesis', { aliases: ['Evangelion'] }]]);
group('Elfen Lied', ['Anime'], 'lily', [['catalogue-lilium', 'Lilium']]);
group('Death Note', ['Anime'], 'notebook', [['catalogue-l-theme', 'L’s Theme']]);
group('Sailor Moon', ['Anime'], 'moon', [['catalogue-moonlight', 'Moonlight Densetsu']]);
group('Dragon Ball Z', ['Anime'], 'dragonball', [['catalogue-tapion', 'Tapion’s Theme']]);
group('Attack on Titan', ['Anime'], 'wingsOfFreedom', [['catalogue-shinzou', 'Shinzou wo Sasageyo!']]);
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
group('Digimon', ['Anime'], 'anime', [
  ['catalogue-digimon-butter-fly', 'Butter-Fly', { version: 'Digimon Adventure opening', aliases: ['Kouji Wada', 'Wada Kouji', 'Digimon Adventure', 'Digimon Theme', 'Butterfly'] }],
]);
group('Cowboy Bebop', ['Anime'], 'anime', [
  ['catalogue-bebop-tank', 'Tank!', { version: 'Opening', aliases: ['Yoko Kanno', 'Seatbelts', 'Cowboy Bebop opening', 'Tank'] }],
]);
group('One Piece', ['Anime'], 'anime', [
  ['catalogue-one-piece-we-are', 'We Are!', { version: 'Opening 1', aliases: ['Hiroshi Kitadani', 'We Are', 'One Piece opening 1'] }],
  ['catalogue-one-piece-binks-sake', 'Binks’ Sake', { version: 'Thriller Bark', aliases: ['Binks\' Sake', 'Bink\'s Sake', 'Binks no Sake', 'Yohoho', 'Brook', 'Kohei Tanaka'] }],
]);

// Film and TV
group('KPop Demon Hunters', ['Film', 'Pop'], 'hunter', [
  ['catalogue-golden', 'Golden', { aliases: ['HUNTR/X'] }],
  ['catalogue-saja-boys-soda-pop-chorus', 'Soda Pop', { aliases: ['Saja Boys', 'Soda Pop Saja Boys'] }],
]);
group('Star Wars', ['Film'], 'empire', [
  ['catalogue-imperial-march', 'The Imperial March', { aliases: ['John Williams'] }],
  ['catalogue-mandalorian', 'Main Theme', { version: 'The Mandalorian', aliases: ['Ludwig Göransson'], icon: 'film' }],
  ['catalogue-duel-of-the-fates-brass', 'Duel of the Fates', { version: 'The Phantom Menace', aliases: ['John Williams', 'Episode I', 'Star Wars: Episode I – The Phantom Menace'] }],
]);
group('Pirates of the Caribbean', ['Film'], 'pirate', [['catalogue-pirate', 'He’s a Pirate', { aliases: ['Hans Zimmer', 'Klaus Badelt'] }]]);
group('Harry Potter', ['Film'], 'wizard', [['catalogue-hedwig', 'Hedwig’s Theme', { aliases: ['John Williams'] }]]);
group('The Lord of the Rings', ['Film'], 'film', [
  ['catalogue-concerning-hobbits', 'Concerning Hobbits', { aliases: ['Howard Shore'] }],
  ['catalogue-evenstar', 'Evenstar', { aliases: ['Howard Shore'] }],
  ['catalogue-may-it-be', 'May It Be', { aliases: ['Enya'] }],
  ['catalogue-hobbit-misty-mountains', 'Misty Mountains', { version: 'The Hobbit: An Unexpected Journey', aliases: ['Howard Shore', 'Plan 9', 'David Donaldson', 'David Long', 'Steve Roche', 'Janet Roddick', 'Richard Armitage', 'Far Over the Misty Mountains Cold', 'Misty Mountains Cold', 'The Hobbit'] }],
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
group('Forrest Gump', ['Film'], 'film', [
  ['catalogue-forrest-gump-feather-theme', 'Feather Theme', { version: 'Film (1994)', aliases: ['Alan Silvestri', 'Forrest Gump Theme', 'Forrest Gump Suite', 'Main Title'] }],
]);
group('Stranger Things', ['Film'], 'film', [
  ['catalogue-stranger-things-arpeggio', 'Main Title', { version: 'TV series (2016)', aliases: ['Kyle Dixon', 'Michael Stein', 'Kyle Dixon & Michael Stein', 'Stranger Things Theme', 'Main Theme', 'Survive'] }],
]);
group('Breakfast at Tiffany’s', ['Film'], 'film', [
  ['catalogue-moon-river', 'Moon River', { version: 'Film (1961)', aliases: ['Henry Mancini', 'Johnny Mercer', 'Audrey Hepburn'] }],
]);
group('The Sound of Music', ['Film'], 'film', [
  ['catalogue-my-favorite-things', 'My Favorite Things', { version: 'Film (1965)', aliases: ['Richard Rodgers', 'Oscar Hammerstein II', 'Rodgers and Hammerstein', 'Julie Andrews'] }],
]);
group('Beauty and the Beast', ['Film'], 'film', [
  ['catalogue-belle-beauty-and-the-beast', 'Belle', { version: 'Film (1991)', aliases: ['Alan Menken', 'Howard Ashman', 'Little Town'] }],
]);
group('Aladdin', ['Film'], 'film', [
  ['catalogue-prince-ali', 'Prince Ali', { version: 'Film (1992)', aliases: ['Alan Menken', 'Howard Ashman', 'Robin Williams'] }],
]);
group('Pocahontas', ['Film'], 'film', [
  ['catalogue-just-around-the-riverbend', 'Just Around the Riverbend', { version: 'Film (1995)', aliases: ['Alan Menken', 'Stephen Schwartz', 'Judy Kuhn', 'Riverbend'] }],
]);
group('Jeopardy!', ['Film'], 'film', [
  ['catalogue-jeopardy-think', 'Think!', { version: 'Final Jeopardy!', aliases: ['Final Jeopardy', 'Jeopardy Theme', 'Think Music', 'Merv Griffin'] }],
]);
group('Les Misérables', ['Film'], 'film', [
  ['catalogue-do-you-hear-the-people-sing', 'Do You Hear the People Sing?', { version: 'Musical (1980)', aliases: ['Claude-Michel Schönberg', 'Alain Boublil', 'Herbert Kretzmer', 'Les Mis', 'Les Miserables'] }],
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
  ['catalogue-wind-of-change-whistle', 'Wind of Change', { artist: 'Scorpions', aliases: ['Klaus Meine'], icon: 'cassette' }],
  ['catalogue-cant-help-falling-in-love', 'Can’t Help Falling in Love', { artist: 'Elvis Presley', aliases: ['Cant Help Falling in Love'], icon: 'heart' }],
  ['catalogue-hey-jude-opening', 'Hey Jude', { artist: 'The Beatles', aliases: ['Lennon-McCartney', 'Paul McCartney'] }],
  ['catalogue-lambada', 'Lambada', { artist: 'Kaoma', aliases: ['Chorando se foi', 'Llorando se fue', 'Los Kjarkas', 'Gonzalo Hermosa', 'Ulises Hermosa'], icon: 'waveform' }],
  ['catalogue-tide-is-high-chorus', 'The Tide Is High', { artist: 'Atomic Kitten', aliases: ['The Tide Is High (Get the Feeling)', 'Blondie', 'The Paragons', 'John Holt'], icon: 'waveform' }],
  ['catalogue-next-episode-riff', 'The Next Episode', { artist: 'Dr. Dre & Snoop Dogg', aliases: ['Dr. Dre feat. Snoop Dogg', 'Snoop Dogg', '2001', 'David McCallum', 'Next Episode'], icon: 'microphone' }],
  ['catalogue-hips-dont-lie-horn-riff', 'Hips Don’t Lie', { artist: 'Shakira & Wyclef Jean', aliases: ['Hips Dont Lie', 'Shakira', 'Wyclef Jean'], icon: 'waveform' }],
  ['catalogue-eleanor-rigby-verse', 'Eleanor Rigby', { artist: 'The Beatles', aliases: ['Revolver', 'Lennon-McCartney', 'Paul McCartney'] }],
  ['catalogue-yesterday-first-line', 'Yesterday', { artist: 'The Beatles', aliases: ['Help!', 'Lennon-McCartney', 'Paul McCartney'] }],
  ['catalogue-obladi-chorus', 'Ob-La-Di, Ob-La-Da', { artist: 'The Beatles', aliases: ['Obladi Oblada', 'White Album', 'Lennon-McCartney', 'Paul McCartney'] }],
  ['catalogue-yellow-submarine-verse', 'Yellow Submarine', { artist: 'The Beatles', aliases: ['Revolver', 'Lennon-McCartney', 'Ringo Starr'] }],
  ['catalogue-come-as-you-are-riff', 'Come As You Are', { artist: 'Nirvana', aliases: ['Nevermind', 'Kurt Cobain'], icon: 'waveform' }],
  ['catalogue-beat-it-bass-riff', 'Beat It', { artist: 'Michael Jackson', aliases: ['Thriller', 'Quincy Jones'], icon: 'waveform' }],
  ['catalogue-dont-look-back-in-anger-chorus', 'Don’t Look Back in Anger', { artist: 'Oasis', aliases: ['Dont Look Back in Anger', 'Noel Gallagher', 'Morning Glory'] }],
  ['catalogue-shape-of-you-marimba', 'Shape of You', { artist: 'Ed Sheeran', aliases: ['Divide', 'Marimba'], icon: 'cassette' }],
  ['catalogue-we-are-the-champions-chorus', 'We Are the Champions', { artist: 'Queen', aliases: ['Freddie Mercury', 'News of the World'], icon: 'star' }],
  ['catalogue-fix-you-chorus', 'Fix You', { artist: 'Coldplay', aliases: ['X&Y', 'Chris Martin'], icon: 'heart' }],
  ['catalogue-cotton-eye-joe-fiddle', 'Cotton Eye Joe', { artist: 'Rednex', aliases: ['Cotton-Eye Joe', 'Rednex', 'Sex & Violins'] }],
  ['catalogue-the-sign-synth-hook', 'The Sign', { artist: 'Ace of Base', aliases: ['Ace of Base', 'Happy Nation'] }],
  ['catalogue-what-is-love-chorus', 'What Is Love', { artist: 'Haddaway', aliases: ['Haddaway', 'The Album', 'Night at the Roxbury'] }],
  ['catalogue-let-it-be-verse', 'Let It Be', { artist: 'The Beatles', aliases: ['Beatles', 'Lennon-McCartney', 'Paul McCartney'] }],
  ['catalogue-bohemian-rhapsody-mama', 'Bohemian Rhapsody', { artist: 'Queen', aliases: ['Queen', 'Freddie Mercury', 'A Night at the Opera'] }],
  ['catalogue-time-after-time-chorus', 'Time After Time', { artist: 'Cyndi Lauper', aliases: ['She’s So Unusual', 'Rob Hyman'] }],
  ['catalogue-lean-on-me-opening', 'Lean on Me', { artist: 'Bill Withers', aliases: ['Still Bill'] }],
  ['catalogue-have-you-ever-seen-the-rain-verse', 'Have You Ever Seen the Rain?', { artist: 'Creedence Clearwater Revival', aliases: ['Pendulum', 'John Fogerty', 'CCR'] }],
  ['catalogue-enter-sandman-riff', 'Enter Sandman', { artist: 'Metallica', aliases: ['Metallica (Black Album)', 'James Hetfield'] }],
  ['catalogue-aqua-barbie-girl-verse', 'Barbie Girl', { artist: 'Aqua', aliases: ['Aquarium'] }],
  ['catalogue-ewf-september-chorus', 'September', { artist: 'Earth, Wind & Fire', aliases: ['The Best of Earth, Wind & Fire Vol. 1', 'Maurice White'] }],
  ['catalogue-do-i-wanna-know-riff', 'Do I Wanna Know?', { artist: 'Arctic Monkeys', aliases: ['AM', 'Alex Turner', 'Do I Wanna Know'] }],
  ['catalogue-ymca-verse', 'Y.M.C.A.', { artist: 'Village People', aliases: ['YMCA', 'Village People', 'Cruisin', 'Jacques Morali', 'Victor Willis'] }],
  ['catalogue-cant-buy-me-love-chorus', 'Can’t Buy Me Love', { artist: 'The Beatles', aliases: ['Can\'t Buy Me Love', 'Beatles', 'A Hard Day\'s Night', 'Lennon-McCartney', 'Paul McCartney'] }],
  ['catalogue-eight-days-a-week-verse', 'Eight Days a Week', { artist: 'The Beatles', aliases: ['Beatles', 'Beatles for Sale', 'Lennon-McCartney', 'Paul McCartney'] }],
  ['catalogue-michelle-verse', 'Michelle', { artist: 'The Beatles', aliases: ['Beatles', 'Rubber Soul', 'Michelle Ma Belle', 'Lennon-McCartney', 'Paul McCartney'] }],
  ['catalogue-still-havent-found-chorus', 'I Still Haven’t Found What I’m Looking For', { artist: 'U2', aliases: ['I Still Haven\'t Found What I\'m Looking For', 'U2', 'The Joshua Tree', 'Still Haven\'t Found'] }],
  ['catalogue-sunday-bloody-sunday-intro', 'Sunday Bloody Sunday', { artist: 'U2', aliases: ['U2', 'War'] }],
  ['catalogue-yesterday-once-more-chorus', 'Yesterday Once More', { artist: 'The Carpenters', aliases: ['Carpenters', 'Karen Carpenter', 'Now & Then', 'Richard Carpenter', 'John Bettis'] }],
  ['catalogue-another-day-in-paradise-intro', 'Another Day in Paradise', { artist: 'Phil Collins', aliases: ['Phil Collins', '...But Seriously'] }],
  ['catalogue-daydream-believer-chorus', 'Daydream Believer', { artist: 'The Monkees', aliases: ['Monkees', 'John Stewart'] }],
  ['catalogue-here-there-and-everywhere-verse', 'Here, There and Everywhere', { artist: 'The Beatles', aliases: ['Beatles', 'Lennon-McCartney', 'Paul McCartney', 'Revolver'] }],
  ['catalogue-fool-on-the-hill-chorus', 'The Fool on the Hill', { artist: 'The Beatles', aliases: ['Beatles', 'Lennon-McCartney', 'Paul McCartney', 'Magical Mystery Tour'] }],
  ['catalogue-knowing-me-verse', 'Knowing Me, Knowing You', { artist: 'ABBA', aliases: ['Abba', 'Arrival'] }],
  ['catalogue-black-or-white-verse', 'Black or White', { artist: 'Michael Jackson', aliases: ['Michael Jackson', 'Dangerous'] }],
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
  ['catalogue-greensleeves-verse', 'Greensleeves', { artist: 'Traditional', aliases: ['Green Sleeves', 'English folk song'], icon: 'flower' }],
  ['catalogue-brahms-lullaby', 'Lullaby', { artist: 'Johannes Brahms', version: 'Wiegenlied, Op. 49 No. 4', aliases: ['Brahms', 'Brahms’ Lullaby', 'Wiegenlied', 'Cradle Song', 'Op. 49 No. 4'], icon: 'moon' }],
  ['catalogue-swan-lake-theme', 'Swan Lake', { artist: 'Pyotr Ilyich Tchaikovsky', version: 'Swan theme, Op. 20', aliases: ['Tchaikovsky', 'Swan Theme', 'Le Lac des cygnes', 'Lebedinoye ozero', 'Op. 20'] }],
  ['catalogue-we-wish-you-a-merry-christmas', 'We Wish You a Merry Christmas', { artist: 'Traditional', aliases: ['English carol', 'West Country carol', 'Christmas carol'], icon: 'star' }],
  ['catalogue-joy-to-the-world', 'Joy to the World', { artist: 'George Frideric Handel & Isaac Watts', version: 'Hymn tune Antioch', aliases: ['Handel', 'Isaac Watts', 'Lowell Mason', 'Antioch'], icon: 'star' }],
  ['catalogue-deck-the-halls', 'Deck the Halls', { artist: 'Traditional', aliases: ['Deck the Hall', 'Nos Galan', 'Welsh carol', 'Thomas Oliphant'], icon: 'star' }],
  ['catalogue-pachelbel-canon', 'Canon in D', { artist: 'Johann Pachelbel', version: 'Canon per 3 Violini e Basso', aliases: ['Pachelbel', 'Pachelbel’s Canon', 'Kanon und Gigue', 'P. 37'] }],
  ['catalogue-chopin-nocturne-op9-no2-opening', 'Nocturne in E-flat major', { artist: 'Frédéric Chopin', version: 'Op. 9 No. 2', aliases: ['Chopin', 'Nocturne Op. 9 No. 2', 'Nocturne No. 2', 'Nocturne in Eb'], icon: 'moon' }],
  ['catalogue-air-on-the-g-string', 'Air on the G String', { artist: 'Johann Sebastian Bach', version: 'Orchestral Suite No. 3, BWV 1068', aliases: ['Bach', 'Air', 'BWV 1068', 'Aria', 'Suite No. 3 in D major'] }],
  ['catalogue-auld-lang-syne', 'Auld Lang Syne', { artist: 'Traditional', aliases: ['Robert Burns', 'Scottish song', 'New Year song'], icon: 'clock' }],
  ['catalogue-nokia-tune-grande-valse', 'Gran Vals', { version: 'Nokia tune', artist: 'Francisco Tárrega', aliases: ['Nokia Tune', 'Nokia ringtone', 'Grande Valse', 'Gran Vals (Nokia tune)', 'Tarrega'] }],
]);

/** Notes of the arrangement a lesson opens with: bends on, ornaments kept. */
export function openingNotes(track: DemoTrack): Note[] {
  return prepareMelody(track, { simplify: false, maxBend: 2 }).notes;
}

export function createSongbookEntries(tracks: readonly DemoTrack[]): SongbookEntry[] {
  return tracks.map((track) => ({
    track, id: track.id,
    difficulty: rateDifficulty(openingNotes(track), track.tempoBpm),
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
