/**
 * Append a log entry while keeping only the most recent `max` entries.
 * A relocation run over thousands of tracks emits one log line per track;
 * without a cap the array grows unbounded and re-renders the whole list on
 * every event, which pins and eventually crashes the renderer.
 */
export function capLogs(prev: string[], entry: string, max = 200): string[] {
  const next = [...prev, entry];
  return next.length > max ? next.slice(next.length - max) : next;
}
