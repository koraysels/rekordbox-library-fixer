import { ipcMain } from 'electron';
import { runtime, safeConsole } from '../runtime';
import { findBrokenEntries, diagnoseLocation, isStreamingLocation } from '../brokenEntries';
import { removeEntriesFromDb } from '../rekordboxDbWriter';
import { assertWritableLibraryPath } from '../librarySource';
import type { TrackPayload } from '../ipcContract';

// ─── Consolidate Library ──────────────────────────────────────────────────────

const consolidateCancelTokens = new Map<string, { cancelled: boolean }>();

// ─── Filter & Move/Copy ───────────────────────────────────────────────────────

type FilterRule = {
  field: 'artist' | 'album' | 'genre' | 'rating' | 'bpm' | 'year' | 'format';
  op: 'contains' | 'equals' | 'gte' | 'lte';
  value: string;
};

function applyFilters(tracks: TrackPayload[], rules: FilterRule[]): TrackPayload[] {
  return tracks.filter(t => rules.every(r => {
    const raw = (() => {
      switch (r.field) {
        case 'artist':  return (t.artist  || '').toLowerCase();
        case 'album':   return (t.album   || '').toLowerCase();
        case 'genre':   return (t.genre   || '').toLowerCase();
        case 'rating':  return t.rating  ?? 0;
        case 'bpm':     return Number(t.bpm) || 0;
        case 'year':    return parseInt(String(t.year ?? ''), 10) || 0;
        case 'format': {
          const ext = (t.location || '').split('.').pop()?.toLowerCase() ?? '';
          return ext;
        }
      }
    })();
    const val = r.op === 'contains' || r.op === 'equals'
      ? r.value.toLowerCase()
      : parseFloat(r.value);

    switch (r.op) {
      case 'contains': return typeof raw === 'string' && raw.includes(val as string);
      case 'equals':   return typeof raw === 'string' ? raw === val : raw === parseFloat(r.value);
      case 'gte':      return typeof raw === 'number' && raw >= (val as number);
      case 'lte':      return typeof raw === 'number' && raw <= (val as number);
      default:         return true;
    }
  }));
}

const filterCancelTokens = new Map<string, { cancelled: boolean }>();

/**
 * Cleaning up: entries that can never resolve to a file, and the
 * consolidate and filter tools.
 */
