import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseDb, type DbLibrary } from '../rekordboxDbParser';
import { isGoneError } from '../fileState';
import { driveName, isVolumeMounted } from '../wizard/volumes';
import { readPdb, type PdbExport } from './pdbReader';
import { readSyncList, type SyncList } from './syncList';
import { stickFile } from './findSticks';
import { checkUsb, flattenLibraryPlaylists, type UsbCheckDeps, type UsbCheckResult } from './usbCheck';

export interface UsbCheckRequest {
  /** The stick's volume root, as `findSticks` reports it. */
  stickRoot: string;
  dbPath: string;
  key: string;
}

/**
 * The stick's files, read from a copy taken into a temp folder, like master.db:
 * the stick is never opened for more than a copy, and a player or rekordbox
 * writing it meanwhile cannot hand the reader half a file. The copy is always removed.
 */
export async function readStick(stickRoot: string): Promise<{ pdb: PdbExport; syncList: SyncList | null }> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rbusb-'));
  try {
    const pdbCopy = path.join(dir, 'export.pdb');
    await fs.promises.copyFile(stickFile(stickRoot, 'export.pdb'), pdbCopy);
    const syncCopy = path.join(dir, 'playlists3.sync');
    let hasSync = true;
    try {
      await fs.promises.copyFile(stickFile(stickRoot, 'playlists3.sync'), syncCopy);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {throw e;}
      hasSync = false;
    }
    return {
      pdb: readPdb(await fs.promises.readFile(pdbCopy)),
      syncList: hasSync ? await readSyncList(syncCopy) : null,
    };
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

export function realUsbCheckDeps(platform: NodeJS.Platform = process.platform): UsbCheckDeps {
  return {
    fileState: async (p) => {
      try {
        await fs.promises.stat(p);
        return 'ok';
      } catch (e) {
        // Only "not there" is missing. EPERM/EACCES, and any error the app
        // cannot read, is a file it may not reach — not a lost file.
        return isGoneError(e) ? 'missing' : 'no-access';
      }
    },
    isVolumeMounted: (p) => isVolumeMounted(p, platform),
    driveName: (p) => driveName(p, platform),
  };
}

export function checkLibraryAgainstStick(
  library: DbLibrary,
  stick: { pdb: PdbExport; syncList: SyncList | null },
  deps: UsbCheckDeps,
): Promise<UsbCheckResult> {
  return checkUsb({
    playlists: flattenLibraryPlaylists(library.playlists),
    tracks: library.tracks,
    stick: stick.pdb,
    syncList: stick.syncList,
  }, deps);
}

/** Read the stick and the library (each from a copy) and compare them. Writes nothing. */
export async function checkStick(request: UsbCheckRequest, deps: UsbCheckDeps = realUsbCheckDeps()): Promise<UsbCheckResult> {
  const [stick, library] = await Promise.all([
    readStick(request.stickRoot),
    parseDb(request.dbPath, request.key),
  ]);
  return checkLibraryAgainstStick(library, stick, deps);
}
