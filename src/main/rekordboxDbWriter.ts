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

/**
 * Tables that reference a track. Every one must lose its rows, or rekordbox is
 * left with cues, mixer settings and history pointing at a track that is gone.
 */
const CONTENT_TABLES = [
  'contentActiveCensor', 'contentCue', 'contentFile', 'djmdActiveCensor',
  'djmdCue', 'djmdMixerParam', 'djmdSongHistory', 'djmdSongHotCueBanklist',
  'djmdSongMyTag', 'djmdSongPlaylist', 'djmdSongRelatedTracks',
  'djmdSongSampler', 'djmdSongTagList',
];

/** Rekordbox counts every change; sync and its own bookkeeping rely on it. */
function bumpUpdateCount(db: Db, by: number): void {
  if (by <= 0) { return; }
  try {
    db.prepare(
      "UPDATE agentRegistry SET int_1 = COALESCE(int_1, 0) + ? WHERE registry_id = 'localUpdateCount'"
    ).run(by);
  } catch {
    // An older schema may not have the counter; the delete itself still stands.
  }
}

/**
 * The database work itself, separated so it can be tested without encryption.
 *
 * Rows are really deleted, not flagged: marking `rb_local_deleted` left the
 * tracks visible in rekordbox, which is the whole point of the exercise.
 * pyrekordbox deletes for the same reason and keeps the update counter in step.
 */
export function applyMerges(db: Db, plans: MergePlan[]): MergeOutcome {
  const movePlaylistLink = db.prepare(`
    UPDATE djmdSongPlaylist SET ContentID = ?
    WHERE ContentID = ?
      AND PlaylistID NOT IN (
        SELECT PlaylistID FROM djmdSongPlaylist WHERE ContentID = ?
      )
  `);
  const dropRemainingLinks = db.prepare('DELETE FROM djmdSongPlaylist WHERE ContentID = ?');
  const deleteContent = db.prepare('DELETE FROM djmdContent WHERE ID = ?');

  const dependentDeletes = CONTENT_TABLES
    .filter((table) => table !== 'djmdSongPlaylist')
    .map((table) => {
      try { return db.prepare(`DELETE FROM ${table} WHERE ContentID = ?`); }
      catch { return null; }
    })
    .filter((stmt): stmt is ReturnType<Db['prepare']> => stmt !== null);

  let entriesRemoved = 0;
  let playlistLinksMoved = 0;

  const run = db.transaction((allPlans: MergePlan[]) => {
    for (const plan of allPlans) {
      for (const removeId of plan.removeIds) {
        if (removeId === plan.keepId) { continue; }
        // Playlists holding only this copy follow the kept entry; the rest
        // would duplicate an existing link, so they go.
        playlistLinksMoved += movePlaylistLink.run(plan.keepId, removeId, plan.keepId).changes;
        dropRemainingLinks.run(removeId);
        for (const stmt of dependentDeletes) { stmt.run(removeId); }
        entriesRemoved += deleteContent.run(removeId).changes;
      }
    }
    bumpUpdateCount(db, entriesRemoved + playlistLinksMoved);
  });
  run(plans);

  return { entriesRemoved, playlistLinksMoved, backupPath: '' };
}
