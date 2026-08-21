import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface FoundLibrary {
  kind: 'database' | 'xml';
  path: string;
  label: string;
  /** Bytes, for showing which export is the substantial one. */
  size: number;
  modified: Date;
}

/** Where rekordbox keeps its database, newest layout first. */
export function databaseCandidates(home: string, platform: NodeJS.Platform): string[] {
  const base = platform === 'win32'
    ? path.join(home, 'Pioneer')
    : path.join(home, 'Library', 'Pioneer');
  return ['rekordbox', 'rekordbox7', 'rekordbox6'].map((d) => path.join(base, d, 'master.db'));
}

/** Directories people actually save an XML export into. */
export function xmlSearchDirs(home: string): string[] {
  return [
    path.join(home, 'Documents', 'rekordbox'),
    path.join(home, 'Documents'),
    path.join(home, 'Desktop'),
    path.join(home, 'Downloads'),
    path.join(home, 'Music'),
    home,
  ];
}

/**
 * A rekordbox export opens with a DJ_PLAYLISTS root element. Checking for it
 * keeps unrelated XML (project files, tool output) out of the list.
 */
export function looksLikeRekordboxXml(filePath: string): boolean {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(1024);
    const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, read).toString('utf8').includes('DJ_PLAYLISTS');
  } catch {
    return false;
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch { /* already closed */ } }
  }
}

/**
 * Find libraries this machine already has: rekordbox's own database, and XML
 * exports lying in the usual places. Only the top level of each directory is
 * read, so this stays fast on large home folders.
 */
export function scanForLibraries(
  home: string = os.homedir(),
  platform: NodeJS.Platform = process.platform
): FoundLibrary[] {
  const found: FoundLibrary[] = [];
  const seen = new Set<string>();

  for (const dbPath of databaseCandidates(home, platform)) {
    try {
      const stat = fs.statSync(dbPath);
      if (seen.has(dbPath)) { continue; }
      seen.add(dbPath);
      found.push({
        kind: 'database',
        path: dbPath,
        label: `Rekordbox database (${path.basename(path.dirname(dbPath))})`,
        size: stat.size,
        modified: stat.mtime,
      });
    } catch { /* not installed here */ }
  }

  for (const dir of xmlSearchDirs(home)) {
    let entries: string[];
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const entry of entries) {
      if (!entry.toLowerCase().endsWith('.xml')) { continue; }
      const full = path.join(dir, entry);
      if (seen.has(full)) { continue; }
      try {
        const stat = fs.statSync(full);
        // Rekordbox exports are substantial; skip stray little XML files.
        if (!stat.isFile() || stat.size < 10_000) { continue; }
        if (!looksLikeRekordboxXml(full)) { continue; }
        seen.add(full);
        found.push({
          kind: 'xml',
          path: full,
          // Two folders can hold an export of the same name; say which.
          label: `${entry} — ${path.basename(dir)}`,
          size: stat.size,
          modified: stat.mtime,
        });
      } catch { /* unreadable, skip */ }
    }
  }

  // Most recently touched first: that is almost always the one wanted.
  return found.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}
