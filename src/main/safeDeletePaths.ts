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
 * Comparison is case-insensitive: macOS and Windows filesystems are typically
 * case-insensitive, so two entries differing only in case are the same file.
 */
export function computeDeletablePaths(
  candidatePaths: string[],
  remainingLocations: Iterable<string>
): string[] {
  const stillReferenced = new Set<string>();
  for (const loc of remainingLocations) {
    if (loc) { stillReferenced.add(loc.toLowerCase()); }
  }

  const seen = new Set<string>();
  const deletable: string[] = [];
  for (const path of candidatePaths) {
    if (!path) { continue; }
    const key = path.toLowerCase();
    if (stillReferenced.has(key) || seen.has(key)) { continue; }
    seen.add(key);
    deletable.push(path);
  }
  return deletable;
}
