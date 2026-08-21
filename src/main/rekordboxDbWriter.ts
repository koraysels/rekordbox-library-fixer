import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import { unlockDatabase } from './rekordboxDbParser';
import { isRekordboxRunning } from './rekordboxRunning';

type Db = InstanceType<typeof Database>;

/** One duplicate set: the entry to keep, and the extra entries to retire. */
export interface MergePlan {
  keepId: string;
  removeIds: string[];
}

export interface MergeOutcome {
  entriesRemoved: number;
  playlistLinksMoved: number;
  backupPath: string;
}

/**
 * Retire duplicate collection entries inside rekordbox's own database.
 *
 * Only two things change, both reversible:
 *  - playlist links pointing at a retired entry are moved to the kept entry,
 *    so no playlist loses the song;
 *  - the retired entries are marked `rb_local_deleted = 1`, which is how
 *    rekordbox itself records a deleted track.
 *
 * Rows are marked rather than deleted on purpose: thirteen tables reference a
 * track (cues, mixer params, history, sampler...) and hard deletion would
 * either orphan them or require touching all of them. Marking leaves every
 * relation intact and can be undone by restoring the backup.
 *
 * No audio file is touched. This only edits rekordbox's catalogue.
 */
export function mergeDuplicateEntries(
  dbPath: string,
  key: string,
  plans: MergePlan[],
  options: { backupPath: string; checkRunning?: () => boolean } = { backupPath: '' }
): MergeOutcome {
  const running = options.checkRunning ?? isRekordboxRunning;
  if (running()) {
    throw new Error('Close rekordbox first — it keeps the database open, and writing while it runs risks losing the change.');
  }
  if (!options.backupPath) {
    throw new Error('A backup path is required; this never writes without one.');
  }

  // Back up before opening for writing, WAL included: recent changes live there.
  fs.copyFileSync(dbPath, options.backupPath);
  for (const suffix of ['-wal', '-shm']) {
    try { fs.copyFileSync(dbPath + suffix, options.backupPath + suffix); } catch { /* absent is fine */ }
  }

  let db: Db | null = null;
  try {
    db = new Database(dbPath);
    unlockDatabase(db, key);
    return applyMerges(db, plans);
  } finally {
    if (db) { db.close(); }
  }
}

/** The database work itself, separated so it can be tested without encryption. */
export function applyMerges(db: Db, plans: MergePlan[]): MergeOutcome {
  const movePlaylistLink = db.prepare(`
    UPDATE djmdSongPlaylist SET ContentID = ?
    WHERE ContentID = ? AND rb_local_deleted = 0
      AND PlaylistID NOT IN (
        SELECT PlaylistID FROM djmdSongPlaylist
        WHERE ContentID = ? AND rb_local_deleted = 0
      )
  `);
  // The kept entry is already in that playlist, so the link is redundant.
  const dropRedundantLink = db.prepare(`
    UPDATE djmdSongPlaylist SET rb_local_deleted = 1
    WHERE ContentID = ? AND rb_local_deleted = 0
  `);
  const retireContent = db.prepare(`
    UPDATE djmdContent SET rb_local_deleted = 1 WHERE ID = ? AND rb_local_deleted = 0
  `);

  let entriesRemoved = 0;
  let playlistLinksMoved = 0;

  const run = db.transaction((allPlans: MergePlan[]) => {
    for (const plan of allPlans) {
      for (const removeId of plan.removeIds) {
        if (removeId === plan.keepId) { continue; }
        playlistLinksMoved += movePlaylistLink.run(plan.keepId, removeId, plan.keepId).changes;
        dropRedundantLink.run(removeId);
        entriesRemoved += retireContent.run(removeId).changes;
      }
    }
  });
  run(plans);

  return { entriesRemoved, playlistLinksMoved, backupPath: '' };
}
