import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import test from 'node:test';
import { DEMOS } from './catalogue-loader';
import { createSongbookEntries } from '../src/ui/songbook';
import { PLATFORMS } from '../src/ui/platforms';
import { SCENE_FRAME_LIMIT, SCENE_ROLES, SCENE_SLOTS, castScene, frameHoldMs, practiceCue, runGapMs, sceneArtPath, sceneBeatMs, type Scene } from '../src/ui/scenes/scene';
import { SCENES_BY_SONG, SCENES_BY_UNIVERSE, sceneLoaderFor } from '../src/ui/scenes/registry';
import { readSceneArt } from './export-scene-art';

const entries = createSongbookEntries(DEMOS);
const universes = new Set(entries.map(entry => entry.universe));
/** A delivered piece stays small: the lesson loads it on a phone connection. */
const MAX_ART_BYTES = 60_000;
/** A random source that returns the given values in turn. */
const sequence = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]!; };

test('a song override wins over its universe scene, and a universe without a scene gets none', () => {
  const pokemon = entries.find(entry => entry.universe === 'Pokémon')!;
  assert.equal(sceneLoaderFor(pokemon.id, pokemon.universe, true), SCENES_BY_UNIVERSE['Pokémon']);
  const override = { [pokemon.id]: async () => ({ scene: { cast: {}, placements: [] } }) };
  assert.equal(sceneLoaderFor(pokemon.id, pokemon.universe, true, override), override[pokemon.id]);
  const unscened = entries.find(entry => !(entry.universe in SCENES_BY_UNIVERSE))!;
  assert.equal(sceneLoaderFor(unscened.id, unscened.universe, true), null);
});

test('a console without scenes never loads one, and free play has none', () => {
  const pokemon = entries.find(entry => entry.universe === 'Pokémon')!;
  assert.equal(sceneLoaderFor(pokemon.id, pokemon.universe, false), null);
  assert.equal(sceneLoaderFor(null, undefined, true), null);
  assert.deepEqual(PLATFORMS.filter(platform => platform.scenes).map(platform => platform.id), ['tapestry']);
});

test('casting draws a random figure per role member, never repeats one while the role has enough, and keeps a member the same in every slot', () => {
  const piece = (name: string) => ({ frames: [name] });
  const scene: Scene = {
    cast: { lead: [piece('naruto')], companion: [piece('lee'), piece('gaara'), piece('kurama')] },
    placements: [
      { slot: 'heading', role: 'lead' },
      { slot: 'controller', role: 'companion' },
      { slot: 'band', role: 'lead' },
      { slot: 'band', role: 'companion' },
      { slot: 'band', role: 'companion', member: 1 },
    ],
  };
  // Fisher-Yates from the end: 0.99 keeps kurama last, then 0 swaps lee and gaara.
  const names = castScene(scene, sequence(0.99, 0)).map(({ slot, role, piece }) => `${slot}:${role}:${piece.frames[0]}`);
  assert.deepEqual(names, ['heading:lead:naruto', 'controller:companion:gaara', 'band:lead:naruto', 'band:companion:gaara', 'band:companion:lee']);
  const other = castScene(scene, sequence(0, 0)).map(({ piece }) => piece.frames[0]);
  assert.notDeepEqual(other, names.map(name => name.split(':')[2]), 'another draw casts other figures');
  // A member past the cast leaves its place empty instead of showing a figure twice.
  const small: Scene = { cast: { ambient: [piece('sail')] }, placements: [{ slot: 'band', role: 'ambient' }, { slot: 'band', role: 'ambient', member: 1 }] };
  assert.deepEqual(castScene(small, sequence(0)).map(({ piece }) => piece.frames[0]), ['sail']);
});

test('a runner is never a character already on stage while the role has another, and is one when it has none', () => {
  const scene: Scene = {
    cast: {
      lead: [{ frames: ['naruto'], who: 'naruto' }],
      companion: [{ frames: ['lee'], who: 'lee' }, { frames: ['gaara'], who: 'gaara' }],
      runner: [{ frames: ['naruto-run'], who: 'naruto' }, { frames: ['lee-kick'], who: 'lee' }, { frames: ['gaara-sand'], who: 'gaara' }],
    },
    placements: [{ slot: 'heading', role: 'lead' }, { slot: 'controller', role: 'companion' }, { slot: 'band', role: 'runner' }],
  };
  for (const draw of [[0], [0.99], [0.5, 0], [0.3, 0.7]]) {
    const cast = castScene(scene, sequence(...draw)).map(({ piece }) => piece.who);
    assert.equal(new Set(cast).size, cast.length, `draw ${draw} repeats a character: ${cast}`);
  }
  const lonely: Scene = { cast: { lead: [{ frames: ['naruto'], who: 'naruto' }], runner: [{ frames: ['naruto-run'], who: 'naruto' }] },
    placements: [{ slot: 'heading', role: 'lead' }, { slot: 'band', role: 'runner' }] };
  assert.deepEqual(castScene(lonely, sequence(0)).map(({ piece }) => piece.frames[0]), ['naruto', 'naruto-run']);
});

