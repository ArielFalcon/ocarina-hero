import audioLimits from './audio-limits.json';

export interface AudioSelection { readonly startIndex: number; readonly endIndex: number }
export interface SourceWindow { startSeconds: number; endSeconds: number; sourceDurationSeconds: number }

function sampleIndex(seconds: number, sampleRate: number, length: number): number {
  const value = seconds * sampleRate;
  const nearest = Math.round(value);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value)) * 4;
  const index = Math.abs(value - nearest) <= tolerance ? nearest : Math.floor(value);
  return Math.max(0, Math.min(length, index));
}

export function selectAudioWindow(buffer: Pick<AudioBuffer, 'sampleRate' | 'length' | 'duration'>, startSeconds: number, endSeconds: number): AudioSelection {
  const tolerance = Number.EPSILON * Math.max(Math.abs(startSeconds), Math.abs(endSeconds), audioLimits.maxDurationSeconds) * 4;
  if (!Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0 || !Number.isInteger(buffer.length) || buffer.length <= 0 || !Number.isFinite(buffer.duration) || buffer.duration <= 0 || !Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0 || startSeconds >= endSeconds || endSeconds > buffer.duration || endSeconds - startSeconds > audioLimits.maxDurationSeconds + tolerance) throw new RangeError('Invalid audio window');
  const startIndex = sampleIndex(startSeconds, buffer.sampleRate, buffer.length);
  const endIndex = sampleIndex(endSeconds, buffer.sampleRate, buffer.length);
  if (endIndex <= startIndex || endIndex - startIndex > Math.floor(audioLimits.maxDurationSeconds * buffer.sampleRate)) throw new RangeError('Invalid audio window');
  return { startIndex, endIndex };
}
