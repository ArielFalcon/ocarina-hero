import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureExternalMedia } from './media-directory';

const [id, page, first, last, ...flags] = process.argv.slice(2);
const start = Number(first);
const end = Number(last);
if (!id || !/^[a-z0-9-]+$/.test(id) || !page || new URL(page).protocol !== 'https:'
  || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
  throw new Error('Usage: fetch-audio-clip.ts <id> <https-source-page> <start-seconds> <end-seconds> [--direct]');
}

const folder = join(ensureExternalMedia(), 'corpus', 'original-clips', id);
mkdirSync(folder, { recursive: true });
const file = join(folder, 'clip.wav');
const temporary = join(folder, 'clip.partial.wav');
const media = flags.includes('--direct') ? page : execFileSync('yt-dlp', [
  '--no-playlist', '-f', 'bestaudio', '--get-url', page,
], { encoding: 'utf8', timeout: 60000 }).trim();
if (media.includes('\n')) throw new Error('Expected a single audio stream');
try {
  execFileSync('ffmpeg', [
    '-nostdin', '-v', 'error', '-y', '-ss', String(start), '-i', media,
    '-t', String(end - start), '-vn', '-ac', '1', '-ar', '44100', temporary,
  ], { timeout: 120000 });
  const probe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels', '-of', 'json', temporary,
  ], { encoding: 'utf8' }));
  const durationSeconds = Number(probe.format.duration);
  if (Math.abs(durationSeconds - (end - start)) > 0.1) throw new Error('Clip duration does not match requested bounds');
  const bytes = readFileSync(temporary);
  writeFileSync(file, bytes);
  writeFileSync(join(folder, 'provenance.json'), `${JSON.stringify({
    id, sourcePage: page, requestedStartSeconds: start, requestedEndSeconds: end,
    durationSeconds, sampleRate: Number(probe.streams[0].sample_rate),
    channels: Number(probe.streams[0].channels), sha256: createHash('sha256').update(bytes).digest('hex'),
    retrievedAt: new Date().toISOString(), sourceType: 'original-recording-candidate',
    alignmentValidated: false, originalRecordingAudited: false,
    note: 'Downloaded clip only. Identity and complete melody alignment require a separate audit.',
  }, null, 2)}\n`);
  console.log(file);
} finally {
  rmSync(temporary, { force: true });
}
