import { normalizePathForCompare } from './normalizePath';

/**
 * Rekordbox stores locations that are not files at all: folders (ending in a
 * separator), truncated strings left over from bad imports, and streaming ids
 * such as `tidal:tracks:123`. They are not separate copies of anything, so
 * counting them as files would promise disk space that resolving cannot free.
 */
export function looksLikePlayableFile(location: string | undefined): boolean {
  const path = (location ?? '').trim();
  if (!path || path.endsWith('/') || path.endsWith('\\')) { return false; }
  if (/^[a-z]+:[a-z]+:/i.test(path.split('/').pop() ?? '')) { return false; }
  return /\.[a-z0-9]{2,5}$/i.test(path);
}

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
 * Paths are compared normalised: macOS stores accents composed or decomposed
 * and treats both as one file, so "Bökken" in either form is the same folder.
 */
export function classifyDuplicateSet(tracks: Array<{ location?: string }>): DuplicateKind {
  const paths = tracks
    .filter((t) => looksLikePlayableFile(t.location))
    .map((t) => normalizePathForCompare(t.location))
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
  const keptLocation = normalizePathForCompare(tracks.find((t) => t.id === keptTrackId)?.location);
  const others = new Set(
    tracks
      .filter((t) => t.id !== keptTrackId)
      .map((t) => normalizePathForCompare(t.location))
      .filter((p) => p.length > 0 && p !== keptLocation)
  );
  return others.size;
}

/** How many distinct files on disk this set actually points at. */
export function distinctFileCount(tracks: Array<{ location?: string }>): number {
  return new Set(
    tracks
      .filter((t) => looksLikePlayableFile(t.location))
      .map((t) => normalizePathForCompare(t.location))
      .filter((p) => p.length > 0)
  ).size;
}
