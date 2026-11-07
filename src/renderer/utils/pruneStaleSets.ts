/**
 * Duplicate sets checked against the library as it is now.
 *
 * Saved scan results are restored per library, but the library changes under
 * them — merges in master.db, rekordbox itself, another session. Restored as
 * they were, 5431 sets came back after the library had been cleaned. Entries no
 * longer in the library are dropped, and a set left with fewer than two is no
 * duplicate any more.
 */
export function pruneStaleSets<S extends { tracks: Array<{ id: string }> }>(
  sets: S[],
  live: { has(id: string): boolean }
): S[] {
  const result: S[] = [];
  for (const set of sets) {
    const tracks = set.tracks.filter((t) => live.has(t.id));
    if (tracks.length < 2) { continue; }
    result.push(tracks.length === set.tracks.length ? set : { ...set, tracks });
  }
  return result;
}
