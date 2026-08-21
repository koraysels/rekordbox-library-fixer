export type DuplicateKind = 'entries' | 'files' | 'mixed';

/**
 * Tell apart the two very different things a "duplicate" can be:
 *
 * - 'entries'  — every copy points at the SAME file on disk. Rekordbox simply
 *                lists the song twice; there is nothing to delete. Resolving
 *                collapses the extra entries and keeps the one file.
 * - 'files'    — the copies point at different files. Resolving keeps one and
 *                the others can be moved to the trash.
 * - 'mixed'    — some copies share a file, others don't (both of the above).
 *
 * Comparison is case-insensitive: macOS and Windows filesystems are.
 */
export function classifyDuplicateSet(tracks: Array<{ location?: string }>): DuplicateKind {
  const paths = tracks
    .map((t) => (t.location ?? '').toLowerCase())
    .filter((p) => p.length > 0);
  if (paths.length === 0) { return 'entries'; }

  const unique = new Set(paths);
  if (unique.size === 1) { return 'entries'; }
  if (unique.size === paths.length) { return 'files'; }
  return 'mixed';
}

/** How many files this set would actually remove from disk. */
export function deletableFileCount(
  tracks: Array<{ id: string; location?: string }>,
  keptTrackId?: string
): number {
  const keptLocation = (tracks.find((t) => t.id === keptTrackId)?.location ?? '').toLowerCase();
  const others = new Set(
    tracks
      .filter((t) => t.id !== keptTrackId)
      .map((t) => (t.location ?? '').toLowerCase())
      .filter((p) => p.length > 0 && p !== keptLocation)
  );
  return others.size;
}
