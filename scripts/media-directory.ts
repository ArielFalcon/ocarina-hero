import { existsSync, realpathSync, mkdirSync, symlinkSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/** Keep the legacy output path while storing media outside the source tree. */
export function ensureExternalMedia(): string {
  const root = realpathSync(process.cwd());
  const output = resolve(root, 'out');
  if (!existsSync(output)) {
    const target = resolve(root, '../ocarina-tabs-media');
    mkdirSync(target, { recursive: true });
    symlinkSync(relative(root, target), output, 'dir');
  }
  const target = realpathSync(output);
  const location = relative(root, target);
  if (location !== '..' && !location.startsWith('../') && !isAbsolute(location)) {
    throw new Error('Media must be outside the project. Move out to ../ocarina-tabs-media and replace it with a symlink.');
  }
  return target;
}
