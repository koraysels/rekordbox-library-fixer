/**
 * Insert a streamed duplicate set, or replace the existing one with the same
 * id. The main process re-emits a set each time it grows (stable id per
 * fingerprint), so appending blindly would show the same song several times.
 */
export function upsertDuplicateSet<T extends { id: string }>(sets: T[], incoming: T): T[] {
  const index = sets.findIndex((s) => s.id === incoming.id);
  if (index === -1) { return [...sets, incoming]; }
  const next = [...sets];
  next[index] = incoming;
  return next;
}
