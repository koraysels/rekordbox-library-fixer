import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as path from 'path';
import { unlockDatabase } from './rekordboxDbParser';
import { isRekordboxRunning } from './rekordboxRunning';

type Db = InstanceType<typeof Database>;

/** One track that has been found again, and where it now lives. */
export interface RelocationPlan {
  trackId: string;
  newLocation: string;
}

export interface RelocationSkip {
  trackId: string;
  reason: string;
}

export interface RelocateOutcome {
  tracksRelocated: number;
  skipped: RelocationSkip[];
  backupPath: string;
}

export interface RelocateOptions {
  backupPath: string;
  checkRunning?: () => boolean;
  /** Injectable so the database work can be tested without touching the disk. */
  isRegularFile?: (p: string) => boolean;
}

const realIsRegularFile = (p: string): boolean => {
  try { return fs.statSync(p).isFile(); } catch { return false; }
};

/**
 * Point tracks at their files again inside rekordbox's own database.
 *
 * Relocation used to write an XML library, which a database-backed collection
 * never reads: the missing tracks stayed missing no matter how many files the
 * search found. Only `FolderPath` and `FileNameL` change, so cues, beatgrids,
 * playlists and the analysis files keyed by `rb_file_id` all stay attached to
 * the same track.
 *
 * Same two refusals as merging: rekordbox must be closed, and a backup is
 * taken first — restoring it undoes everything this did.
 */
export function relocateTracksInDb(
  dbPath: string,
  key: string,
  plans: RelocationPlan[],
  options: RelocateOptions
): RelocateOutcome {
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
    const outcome = applyRelocations(db, plans, options.isRegularFile ?? realIsRegularFile);
    return { ...outcome, backupPath: options.backupPath };
  } finally {
    if (db) { db.close(); }
  }
}

/**
 * Rekordbox numbers every change: `agentRegistry.localUpdateCount` is the last
 * number handed out, and each changed row carries the number it got in
 * `rb_local_usn`. Leaving a row's number behind the counter is how rekordbox
 * and its cloud sync tell what has changed, so both are kept in step here.
 */
function nextUsn(db: Db): number | null {
  try {
    const row = db.prepare(
      "SELECT int_1 AS n FROM agentRegistry WHERE registry_id = 'localUpdateCount'"
    ).get() as { n: number } | undefined;
    if (!row || typeof row.n !== 'number') { return null; }
    const usn = row.n + 1;
    db.prepare("UPDATE agentRegistry SET int_1 = ? WHERE registry_id = 'localUpdateCount'").run(usn);
    return usn;
  } catch {
    // An older schema may not have the counter; the relocation itself stands.
    return null;
  }
}

/**
 * The database work itself, separated so it can be tested without encryption.
 *
 * A plan is skipped rather than applied when the new path is not a file that
 * exists, or when the track is not in the collection. Writing a path that is
 * wrong would turn a track the search could still find into one it cannot.
 */
export function applyRelocations(
  db: Db,
  plans: RelocationPlan[],
  isRegularFile: (p: string) => boolean = realIsRegularFile
): { tracksRelocated: number; skipped: RelocationSkip[] } {
  const findTrack = db.prepare('SELECT ID FROM djmdContent WHERE ID = ? AND rb_local_deleted = 0');
  const updateLocation = db.prepare(`
    UPDATE djmdContent
    SET FolderPath = ?, FileNameL = ?, rb_local_usn = COALESCE(?, rb_local_usn)
    WHERE ID = ?
  `);

  const skipped: RelocationSkip[] = [];
  let tracksRelocated = 0;

  const run = db.transaction((allPlans: RelocationPlan[]) => {
    for (const plan of allPlans) {
      if (!plan.newLocation) {
        skipped.push({ trackId: plan.trackId, reason: 'no new location' });
        continue;
      }
      if (!isRegularFile(plan.newLocation)) {
        skipped.push({ trackId: plan.trackId, reason: 'the file is not there' });
        continue;
      }
      if (!findTrack.get(plan.trackId)) {
        skipped.push({ trackId: plan.trackId, reason: 'not in the collection' });
        continue;
      }
      const changes = updateLocation.run(
        plan.newLocation,
        path.basename(plan.newLocation),
        nextUsn(db),
        plan.trackId
      ).changes;
      if (changes > 0) { tracksRelocated++; }
    }
  });
  run(plans);

  return { tracksRelocated, skipped };
}
