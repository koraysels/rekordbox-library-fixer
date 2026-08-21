/**
 * Decide which files may actually be deleted from disk after duplicate
 * resolution.
 *
 * Rekordbox libraries can contain several track entries pointing at the SAME
 * file on disk. Deleting the "losing" entries' paths would then delete the very
 * file a kept entry still references — destroying audio the user chose to keep.
 *
 * A path is safe to delete only when NO track remaining in the library still
 * references it. Paths are also de-duplicated so the same file is never
 * unlinked twice (which produced spurious ENOENT failures).
 *
 * Comparison is case-insensitive AND Unicode-normalised: macOS and Windows
 * filesystems are typically case-insensitive, and macOS stores accents either
 * composed or decomposed while treating both as one file. Rekordbox libraries
 * contain both forms for the same track, so comparing raw strings would call
 * one file two files and delete the copy the kept track still points at.
 */
const normalize = (p: string) => (p ?? '').normalize('NFC').toLowerCase();

export function computeDeletablePaths(
  candidatePaths: string[],
  remainingLocations: Iterable<string>
): string[] {
  const stillReferenced = new Set<string>();
  for (const loc of remainingLocations) {
    if (loc) { stillReferenced.add(normalize(loc)); }
  }

  const seen = new Set<string>();
  const deletable: string[] = [];
  for (const path of candidatePaths) {
    if (!path) { continue; }
    const key = normalize(path);
    if (stillReferenced.has(key) || seen.has(key)) { continue; }
    seen.add(key);
    deletable.push(path);
  }
  return deletable;
}
