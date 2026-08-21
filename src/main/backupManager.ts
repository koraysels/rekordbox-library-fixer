import * as fs from 'fs';
import * as path from 'path';

export interface BackupEntry {
  path: string;
  /** The library this backup was taken from. */
  originalPath: string;
  created: Date;
  size: number;
  kind: 'xml' | 'database';
}

/** Backups are written next to the library as `<library>.backup.<timestamp>`. */
const BACKUP_SUFFIX = /\.backup\.(.+)$/;

export function isBackupOf(fileName: string, libraryName: string): boolean {
  return fileName.startsWith(`${libraryName}.backup.`);
}

/**
 * Parse the timestamp the app stamps into a backup name. The stamp is an ISO
 * string with `:` and `.` replaced by `-`, so it has to be turned back before
 * Date can read it. Falls back to the file's mtime when unparseable.
 */
export function parseBackupTimestamp(fileName: string, fallback: Date): Date {
  const match = fileName.match(BACKUP_SUFFIX);
  if (!match) { return fallback; }
  const stamp = match[1];
  // 2026-08-21T14-05-35-470Z -> 2026-08-21T14:05:35.470Z
  const iso = stamp.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    '$1T$2:$3:$4.$5Z'
  );
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/** Every backup the app has made for this library, newest first. */
export function listBackups(libraryPath: string): BackupEntry[] {
  const dir = path.dirname(libraryPath);
  const libraryName = path.basename(libraryPath);
  let entries: string[];
  try { entries = fs.readdirSync(dir); } catch { return []; }

  const backups: BackupEntry[] = [];
  for (const entry of entries) {
    if (!isBackupOf(entry, libraryName)) { continue; }
    const full = path.join(dir, entry);
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile()) { continue; }
      backups.push({
        path: full,
        originalPath: libraryPath,
        created: parseBackupTimestamp(entry, stat.mtime),
        size: stat.size,
        kind: libraryName.toLowerCase().endsWith('.db') ? 'database' : 'xml',
      });
    } catch { /* unreadable, skip */ }
  }
  return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
}

/**
 * Put a backup back in place. The current file is itself backed up first, so
 * restoring is never the step that loses data — you can always come forward
 * again.
 */
export function restoreBackup(backupPath: string, libraryPath: string): { safetyCopy: string } {
  if (!fs.existsSync(backupPath)) {
    throw new Error('That backup no longer exists on disk.');
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safetyCopy = `${libraryPath}.backup.${stamp}`;
  if (fs.existsSync(libraryPath)) {
    fs.copyFileSync(libraryPath, safetyCopy);
  }
  fs.copyFileSync(backupPath, libraryPath);
  return { safetyCopy };
}

export function deleteBackup(backupPath: string): void {
  if (!BACKUP_SUFFIX.test(path.basename(backupPath))) {
    throw new Error('Refusing to delete a file that is not a backup.');
  }
  fs.rmSync(backupPath, { force: true });
}
