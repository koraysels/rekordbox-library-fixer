import { ipcMain } from 'electron';
import { runtime, safeConsole, sendToWindow } from '../runtime';
import { substitutePlaylistTrackIds } from '../playlistSubstitution';
import { computeDeletablePaths } from '../safeDeletePaths';
import { mergeDuplicateEntries, type MergePlan } from '../rekordboxDbWriter';
import { assertWritableLibraryPath } from '../librarySource';
import { isLossless } from '../audioQuality';
import { shell } from 'electron';

/** Scans in flight, so a cancel request can reach the one it names. */
const activeOperations = new Map<string, { cancelled: boolean }>();

/**
 * Finding duplicates and resolving them, in an XML library or in
 * rekordbox's own database.
 */
export function registerDuplicateIpc(): void {
  ipcMain.handle('find-duplicates', async (_, options: {
    tracks: any[];
    useFingerprint: boolean;
    useMetadata: boolean;
    metadataFields: string[];
    preferLossless?: boolean;
  }) => {
    const operationId = `dup-${Date.now()}`;
    const cancelToken = { cancelled: false };
    activeOperations.set(operationId, cancelToken);

    try {
      const send = (channel: string, payload: any) => {
        sendToWindow(channel, { operationId, ...payload });
      };
      send('duplicate-scan-progress', {
        type: 'start', current: 0, total: options.tracks.length, setsFound: 0
      });

      const { duplicates, cancelled } = await runtime().duplicateDetector.findDuplicates(
        options.tracks,
        options,
        {
          cancelToken,
          onProgress: (p) => send('duplicate-scan-progress', { type: 'progress', ...p }),
          onDuplicateSet: (set) => send('duplicate-scan-set', { set }),
        }
      );

      send('duplicate-scan-progress', {
        type: cancelled ? 'cancelled' : 'complete',
        current: options.tracks.length,
        total: options.tracks.length,
        setsFound: duplicates.length,
      });

      return { success: true, data: duplicates, cancelled, operationId };
    } catch (error) {
      runtime().logger.error('DUPLICATE_DETECTION_FAILED', {
        trackCount: options.tracks.length,
        options,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      activeOperations.delete(operationId);
    }
  });

  ipcMain.handle('merge-duplicates-in-db', async (_e, data: {
    dbPath: string; key: string; plans: MergePlan[];
  }) => {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${data.dbPath}.backup.${stamp}`;
      const outcome = mergeDuplicateEntries(data.dbPath, data.key, data.plans, { backupPath });
      return { success: true, ...outcome, backupPath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('cancel-duplicate-scan', async (_, operationId: string) => {
    const token = activeOperations.get(operationId);
    if (token) {
      token.cancelled = true;
      return { success: true };
    }
    return { success: false, error: 'Operation not found' };
  });

  ipcMain.handle('resolve-duplicates', async (_, resolution: {
    libraryPath: string;
    duplicates: any[];
    strategy: 'keep-highest-quality' | 'keep-newest' | 'keep-oldest' | 'keep-preferred-path' | 'manual';
    pathPreferences: string[];
    preferLossless?: boolean;
    deleteFromDisk?: boolean;
  }) => {
    safeConsole.log(`🔧 IPC: Resolving ${resolution.duplicates.length} duplicate sets`);
    try {
      // Step 1: Create backup of original XML
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Saving writes XML; doing that to master.db would destroy the database.
      assertWritableLibraryPath(resolution.libraryPath);

      const backupPath = `${resolution.libraryPath}.backup.${timestamp}`;

      const fs = require('fs');
      fs.copyFileSync(resolution.libraryPath, backupPath);
      safeConsole.log(`📁 Backup created: ${backupPath}`);

      // Step 2: Parse current library
      const library = await runtime().rekordboxParser.parseLibrary(resolution.libraryPath);

      // Step 3: Determine which tracks to remove for each duplicate set
      const tracksToRemove: string[] = [];
      // removedTrackId -> keptTrackId, so playlist references can be re-pointed
      // (not dropped) and playlists stay complete.
      const replacement = new Map<string, string>();

      for (const duplicateSet of resolution.duplicates) {
        const tracksInSet = duplicateSet.tracks;
        let trackToKeep;

        // Apply resolution strategy
        if (resolution.strategy === 'keep-highest-quality') {
          const qualityScore = (t: any) => (t.bitrate || 0) + (t.size || 0) / 1000000;
          trackToKeep = tracksInSet.reduce((best: any, current: any) => {
            if (resolution.preferLossless) {
              const bestLossless = isLossless(best.location || '');
              const currentLossless = isLossless(current.location || '');
              if (currentLossless && !bestLossless) {return current;}
              if (!currentLossless && bestLossless) {return best;}
            }
            return qualityScore(current) > qualityScore(best) ? current : best;
          });
        } else if (resolution.strategy === 'keep-newest') {
          trackToKeep = tracksInSet.reduce((newest: any, current: any) => {
            if (!newest.dateModified) {return current;}
            if (!current.dateModified) {return newest;}
            return new Date(current.dateModified) > new Date(newest.dateModified) ? current : newest;
          });
        } else if (resolution.strategy === 'keep-oldest') {
          trackToKeep = tracksInSet.reduce((oldest: any, current: any) => {
            if (!oldest.dateAdded) {return current;}
            if (!current.dateAdded) {return oldest;}
            return new Date(current.dateAdded) < new Date(oldest.dateAdded) ? current : oldest;
          });
        } else if (resolution.strategy === 'keep-preferred-path') {
          // Sort by path preference
          const sortedTracks = [...tracksInSet].sort((a: any, b: any) => {
            const aMatch = resolution.pathPreferences.findIndex((pref: string) =>
              a.location && a.location.toLowerCase().includes(pref.toLowerCase())
            );
            const bMatch = resolution.pathPreferences.findIndex((pref: string) =>
              b.location && b.location.toLowerCase().includes(pref.toLowerCase())
            );

            if (aMatch !== -1 && bMatch !== -1) {return aMatch - bMatch;}
            if (aMatch !== -1) {return -1;}
            if (bMatch !== -1) {return 1;}
            return 0;
          });
          trackToKeep = sortedTracks[0];
        } else {
          // Default: keep first track
          trackToKeep = tracksInSet[0];
        }

        // Add all other tracks to removal list
        const tracksToRemoveFromSet = tracksInSet
          .filter((track: any) => track.id !== trackToKeep.id);

        tracksToRemove.push(...tracksToRemoveFromSet.map((t: any) => t.id));
        tracksToRemoveFromSet.forEach((t: any) => replacement.set(t.id, trackToKeep.id));

        safeConsole.log(`🎵 Duplicate set: keeping "${trackToKeep.name}" (${trackToKeep.location}), removing ${tracksToRemoveFromSet.length} others`);
      }

      // Step 4: Remove tracks from library
      safeConsole.log(`🗑️ Removing ${tracksToRemove.length} duplicate tracks from library`);

      // Collect file locations before deleting from the Map
      const locationsToDelete: string[] = resolution.deleteFromDisk
        ? tracksToRemove
            .map(trackId => library.tracks.get(trackId)?.location)
            .filter((loc): loc is string => !!loc)
        : [];

      // Remove from tracks Map
      tracksToRemove.forEach(trackId => {
        library.tracks.delete(trackId);
      });

      // Re-point playlist references from each removed track to the kept track,
      // so playlists stay complete (a song that lived only in the removed
      // duplicate is preserved, now pointing at the kept file) and no playlist
      // gains a duplicate entry.
      substitutePlaylistTrackIds(library.playlists, replacement);

      // Step 5: Save updated library
      await runtime().rekordboxParser.saveLibrary(library, resolution.libraryPath);

      safeConsole.log(`✅ Successfully resolved duplicates: removed ${tracksToRemove.length} tracks`);
      runtime().logger.logLibrarySaving(resolution.libraryPath, library.tracks.size);

      // Step 6 (optional): Delete files from disk.
      // Several rekordbox entries can point at the SAME file. Only delete a path
      // that no remaining track still references, or we would destroy the audio
      // belonging to a track the user chose to keep.
      const remainingLocations = Array.from(library.tracks.values())
        .map((t: any) => t?.location)
        .filter((loc: any): loc is string => typeof loc === 'string' && loc.length > 0);
      const fsSync = require('fs');
      const isRegularFile = (p: string) => {
        try { return fsSync.statSync(p).isFile(); } catch { return false; }
      };
      const deletablePaths = computeDeletablePaths(locationsToDelete, remainingLocations, isRegularFile);
      const skippedStillReferenced = locationsToDelete.length - deletablePaths.length;
      if (skippedStillReferenced > 0) {
        safeConsole.log(`🛡️ Skipped ${skippedStillReferenced} path(s) still referenced by kept tracks or duplicated in the delete list`);
      }

      const deleteResults = { deleted: 0, trashed: [] as string[], failed: [] as { file: string; error: string }[] };
      if (resolution.deleteFromDisk && deletablePaths.length > 0) {
        for (const loc of deletablePaths) {
          try {
            // Move to the OS trash rather than unlinking, so a wrong call is
            // recoverable by the user instead of destroying audio permanently.
            await shell.trashItem(loc);
            deleteResults.deleted++;
            deleteResults.trashed.push(loc);
            safeConsole.log(`🗑️ Moved to trash: ${loc}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            deleteResults.failed.push({ file: loc, error: msg });
            safeConsole.error(`❌ Failed to trash ${loc}: ${msg}`);
          }
        }
      }

      return {
        success: true,
        backupPath,
        tracksRemoved: tracksToRemove.length,
        filesDeleted: deleteResults.deleted,
        trashedPaths: deleteResults.trashed,
        deleteErrors: deleteResults.failed,
        updatedLibrary: library
      };

    } catch (error) {
      safeConsole.error('❌ Resolution failed:', error);
      runtime().logger.error('DUPLICATE_RESOLUTION_FAILED', {
        strategy: resolution.strategy,
        duplicateSetsCount: resolution.duplicates.length,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });
  }
