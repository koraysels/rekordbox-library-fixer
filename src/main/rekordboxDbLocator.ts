import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface DbLocation {
  dbPath: string;
  /** Which Rekordbox data directory it was found in. */
  variant: 'rekordbox' | 'rekordbox7' | 'rekordbox6';
}

/**
 * Locate Rekordbox's master.db.
 *
 * Verified on a real install: Rekordbox 7.2 keeps it in the unversioned
 * `Pioneer/rekordbox` directory, not `rekordbox7`. Versioned directories are
 * still checked, because older installs use them.
 *
 * `exists` is injected so path resolution can be tested without a filesystem.
 */
export function resolveDbPath(
  home: string,
  platform: NodeJS.Platform,
  exists: (p: string) => boolean
): DbLocation | null {
  const base = platform === 'win32'
    ? path.join(home, 'Pioneer')
    : path.join(home, 'Library', 'Pioneer');

  for (const variant of ['rekordbox', 'rekordbox7', 'rekordbox6'] as const) {
    const dbPath = path.join(base, variant, 'master.db');
    if (exists(dbPath)) { return { dbPath, variant }; }
  }
  return null;
}

export function detectRekordboxDb(): {
  found: boolean;
  dbPath: string | null;
  variant: DbLocation['variant'] | null;
} {
  const home = process.platform === 'win32' && process.env.APPDATA
    ? process.env.APPDATA
    : os.homedir();
  const location = resolveDbPath(home, process.platform, (p) => fs.existsSync(p));
  return location
    ? { found: true, dbPath: location.dbPath, variant: location.variant }
    : { found: false, dbPath: null, variant: null };
}
