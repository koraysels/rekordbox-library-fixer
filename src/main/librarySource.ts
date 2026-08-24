/**
 * The app can read a library from an exported XML or straight from
 * rekordbox's master.db. Changes to a database-backed library go through the
 * database-native writers (merging duplicates, relocating tracks), never
 * through the XML writer: saving XML over master.db would destroy it, so every
 * XML write path must refuse a database path outright.
 */
export function isRekordboxDatabasePath(libraryPath: string): boolean {
  return /\.db$/i.test((libraryPath ?? '').trim());
}

export const DATABASE_IS_READ_ONLY =
  'This change cannot be written as XML over the rekordbox database — that would '
  + 'destroy it. Changes to a database-backed library are written into the database '
  + 'itself, with rekordbox closed and a backup taken first.';

/** Throws when a write would land on the rekordbox database. */
export function assertWritableLibraryPath(libraryPath: string): void {
  if (isRekordboxDatabasePath(libraryPath)) {
    throw new Error(DATABASE_IS_READ_ONLY);
  }
}
