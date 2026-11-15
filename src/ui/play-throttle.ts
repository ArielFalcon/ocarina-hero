/**
 * Lets one play per song and action through per window. Toggling the quick player or reopening a lesson
 * within the window is the same listening, so it must not cost a database write each time.
 */
export function createPlayThrottle(windowMs: number) {
  const lastSent = new Map<string, number>();
  return (song: string, action: string, now = Date.now()): boolean => {
    const key = `${action}:${song}`;
    const previous = lastSent.get(key);
    if (previous !== undefined && now - previous < windowMs) return false;
    lastSent.set(key, now);
    return true;
  };
}
