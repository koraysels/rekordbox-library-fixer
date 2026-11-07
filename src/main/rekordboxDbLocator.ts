import * as fs from 'fs';
import * as os from 'os';
import { databaseCandidates, DB_VARIANTS } from './libraryScanner';

export interface DbLocation {
  dbPath: string;
  /** Which Rekordbox data directory it was found in. */
  variant: typeof DB_VARIANTS[number];
}

/**
 * Locate Rekordbox's master.db.
 *
 * Verified on a real install: Rekordbox 7.2 keeps it in the unversioned
 * `Pioneer/rekordbox` directory, not `rekordbox7`. Versioned directories are
 * still checked, because older installs use them. The candidate paths come from
 * `databaseCandidates`, so this and the home-screen scan cannot disagree.
 *
 * `exists` is injected so path resolution can be tested without a filesystem.
 */
export function resolveDbPath(
  home: string,
  platform: NodeJS.Platform,
  exists: (p: string) => boolean,
  appData: string | undefined = process.env.APPDATA
): DbLocation | null {
  const candidates = databaseCandidates(home, platform, appData);
  for (let i = 0; i < candidates.length; i++) {
    if (exists(candidates[i])) { return { dbPath: candidates[i], variant: DB_VARIANTS[i] }; }
  }
  return null;
}

export function detectRekordboxDb(): {
  found: boolean;
  dbPath: string | null;
  variant: DbLocation['variant'] | null;
} {
  const location = resolveDbPath(os.homedir(), process.platform, (p) => fs.existsSync(p));
  return location
    ? { found: true, dbPath: location.dbPath, variant: location.variant }
    : { found: false, dbPath: null, variant: null };
}
