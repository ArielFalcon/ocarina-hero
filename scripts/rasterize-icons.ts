/**
 * Renders every tapestry patch icon (public/art/icons/*.svg, embroidered with <pattern> fills) to a WebP next to it.
 * Phones re-raster each pattern-filled SVG wherever a row of the songbook paints, which made view changes slow;
 * a bitmap at three times the largest displayed size (38 px) looks the same and paints at once.
 *
 * Usage: tsx scripts/rasterize-icons.ts   (needs Google Chrome and cwebp)
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ICONS = resolve('public/art/icons');
const SIZE = 120;

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { timeout: 30_000, stdio: ['ignore', 'ignore', 'pipe'] });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.stderr}`);
}

const scratch = mkdtempSync(join(tmpdir(), 'icons-'));
try {
  for (const file of readdirSync(ICONS).filter(name => name.endsWith('.svg'))) {
    const name = file.slice(0, -'.svg'.length);
    const page = join(scratch, `${name}.html`);
    const png = join(scratch, `${name}.png`);
    writeFileSync(page, `<!doctype html><body style="margin:0;background:transparent"><img src="file://${join(ICONS, file)}" width="${SIZE}" height="${SIZE}" style="display:block"></body>`);
    run(CHROME, ['--headless=new', `--user-data-dir=${join(scratch, 'profile')}`, '--hide-scrollbars', '--default-background-color=00000000', `--window-size=${SIZE},${SIZE}`, `--screenshot=${png}`, `file://${page}`]);
    run('cwebp', ['-quiet', '-q', '92', '-alpha_q', '100', png, '-o', join(ICONS, `${name}.webp`)]);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
