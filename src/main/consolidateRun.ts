import * as fs from 'fs';
import type { ConsolidateOptions, ConsolidateProgress, ConsolidateResult, LibraryConsolidator } from './libraryConsolidator';
import type { RekordboxParser, Track } from './rekordboxParser';
import type { IpcResult, TrackPayload } from './ipcContract';
import { isRekordboxDatabasePath } from './librarySource';
import { parseDb } from './rekordboxDbParser';
import { relocateTracksInDb, type RelocationPlan } from './rekordboxDbRelocator';
import { isRekordboxRunning } from './rekordboxRunning';
import { computeDeletablePaths } from './safeDeletePaths';
import { referenceKey } from './convert/applyConversions';
import { CLOSE_REKORDBOX } from './wizard/gatherApply';

export interface ConsolidateRunPayload {
  tracks: TrackPayload[];
  libraryPath: string;
  options: ConsolidateOptions;
  /** Required for a database library: the run writes the new locations into it. */
  dbKey?: string;
}

export interface ConsolidateRunResult extends Omit<ConsolidateResult, 'placed'> {
  /** Library entries pointed at their new place. */
  entriesUpdated: number;
  backupPath?: string;
}

export interface ConsolidateRunDeps {
  consolidator: LibraryConsolidator;
  onProgress: (p: ConsolidateProgress) => void;
  cancelToken: { cancelled: boolean };
  checkRunning?: () => boolean;
  /** Every entry of the database and its location. Defaults to `parseDb`. */
  readDb?: (dbPath: string, key: string) => Promise<Array<{ id: string; location: string }>>;
  relocate?: typeof relocateTracksInDb;
  /** Reads and writes an XML library; only needed for one. */
  xml?: Pick<RekordboxParser, 'parseLibrary' | 'saveLibrary'>;
  backupPath?: (libraryPath: string) => string;
}

export const NEEDS_KEY =
  'The rekordbox database needs its key before any file is moved. Open the library with its key on the '
  + 'load screen, then try again.';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const timestampedBackup = (libraryPath: string) =>
  `${libraryPath}.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;

async function readDbEntries(dbPath: string, key: string): Promise<Array<{ id: string; location: string }>> {
  const library = await parseDb(dbPath, key);
  return [...library.tracks.values()].map((t) => ({ id: t.id, location: t.location }));
}

/**
 * Copy or move a library's files under one folder, then point the library at
 * them — in the database itself for a database library, in the XML for an XML
 * one.
 *
 * A database library is refused before any file is touched when the key is
 * missing, rekordbox is running or the database cannot be read. If the library
 * write then fails, every file is put back where it was. A move deletes an
 * original it had to copy (another drive) or found already there only after the
 * write, and only when no entry still uses it.
 */
export async function runConsolidate(
  payload: ConsolidateRunPayload,
  deps: ConsolidateRunDeps,
): Promise<IpcResult<ConsolidateRunResult>> {
  const { libraryPath, dbKey } = payload;
  const isDb = isRekordboxDatabasePath(libraryPath);
  const running = deps.checkRunning ?? isRekordboxRunning;

  let entries: Array<{ id: string; location: string }> = [];
  if (isDb) {
    if (!dbKey?.trim()) {return { success: false, error: NEEDS_KEY };}
    if (running()) {return { success: false, error: CLOSE_REKORDBOX };}
    try {
      entries = await (deps.readDb ?? readDbEntries)(libraryPath, dbKey);
    } catch (e) {
      return { success: false, error: `The rekordbox database could not be read, so no file was touched: ${errorText(e)}` };
    }
  }

  const { placed, ...summary } = await deps.consolidator.consolidate(
    payload.tracks as unknown as Track[], payload.options, deps.onProgress, deps.cancelToken,
  );
  const data: ConsolidateRunResult = { ...summary, entriesUpdated: 0 };
  const updates = new Map(Object.entries(summary.locationUpdates).map(([from, to]) => [referenceKey(from), to]));
  const newPlace = (loc: string) => updates.get(referenceKey(loc));
  const originals = placed.filter((p) => p.removeOriginal).map((p) => p.from);

  if (updates.size === 0) {return { success: true, data };}
  if (!libraryPath) {
    // No library to switch, so nothing can still point at an original.
    data.errors.push(...await deps.consolidator.removeOriginals(originals));
    return { success: true, data };
  }

  const backupPath = (deps.backupPath ?? timestampedBackup)(libraryPath);
  let remaining: string[];
  try {
    if (isDb) {
      const plans: RelocationPlan[] = [];
      for (const e of entries) {
        const to = newPlace(e.location);
        if (to !== undefined) {plans.push({ trackId: e.id, newLocation: to });}
      }
      const relocate = deps.relocate ?? relocateTracksInDb;
      const outcome = relocate(libraryPath, dbKey as string, plans, { backupPath, checkRunning: running });
      const skipped = new Set(outcome.skipped.map((s) => s.trackId));
      data.entriesUpdated = outcome.tracksRelocated;
      remaining = entries.map((e) => (skipped.has(e.id) ? e.location : newPlace(e.location) ?? e.location));
    } else {
      if (!deps.xml) {throw new Error('No XML reader was given');}
      fs.copyFileSync(libraryPath, backupPath);
      const library = await deps.xml.parseLibrary(libraryPath);
      // Every entry on a moved file follows it, not only the first one found.
      for (const t of library.tracks.values()) {
        const to = newPlace(t.location);
        if (to !== undefined) {
          t.location = to;
          data.entriesUpdated++;
        }
      }
      await deps.xml.saveLibrary(library, libraryPath);
      remaining = [...library.tracks.values()].map((t) => t.location);
    }
  } catch (e) {
    const stuck = await deps.consolidator.putBack(placed);
    return {
      success: false,
      error: `The library was not changed: ${errorText(e)}. `
        + (stuck.length
          ? `${stuck.length} file(s) could not be put back, first ${stuck[0].file}: ${stuck[0].error}`
          : 'Every file was put back where it was.'),
    };
  }
  data.backupPath = backupPath;

  const deletable = computeDeletablePaths(originals, remaining, (p) => deps.consolidator.isRegularFile(p));
  for (const f of await deps.consolidator.removeOriginals(deletable)) {
    data.errors.push({ file: f.file, error: `Copied, but the original could not be removed: ${f.error}` });
  }
  return { success: true, data };
}
