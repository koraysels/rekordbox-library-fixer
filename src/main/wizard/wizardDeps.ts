import * as fs from 'fs';
import * as path from 'path';
import { parseDb, type DbLibrary } from '../rekordboxDbParser';
import { realIsRegularFile, relocateTracksInDb } from '../rekordboxDbRelocator';
import { mergeDuplicateEntries, removeEntriesFromDb } from '../rekordboxDbWriter';
import { isRekordboxRunning } from '../rekordboxRunning';
import { findUnplayable, previewConversion, runConversion } from '../convert/conversionRun';
import type { FfmpegStatus } from '../convert/ffmpegBinary';
import type { TrackRelocator } from '../trackRelocator';
import type { DuplicateDetector } from '../duplicateDetector';
import { applyGather } from './gatherApply';
import { fileIdentity, sameContent } from './sameContent';
import { isMountPoint } from './volumes';

/**
 * Everything the wizard service reaches outside itself: the database, the disk,
 * rekordbox, ffmpeg and the Trash. Passed in whole, so a test fakes each one and
 * the service never needs Electron.
 */
export interface WizardDeps {
  platform: NodeJS.Platform;
  parseDb: (dbPath: string, key: string) => Promise<DbLibrary>;
  relocator: Pick<TrackRelocator, 'beginRelocationRun' | 'findMissingTracks' | 'findRelocationCandidates' | 'endRelocationRun'>;
  detector: Pick<DuplicateDetector, 'findDuplicates'>;
  relocateTracksInDb: typeof relocateTracksInDb;
  removeEntriesFromDb: typeof removeEntriesFromDb;
  mergeDuplicateEntries: typeof mergeDuplicateEntries;
  applyGather: typeof applyGather;
  findUnplayable: typeof findUnplayable;
  previewConversion: typeof previewConversion;
  runConversion: typeof runConversion;
  ffmpegStatus: () => FfmpegStatus;
  /** Move a file to the OS Trash. */
  trash: (p: string) => Promise<void>;
  /** Is rekordbox running? Asked before every write. */
  isRunning: () => boolean;
  exists: (p: string) => boolean;
  /** A volume root that is a real mount point, not an empty folder left by an unclean eject. */
  isMountPoint: (root: string) => boolean;
  isRegularFile: (p: string) => boolean;
  fileId: (p: string) => string | undefined;
  sameContent: (a: string, b: string) => Promise<boolean>;
  fileSize: (p: string) => number;
  freeBytes: (dir: string) => number;
  /** Where a step's backup goes. Defaults to `<dbPath>.backup.<timestamp>`. */
  backupPath?: (dbPath: string) => string;
}

/**
 * Free space on the drive holding `dir`. A music folder that does not exist yet
 * is asked about through its nearest existing parent, which is on the same drive.
 */
export function freeBytesAt(dir: string): number {
  let current = path.resolve(dir);
  for (;;) {
    try {
      const st = fs.statfsSync(current);
      return Number(st.bavail) * Number(st.bsize);
    } catch (e) {
      const parent = path.dirname(current);
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT' || parent === current) {throw e;}
      current = parent;
    }
  }
}

/** The real thing. The caller supplies what lives in Electron or in the app's runtime. */
export function realWizardDeps(
  live: Pick<WizardDeps, 'relocator' | 'detector' | 'trash' | 'ffmpegStatus'>,
): WizardDeps {
  return {
    platform: process.platform,
    parseDb,
    relocateTracksInDb,
    removeEntriesFromDb,
    mergeDuplicateEntries,
    applyGather,
    findUnplayable,
    previewConversion,
    runConversion,
    isRunning: () => isRekordboxRunning(),
    exists: fs.existsSync,
    isMountPoint,
    isRegularFile: realIsRegularFile,
    fileId: fileIdentity,
    sameContent: (a, b) => sameContent(a, b),
    fileSize: (p) => fs.statSync(p).size,
    freeBytes: freeBytesAt,
    ...live,
  };
}
