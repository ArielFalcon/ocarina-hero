/**
 * Exports the delivered universe-scene pieces (see src/ui/scenes/scene.ts) from their high-quality originals.
 * The originals stay outside the repository, one folder per universe, in out/ocarina-hero-art/scenes/library/<universe>/;
 * scripts/scene-art.json lists every piece: its universe, its export height (twice its largest display height)
 * and its frames. Only the small WebP is shipped, to public/art/scenes/<universe>/<frame>.webp.
 * A single frame is trimmed to its figure; the frames of one piece share one canvas, bottom-centred, so the
 * figure never jumps between poses.
 *
 * Usage: tsx scripts/export-scene-art.ts [universe ...]   (no argument exports every universe)
 * To add a piece: copy its original PNG into the library folder, add its entry to scene-art.json, run this.
 * Requires ImageMagick (`magick`).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const SCENE_ART_LIBRARY = 'out/ocarina-hero-art/scenes/library';
export interface SceneArtEntry { readonly universe: string; readonly height: number; readonly frames: readonly string[] }

export function readSceneArt(): SceneArtEntry[] {
  return JSON.parse(readFileSync('scripts/scene-art.json', 'utf8')) as SceneArtEntry[];
}

function exportEntry({ universe, height, frames }: SceneArtEntry): void {
  const sources = frames.map(frame => join(SCENE_ART_LIBRARY, universe, `${frame}.png`));
  const magick = (...args: string[]): string => execFileSync('magick', args, { encoding: 'utf8' }).trim();
  const trim = frames.length === 1 ? ['-trim', '+repage'] : [];
  const width = Math.max(...sources.map(source => Number(magick(source, ...trim, '-resize', `x${height}`, '-format', '%w', 'info:'))));
  const target = join('public/art/scenes', universe);
  mkdirSync(target, { recursive: true });
  frames.forEach((frame, index) => {
    const out = join(target, `${frame}.webp`);
    execFileSync('magick', [sources[index]!, ...trim, '-resize', `x${height}`, '-background', 'none', '-gravity', 'south', '-extent', `${width}x${height}`,
      '-quality', '82', '-define', 'webp:alpha-quality=90', '-define', 'webp:method=6', out]);
    console.log(`${out}: ${width}x${height}, ${statSync(out).size} bytes`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = new Set(process.argv.slice(2));
  const entries = readSceneArt().filter(entry => only.size === 0 || only.has(entry.universe));
  if (entries.length === 0) { console.error(`No pieces for ${[...only].join(', ')} in scripts/scene-art.json`); process.exit(1); }
  for (const entry of entries) exportEntry(entry);
}