test('a runner crosses now and then, never on a short loop: every twelve to twenty-four seconds', () => {
  assert.equal(runGapMs(() => 0), 12000);
  assert.equal(runGapMs(() => 0.5), 18000);
  assert.ok(runGapMs(() => 0.999999) < 24000);
});

test('a figure holds each pose calmly, for several seconds', () => {
  assert.equal(frameHoldMs(() => 0), 4000);
  assert.equal(frameHoldMs(() => 0.5), 6000);
  assert.ok(frameHoldMs(() => 0.999999) < 8000);
});

test('every registered scene names a real universe or song and casts small delivered art in known slots', async () => {
  const songIds = new Set(entries.map(entry => entry.id));
  for (const universe of Object.keys(SCENES_BY_UNIVERSE)) assert.ok(universes.has(universe), `unknown universe ${universe}`);
  for (const id of Object.keys(SCENES_BY_SONG)) assert.ok(songIds.has(id), `unknown song ${id}`);
  for (const load of [...Object.values(SCENES_BY_UNIVERSE), ...Object.values(SCENES_BY_SONG)]) {
    const { scene } = await load();
    assert.ok(scene.placements.length > 0);
    for (const { slot, role } of scene.placements) {
      assert.ok(SCENE_SLOTS.includes(slot), `unknown slot ${slot}`);
      assert.ok(SCENE_ROLES.includes(role), `unknown role ${role}`);
      assert.ok((scene.cast[role]?.length ?? 0) > 0, `no figure cast as ${role}`);
    }
    for (const piece of Object.values(scene.cast).flat()) {
      assert.ok(piece.frames.length >= 1 && piece.frames.length <= SCENE_FRAME_LIMIT, `${piece.frames[0]}: frame count`);
      for (const frame of piece.frames) {
        const bytes = statSync(`public/${sceneArtPath(frame)}`).size;
        assert.ok(bytes <= MAX_ART_BYTES, `${frame} weighs ${bytes} bytes`);
      }
    }
  }
});

test('a practice note cues the strongest reaction it earned: song end, then milestone or passage, then hit, else miss', () => {
  assert.equal(practiceCue({ hit: true, milestone: true, cleared: true, finished: true }), 'done');
  assert.equal(practiceCue({ hit: true, milestone: true, cleared: false, finished: false }), 'cheer');
  assert.equal(practiceCue({ hit: true, milestone: false, cleared: true, finished: false }), 'cheer');
  assert.equal(practiceCue({ hit: true, milestone: false, cleared: false, finished: false }), 'hit');
  assert.equal(practiceCue({ hit: false, milestone: false, cleared: false, finished: false }), 'miss');
});

test('figures rock on the song beat, folded by halves or doubles into a calm range', () => {
  assert.equal(sceneBeatMs(500), 500);
  assert.equal(sceneBeatMs(300), 600);
  assert.equal(sceneBeatMs(150), 600);
  assert.equal(sceneBeatMs(1500), 750);
  assert.equal(sceneBeatMs(400), 400);
  assert.equal(sceneBeatMs(1200), 1200);
  assert.equal(sceneBeatMs(Number.NaN), 600);
  assert.equal(sceneBeatMs(0), 600);
});

test('every delivered piece can be exported again from its original, and nothing is delivered that no scene uses', async () => {
  const exportable = new Set(readSceneArt().flatMap(({ universe, frames }) => frames.map(frame => `${universe}/${frame}`)));
  const delivered = new Set(readdirSync('public/art/scenes').flatMap(universe =>
    readdirSync(`public/art/scenes/${universe}`).map(file => `${universe}/${file.replace(/\.webp$/, '')}`)));
  const used = new Set<string>();
  for (const load of [...Object.values(SCENES_BY_UNIVERSE), ...Object.values(SCENES_BY_SONG)]) {
    const { scene } = await load();
    for (const piece of Object.values(scene.cast).flat()) for (const frame of piece.frames) used.add(frame);
  }
  assert.deepEqual([...delivered].filter(frame => !exportable.has(frame)), [], 'delivered without an original in scene-art.json');
  assert.deepEqual([...used].filter(frame => !delivered.has(frame)), [], 'used by a scene but not delivered');
  assert.deepEqual([...delivered].filter(frame => !used.has(frame)), [], 'delivered but used by no scene');
});
