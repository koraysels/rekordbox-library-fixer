/**
 * The app can read a library from an exported XML or straight from
 * rekordbox's master.db. Writing only ever targets XML: saving XML over
 * master.db would destroy the database, so any write path must refuse a
 * database path outright.
 */
export function isRekordboxDatabasePath(libraryPath: string): boolean {
  return /\.db$/i.test((libraryPath ?? '').trim());
}

export const DATABASE_IS_READ_ONLY =
  'The rekordbox database is opened read-only. To apply changes, export an XML '
  + 'from Rekordbox, load that, and save the result back into Rekordbox.';

/** Throws when a write would land on the rekordbox database. */
export function assertWritableLibraryPath(libraryPath: string): void {
  if (isRekordboxDatabasePath(libraryPath)) {
    throw new Error(DATABASE_IS_READ_ONLY);
  }
}
