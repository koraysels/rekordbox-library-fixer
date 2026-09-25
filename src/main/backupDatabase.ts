import * as fs from 'fs';

/**
 * Copy the database aside before writing to it, and check the copy before
 * letting the write proceed.
 *
 * Verification is not ceremony. A backup that silently truncated — a full disk,
 * a disconnected drive — is worse than no backup at all, because it invites you
 * to trust it and only fails when you actually need it. The WAL goes with it:
 * recent changes live there, and a database restored without its WAL is not the
 * database that was backed up.
 */
export interface BackupIO {
  copy: (from: string, to: string) => void;
  size: (p: string) => number;
}

const realIO: BackupIO = {
  copy: (from, to) => fs.copyFileSync(from, to),
  size: (p) => fs.statSync(p).size,
};

export function backupDatabaseFile(
  dbPath: string,
  backupPath: string,
  io: BackupIO = realIO
): void {
  if (!backupPath) {
    throw new Error('A backup path is required; this never writes without one.');
  }

  io.copy(dbPath, backupPath);

  const expected = io.size(dbPath);
  let actual: number;
  try {
    actual = io.size(backupPath);
  } catch {
    throw new Error(`The backup could not be written to ${backupPath}; nothing was changed.`);
  }
  if (actual !== expected) {
    throw new Error(
      `The backup at ${backupPath} is ${actual} bytes but the database is ${expected}. `
      + 'Nothing was changed — check the disk has room.'
    );
  }

  for (const suffix of ['-wal', '-shm']) {
    try { io.copy(dbPath + suffix, backupPath + suffix); } catch { /* absent is fine */ }
  }
}
