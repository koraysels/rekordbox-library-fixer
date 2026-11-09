import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as path from 'path';
import { unlockDatabase } from '../rekordboxDbParser';
import { backupDatabaseFile } from '../backupDatabase';
import { isRekordboxRunning } from '../rekordboxRunning';
import { nextUsn } from '../rekordboxDbRelocator';
import { assertWritableLibraryPath } from '../librarySource';
import { RekordboxParser, type RekordboxLibrary } from '../rekordboxParser';
import type { OutputFacts, TargetFormat } from './conversionPlan';

type Db = InstanceType<typeof Database>;

/** One library entry to point at the file its track was converted to. */
export interface EntrySwitch {
  trackId: string;
  newLocation: string;
  target: TargetFormat;
  sizeBytes: number;
  out: OutputFacts;
}

export interface SwitchSkip { trackId: string; reason: string }

/** rekordbox's `djmdContent.FileType` codes. */
export const FILE_TYPE_FOR: Record<TargetFormat, number> = { aiff: 12, wav: 11, mp3: 1 };
/** rekordbox's XML `Kind` strings. */
export const KIND_FOR: Record<TargetFormat, string> = { aiff: 'AIFF File', wav: 'WAV File', mp3: 'MP3 File' };

/** In a real database 10251 of 10253 MP3 rows store 16, so an MP3 gets 16. */
const MP3_BIT_DEPTH = 16;

const realIsRegularFile = (p: string): boolean => {
  try { return fs.statSync(p).isFile(); } catch { return false; }
};

/**
 * Point converted tracks' own entries at their new files. Only the columns that
 * describe the file change; `AnalysisDataPath`, cues and everything else stay, so
 * the track keeps its beatgrid, cues and playlists.
 */
export function applySwitchesToDb(
  db: Db,
  switches: EntrySwitch[],
  isRegularFile: (p: string) => boolean = realIsRegularFile
): { switched: number; skipped: SwitchSkip[] } {
  const findTrack = db.prepare('SELECT ID FROM djmdContent WHERE ID = ? AND rb_local_deleted = 0');
  const update = db.prepare(`
    UPDATE djmdContent
    SET FolderPath = ?, FileNameL = ?, FileType = ?, FileSize = ?, BitRate = ?,
        BitDepth = ?, SampleRate = ?, rb_local_usn = COALESCE(?, rb_local_usn)
    WHERE ID = ?
  `);
  const skipped: SwitchSkip[] = [];
  let switched = 0;

  db.transaction((all: EntrySwitch[]) => {
    for (const s of all) {
      if (!s.newLocation || !isRegularFile(s.newLocation)) {
        skipped.push({ trackId: s.trackId, reason: 'the file is not there' });
        continue;
      }
      if (!findTrack.get(s.trackId)) {
        skipped.push({ trackId: s.trackId, reason: 'not in the collection' });
        continue;
      }
      const bitDepth = s.target === 'mp3' ? MP3_BIT_DEPTH : (s.out.bitDepth ?? 0);
      const changes = update.run(
        s.newLocation, path.basename(s.newLocation), FILE_TYPE_FOR[s.target], s.sizeBytes,
        s.out.bitrateKbps, bitDepth, s.out.sampleRate, nextUsn(db), s.trackId
      ).changes;
      if (changes > 0) { switched++; }
    }
  })(switches);

  return { switched, skipped };
}

export interface SwitchDbOptions {
  backupPath: string;
  checkRunning?: () => boolean;
  isRegularFile?: (p: string) => boolean;
}

/** Same guards as relocating: rekordbox closed, a verified backup first. */
export function switchEntriesInDb(
  dbPath: string,
  key: string,
  switches: EntrySwitch[],
  opts: SwitchDbOptions
): { switched: number; skipped: SwitchSkip[]; backupPath: string } {
  const running = opts.checkRunning ?? isRekordboxRunning;
  if (running()) {
    throw new Error('Close rekordbox first — it keeps the database open, and writing while it runs risks losing the change.');
  }
  if (!opts.backupPath) {
    throw new Error('A backup path is required; this never writes without one.');
  }
  backupDatabaseFile(dbPath, opts.backupPath);

  let db: Db | null = null;
  try {
    db = new Database(dbPath);
    unlockDatabase(db, key);
    const outcome = applySwitchesToDb(db, switches, opts.isRegularFile ?? realIsRegularFile);
    return { ...outcome, backupPath: opts.backupPath };
  } finally {
    if (db) { db.close(); }
  }
}

/** Back up the XML, update the entries, write it back. Refuses a `.db` path. */
export async function switchEntriesInXml(
  xmlPath: string,
  library: RekordboxLibrary,
  switches: EntrySwitch[],
  parser?: Pick<RekordboxParser, 'saveLibrary'>
): Promise<{ switched: number; backupPath: string }> {
  assertWritableLibraryPath(xmlPath);
  const backupPath = `${xmlPath}.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(xmlPath, backupPath);

  let switched = 0;
  for (const s of switches) {
    const track = library.tracks.get(s.trackId);
    if (!track) { continue; }
    track.location = s.newLocation;
    track.kind = KIND_FOR[s.target];
    track.bitrate = s.out.bitrateKbps;
    track.size = s.sizeBytes;
    track.sampleRate = s.out.sampleRate;
    switched++;
  }
  if (switched > 0) {
    const writer = parser ?? new RekordboxParser();
    await writer.saveLibrary(library, xmlPath);
  }
  return { switched, backupPath };
}
