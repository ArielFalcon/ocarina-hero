import { execFileSync } from 'node:child_process';

/** Song id → day of the last commit touching its notes file (`<id>.json`), newest commit first; empty when git is unavailable. */
export function songLastModified(): Map<string, string> {
  const days = new Map<string, string>();
  try {
    const log = execFileSync('git', ['log', '--format=@%cs', '--name-only', '--', 'src/core/songs/catalogue'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    let day = '';
    for (const line of log.split('\n')) {
      if (line.startsWith('@')) day = line.slice(1);
      else if (line.endsWith('.json')) {
        const id = line.slice(line.lastIndexOf('/') + 1, -'.json'.length);
        if (!days.has(id)) days.set(id, day);
      }
    }
  } catch { /* a build outside a git checkout simply has no dates */ }
  return days;
}