export function registerMaintenanceIpc(): void {
  ipcMain.handle('find-broken-entries', async (_e, args: TrackPayload[] | { tracks: TrackPayload[]; includeMissing?: boolean }) => {
    try {
      // Older callers passed the array straight in.
      const tracks = Array.isArray(args) ? args : args.tracks;
      const includeMissing = Array.isArray(args) ? false : !!args.includeMissing;
      return { success: true, data: findBrokenEntries(tracks, undefined, { includeMissing }) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('remove-broken-entries', async (_e, data: { libraryPath: string; trackIds: string[] }) => {
    try {
      assertWritableLibraryPath(data.libraryPath);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${data.libraryPath}.backup.${stamp}`;
      require('fs').copyFileSync(data.libraryPath, backupPath);

      const library = await runtime().rekordboxParser.parseLibrary(data.libraryPath);

      // Check every id against the library before it goes. A stale list from the
      // renderer, or a drive that was unmounted during the scan and is back now,
      // must not cost a real track its cues and its place in every playlist.
      const removing = new Set<string>();
      const kept: Array<{ trackId: string; reason: string }> = [];
      for (const id of data.trackIds) {
        const track = library.tracks.get(id);
        if (!track) { kept.push({ trackId: id, reason: 'not in the library' }); continue; }
        if (isStreamingLocation(track.location)) {
          kept.push({ trackId: id, reason: 'a streaming track, which has no file by design' });
          continue;
        }
        if (diagnoseLocation(track.location) === null) {
          kept.push({ trackId: id, reason: 'its file is there after all' });
          continue;
        }
        removing.add(id);
      }

      let removed = 0;
      for (const id of removing) {
        if (library.tracks.delete(id)) { removed++; }
      }

      // These entries point at nothing, so nothing can inherit their playlist
      // slots: drop the references rather than re-pointing them.
      interface PlaylistNode { tracks?: string[]; children?: PlaylistNode[] }
      const prune = (playlists: PlaylistNode[]) => {
        for (const playlist of playlists) {
          if (playlist.tracks) {
            playlist.tracks = playlist.tracks.filter((id: string) => !removing.has(id));
          }
          if (playlist.children?.length) { prune(playlist.children); }
        }
      };
      prune(library.playlists);

      await runtime().rekordboxParser.saveLibrary(library, data.libraryPath);
      return { success: true, removed, kept, backupPath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('remove-entries-in-db', async (_e, data: {
    dbPath: string; key: string; trackIds: string[];
  }) => {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${data.dbPath}.backup.${stamp}`;
      const outcome = removeEntriesFromDb(data.dbPath, data.key, data.trackIds, { backupPath });
      return { success: true, ...outcome };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('consolidate-preview', async (_, { tracks, destination }: { tracks: TrackPayload[]; destination: string }) => {
    try {
      const preview = runtime().libraryConsolidator.preview(tracks, destination);
      return { success: true, data: preview };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Preview failed' };
    }
  });

  ipcMain.handle('consolidate-library', async (event, {
    operationId, tracks, libraryPath, options
  }: {
    operationId: string;
    tracks: TrackPayload[];
    libraryPath: string;
    options: { destination: string; mode: 'copy' | 'move'; conflictResolution: 'skip' | 'overwrite' | 'quality'; preferLossless?: boolean };
  }) => {
    const cancelToken = { cancelled: false };
    consolidateCancelTokens.set(operationId, cancelToken);

    try {
      const result = runtime().libraryConsolidator.consolidate(
        tracks,
        options,
        (progress) => {
          event.sender.send('consolidate-progress', { operationId, ...progress });
        },
        cancelToken
      );

      // Update XML locations if any files moved successfully
      if (Object.keys(result.locationUpdates).length > 0 && libraryPath) {
        try {
          const fs = require('fs');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = `${libraryPath}.backup.${timestamp}`;
          fs.copyFileSync(libraryPath, backupPath);

          const library = await runtime().rekordboxParser.parseLibrary(libraryPath);
          const locToId = new Map(
            [...library.tracks.entries()].map(([id, t]) => [t.location, id])
          );
          for (const [oldLoc, newLoc] of Object.entries(result.locationUpdates)) {
            const id = locToId.get(oldLoc);
            if (id) {
              const track = library.tracks.get(id);
              if (track) {
                track.location = newLoc;
                locToId.set(newLoc, id);
                locToId.delete(oldLoc);
              }
            }
          }
          await runtime().rekordboxParser.saveLibrary(library, libraryPath);
        } catch (xmlErr) {
          safeConsole.error('Failed to update XML after consolidation:', xmlErr);
        }
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Consolidation failed' };
    } finally {
      consolidateCancelTokens.delete(operationId);
    }
  });

  ipcMain.handle('cancel-consolidate', async (_, operationId: string) => {
    const token = consolidateCancelTokens.get(operationId);
    if (token) {token.cancelled = true;}
    return { success: true };
  });

  ipcMain.handle('filter-preview', async (_, { tracks, filters, destination }: {
    tracks: TrackPayload[];
    filters: FilterRule[];
    destination: string;
  }) => {
    try {
      const filtered = applyFilters(tracks, filters);
      const preview = runtime().libraryConsolidator.preview(filtered, destination);
      return { success: true, data: { ...preview, matchedTracks: filtered.length } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Preview failed' };
    }
  });

  ipcMain.handle('filter-library', async (event, {
    operationId, tracks, libraryPath, filters, options,
  }: {
    operationId: string;
    tracks: TrackPayload[];
    libraryPath: string;
    filters: FilterRule[];
    options: { destination: string; mode: 'copy' | 'move'; conflictResolution: 'skip' | 'overwrite' | 'quality'; preferLossless?: boolean };
  }) => {
    const cancelToken = { cancelled: false };
    filterCancelTokens.set(operationId, cancelToken);

    try {
      const filtered = applyFilters(tracks, filters);
      const result = runtime().libraryConsolidator.consolidate(
        filtered,
        options,
        (progress) => { event.sender.send('filter-progress', { operationId, ...progress }); },
        cancelToken
      );

      if (Object.keys(result.locationUpdates).length > 0 && libraryPath) {
        try {
          const fs = require('fs');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          fs.copyFileSync(libraryPath, `${libraryPath}.backup.${timestamp}`);
          const library = await runtime().rekordboxParser.parseLibrary(libraryPath);
          const locToId = new Map([...library.tracks.entries()].map(([id, t]) => [t.location, id]));
          for (const [oldLoc, newLoc] of Object.entries(result.locationUpdates)) {
            const id = locToId.get(oldLoc);
            if (id) {
              const track = library.tracks.get(id);
              if (track) { track.location = newLoc; locToId.set(newLoc, id); locToId.delete(oldLoc); }
            }
          }
          await runtime().rekordboxParser.saveLibrary(library, libraryPath);
        } catch (xmlErr) {
          safeConsole.error('Failed to update XML after filter-move:', xmlErr);
        }
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Filter operation failed' };
    } finally {
      filterCancelTokens.delete(operationId);
    }
  });

  ipcMain.handle('cancel-filter', async (_, operationId: string) => {
    const token = filterCancelTokens.get(operationId);
    if (token) {token.cancelled = true;}
    return { success: true };
  });
  }
