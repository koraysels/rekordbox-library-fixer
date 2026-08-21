/**
 * Normalise a filesystem path for comparison.
 *
 * macOS stores accents either composed (ö = U+00F6) or decomposed
 * (o + U+0308) and treats both as the same file. Rekordbox libraries contain
 * both forms for the same track, so a plain string compare reports two
 * different files where the disk has one. Comparing without this caused a
 * duplicate set to look like separate files, which would have deleted the
 * very file the kept track points at.
 */
export function normalizePathForCompare(path: string | undefined | null): string {
  return (path ?? '').normalize('NFC').toLowerCase();
}
