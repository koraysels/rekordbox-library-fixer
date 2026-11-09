import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as path from 'path';
import { nextUsn, realIsRegularFile, withWritableRekordboxDb } from '../rekordboxDbRelocator';
import { assertWritableLibraryPath } from '../librarySource';
import { RekordboxParser, type RekordboxLibrary } from '../rekordboxParser';
import type { OutputFacts, TargetFormat } from './conversionPlan';

type Db = InstanceType<typeof Database>;

/** One library entry to point at the file its track was converted to. */
export interface EntrySwitch {
  trackId: string;
  /** Where the entry pointed when the run was planned; a row that points elsewhere now is left alone. */
  oldLocation: string;
  newLocation: string;
  target: TargetFormat;
  sizeBytes: number;
  out: OutputFacts;
}

export interface SwitchSkip { trackId: string; reason: string }

/** Per original path (NFC), how many live entries still point at it after the switch. */
export type RemainingReferences = Record<string, number>;

export const MOVED_AWAY = 'the track no longer points at the converted file';

const nfc = (p: string) => (p ?? '').normalize('NFC');

/** Count live locations per wanted path, comparing NFC-normalised: a path may be stored decomposed. */
function countReferences(originals: string[], locations: Iterable<string>): RemainingReferences {
  const remaining: RemainingReferences = {};
  for (const o of originals) remaining[nfc(o)] = 0;
  for (const loc of locations) {
    const key = nfc(loc);
    if (key in remaining) remaining[key]++;
  }
  return remaining;
}

/** rekordbox's `djmdContent.FileType` codes. */
export const FILE_TYPE_FOR: Record<TargetFormat, number> = { aiff: 12, wav: 11, mp3: 1 };
/** rekordbox's XML `Kind` strings. */
export const KIND_FOR: Record<TargetFormat, string> = { aiff: 'AIFF File', wav: 'WAV File', mp3: 'MP3 File' };

/** In a real database 10251 of 10253 MP3 rows store 16, so an MP3 gets 16. */
const MP3_BIT_DEPTH = 16;

/**
 * Point converted tracks' own entries at their new files. Only the columns that
 * describe the file change; `AnalysisDataPath`, cues and everything else stay, so
 * the track keeps its beatgrid, cues and playlists.
 */
export function applySwitchesToDb(
  db: Db,
  switches: EntrySwitch[],
  isRegularFile: (p: string) => boolean = realIsRegularFile
): { switched: number; skipped: SwitchSkip[]; remaining: RemainingReferences } {
  const findTrack = db.prepare('SELECT ID, FolderPath FROM djmdContent WHERE ID = ? AND rb_local_deleted = 0');
  const liveLocations = db.prepare('SELECT FolderPath FROM djmdContent WHERE rb_local_deleted = 0');
  const update = db.prepare(`
    UPDATE djmdContent
    SET FolderPath = ?, FileNameL = ?, FileType = ?, FileSize = ?, BitRate = ?,
        BitDepth = ?, SampleRate = ?, rb_local_usn = COALESCE(?, rb_local_usn)
    WHERE ID = ?
  `);
  const skipped: SwitchSkip[] = [];
  let switched = 0;
  let remaining: RemainingReferences = {};

  db.transaction((all: EntrySwitch[]) => {
    for (const s of all) {
      if (!s.newLocation || !isRegularFile(s.newLocation)) {
        skipped.push({ trackId: s.trackId, reason: 'the file is not there' });
        continue;
      }
      const current = findTrack.get(s.trackId) as { FolderPath: string | null } | undefined;
      if (!current) {
        skipped.push({ trackId: s.trackId, reason: 'not in the collection' });
        continue;
      }
      if (nfc(current.FolderPath ?? '') !== nfc(s.oldLocation)) {
        skipped.push({ trackId: s.trackId, reason: MOVED_AWAY });
        continue;
      }
      const bitDepth = s.target === 'mp3' ? MP3_BIT_DEPTH : (s.out.bitDepth ?? 0);
      const changes = update.run(
        s.newLocation, path.basename(s.newLocation), FILE_TYPE_FOR[s.target], s.sizeBytes,
        s.out.bitrateKbps, bitDepth, s.out.sampleRate, nextUsn(db), s.trackId
      ).changes;
      if (changes > 0) { switched++; }
    }
    // Read inside the transaction, so nothing can change between the switch and the count.
    const rows = liveLocations.all() as Array<{ FolderPath: string | null }>;
    remaining = countReferences(all.map(s => s.oldLocation), rows.map(r => r.FolderPath ?? ''));
  })(switches);

  return { switched, skipped, remaining };
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
): { switched: number; skipped: SwitchSkip[]; remaining: RemainingReferences; backupPath: string } {
  return withWritableRekordboxDb(dbPath, key, opts, (db) => ({
    ...applySwitchesToDb(db, switches, opts.isRegularFile ?? realIsRegularFile),
    backupPath: opts.backupPath,
  }));
}

/** Back up the XML, update the entries, write it back. Refuses a `.db` path. */
export async function switchEntriesInXml(
  xmlPath: string,
  library: RekordboxLibrary,
  switches: EntrySwitch[],
  isRegularFile: (p: string) => boolean = realIsRegularFile,
  parser?: Pick<RekordboxParser, 'saveLibrary'>
): Promise<{ switched: number; skipped: SwitchSkip[]; remaining: RemainingReferences; backupPath: string }> {
  assertWritableLibraryPath(xmlPath);
  const backupPath = `${xmlPath}.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(xmlPath, backupPath);

  const skipped: SwitchSkip[] = [];
  let switched = 0;
  for (const s of switches) {
    if (!s.newLocation || !isRegularFile(s.newLocation)) {
      skipped.push({ trackId: s.trackId, reason: 'the file is not there' });
      continue;
    }
    const track = library.tracks.get(s.trackId);
    if (!track) {
      skipped.push({ trackId: s.trackId, reason: 'not in the collection' });
      continue;
    }
    if (nfc(track.location) !== nfc(s.oldLocation)) {
      skipped.push({ trackId: s.trackId, reason: MOVED_AWAY });
      continue;
    }
    track.location = s.newLocation;
    track.kind = KIND_FOR[s.target];
    track.bitrate = s.out.bitrateKbps;
    track.size = s.sizeBytes;
    track.sampleRate = s.out.sampleRate;
    switched++;
  }
  if (switched > 0) {
    await (parser ?? new RekordboxParser()).saveLibrary(library, xmlPath);
  }
  const remaining = countReferences(
    switches.map(s => s.oldLocation), [...library.tracks.values()].map(t => t.location ?? ''),
  );
  return { switched, skipped, remaining, backupPath };
}
