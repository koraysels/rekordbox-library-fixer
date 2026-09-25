import { useCallback } from 'react';
import type { ShowNotification } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { pickRecommendedTrack } from '../utils/pickRecommendedTrack';
import { normalizePathForCompare } from '../utils/normalizePath';
import { looksLikePlayableFile } from '../utils/classifyDuplicateSet';
import { duplicationHistoryStorage, type ActivityDetail } from '../db/duplicationHistoryDb';

interface UseDuplicateResolutionArgs {
  duplicates: any[];
  libraryData: any;
  setLibraryData: (data: any) => void;
  selectedDuplicates: Set<string>;
  resolutionStrategy: string;
  scanOptions: any;
  libraryPath: string;
  deleteFromDisk: boolean;
  showNotification: ShowNotification;
  setDuplicates: (updater: any) => void;
  setSelections: (selections: string[]) => void;
  setIsScanning: (scanning: boolean) => void;
  clearAll: () => void;
  setPendingDeletePaths: (paths: string[] | null) => void;
}

/**
 * Resolving a duplicate set, by whichever route the open library needs.
 *
 * Three steps that used to sit in the middle of the page component: working out
 * what would actually be deleted, writing the change (into rekordbox's database
 * or through the XML writer), and recording what happened.
 */
export function useDuplicateResolution({
  duplicates,
  libraryData,
  setLibraryData,
  selectedDuplicates,
  resolutionStrategy,
  scanOptions,
  libraryPath,
  deleteFromDisk,
  showNotification,
  setDuplicates,
  setSelections,
  setIsScanning,
  clearAll,
  setPendingDeletePaths,
}: UseDuplicateResolutionArgs) {
  const resolveInDatabase = useCallback(async () => {
    const selectedSets = duplicates.filter((d) => selectedDuplicates.has(d.id));
    if (selectedSets.length === 0) { return; }

    const { running } = await window.electronAPI.isRekordboxRunning();
    if (running) {
      showNotification('error', 'Close rekordbox first — it keeps its database open while it runs.');
      return;
    }

    const plans = selectedSets.map((d: any) => {
      const keeper = pickRecommendedTrack(d.tracks, resolutionStrategy, d.pathPreferences);
      return {
        keepId: keeper?.id ?? d.tracks[0].id,
        removeIds: d.tracks.filter((t: any) => t.id !== (keeper?.id ?? d.tracks[0].id)).map((t: any) => t.id),
      };
    });

    setIsScanning(true);
    try {
      const result = await window.electronAPI.mergeDuplicatesInDb({
        dbPath: libraryPath,
        key: useSettingsStore.getState().rekordboxDbKey,
        plans,
      });
      if (result.success) {
        showNotification(
          'success',
          `Merged ${plans.length} set${plans.length !== 1 ? 's' : ''} in rekordbox — `
          + `${result.entriesRemoved} extra entr${result.entriesRemoved === 1 ? 'y' : 'ies'} removed, `
          + `${result.playlistLinksMoved} playlist link${result.playlistLinksMoved === 1 ? '' : 's'} moved to the kept track. `
          + 'Reopen rekordbox to see it. The database was backed up first — undo from the Backups tab.',
          { important: true }
        );
        void duplicationHistoryStorage.record({
          libraryPath,
          timestamp: new Date(),
          type: 'duplicate-merge',
          summary: `Merged ${plans.length} sets directly in the rekordbox database`,
          backupPath: result.backupPath,
          details: plans.flatMap((p) => p.removeIds.map((id: string) => ({ action: 'merged' as const, from: id, to: p.keepId }))),
        });
        setDuplicates((prev: any[]) => prev.filter((d) => !selectedDuplicates.has(d.id)));
        clearAll();
      } else {
        showNotification('error', result.error || 'Could not update the rekordbox database', { important: true });
      }
    } finally {
      setIsScanning(false);
    }
  }, [duplicates, selectedDuplicates, resolutionStrategy, libraryPath, showNotification, setDuplicates, clearAll, setIsScanning]);

  const executeResolve = useCallback(async (withDelete: boolean) => {
    const selectedDuplicateSets = duplicates.filter(d => selectedDuplicates.has(d.id));

    setIsScanning(true);
    showNotification('info', 'Creating backup and resolving duplicates...');

    try {
      const result = await window.electronAPI.resolveDuplicates({
        libraryPath,
        duplicates: selectedDuplicateSets,
        strategy: resolutionStrategy,
        pathPreferences: scanOptions.pathPreferences,
        preferLossless: scanOptions.preferLossless,
        deleteFromDisk: withDelete,
      });

      if (result.success) {
        const remainingDuplicates = duplicates.filter(d => !selectedDuplicates.has(d.id));
        setDuplicates(remainingDuplicates);
        setSelections([]);

        // Say what actually happened: duplicate entries are merged into the
        // copy you keep and playlists follow it. "Removed from XML" read like
        // music had been lost.
        const sets = selectedDuplicates.size;
        const merged = result.tracksRemoved ?? 0;
        let msg = `✅ Merged ${sets} duplicate set${sets !== 1 ? 's' : ''} — ${merged} extra entr${merged !== 1 ? 'ies' : 'y'} folded into the track you kept. Playlists now point at it.`;
        if (withDelete) {
          const trashed = result.filesDeleted ?? 0;
          msg += trashed > 0
            ? `\n🗑️ ${trashed} duplicate file${trashed !== 1 ? 's' : ''} moved to the trash`
            : '\n🗑️ No files needed removing — every copy pointed at the same file';
          if ((result.deleteErrors?.length ?? 0) > 0) {
            msg += ` (${result.deleteErrors!.length} could not be trashed — check paths)`;
          }
        }
        msg += `\n📁 Library backup: ${result.backupPath}`;
        showNotification('success', msg, { important: true });

        // Record what happened so the History tab can be used to verify it.
        const details: ActivityDetail[] = [];
        for (const set of selectedDuplicateSets as any[]) {
          const keeper = pickRecommendedTrack(set.tracks, resolutionStrategy, set.pathPreferences);
          for (const t of set.tracks) {
            if (t.id === keeper?.id) { continue; }
            details.push({
              action: 'merged',
              trackName: `${t.artist} - ${t.name}`,
              from: t.location,
              to: keeper?.location,
            });
          }
        }
        for (const trashed of (result.trashedPaths ?? [])) {
          details.push({ action: 'trashed', from: trashed });
        }
        for (const failure of (result.deleteErrors ?? [])) {
          details.push({ action: 'failed', from: failure.file, error: failure.error });
        }
        void duplicationHistoryStorage.record({
          libraryPath,
          timestamp: new Date(),
          type: 'duplicate-merge',
          summary: `Merged ${sets} duplicate set${sets !== 1 ? 's' : ''}`
            + ` — ${merged} entr${merged !== 1 ? 'ies' : 'y'} folded in`
            + (withDelete ? `, ${result.filesDeleted} file${result.filesDeleted !== 1 ? 's' : ''} to trash` : ''),
          backupPath: result.backupPath,
          details,
        });

        if (result.updatedLibrary && libraryData) {
          setLibraryData({
            ...libraryData,
            tracks: result.updatedLibrary.tracks,
            playlists: result.updatedLibrary.playlists || libraryData.playlists,
          });
        }
      } else {
        showNotification('error', `Failed to resolve duplicates: ${result.error}`);
      }
    } catch (error) {
      console.error('Resolution failed:', error);
      showNotification('error', 'Failed to resolve duplicates. Check console for details.');
    } finally {
      setIsScanning(false);
    }
  }, [duplicates, selectedDuplicates, libraryPath, resolutionStrategy, scanOptions, libraryData, setDuplicates, setSelections, setLibraryData, showNotification, setIsScanning]);

  const resolveDuplicates = useCallback(async () => {
    if (selectedDuplicates.size === 0) {
      showNotification('error', 'Please select duplicates to resolve');
      return;
    }

    if (libraryPath.toLowerCase().endsWith('.db')) {
      await resolveInDatabase();
      return;
    }

    if (deleteFromDisk) {
      // Collect all file paths that will be removed so the modal can show them
      const selectedSets = duplicates.filter(d => selectedDuplicates.has(d.id));
      // Show only the paths that will actually be trashed: per set, drop the
      // copy that is kept, and drop any path the kept copy still uses (several
      // rekordbox entries can point at the same file — that file stays).
      const losingPaths = selectedSets.flatMap((d: any) => {
        const keeper = pickRecommendedTrack(d.tracks, resolutionStrategy, d.pathPreferences);
        const keeperLocation = normalizePathForCompare(keeper?.location);
        return d.tracks
          .filter((t: any) => t.id !== keeper?.id)
          .map((t: any) => t.location)
          // Only real files can be trashed. Rekordbox also stores folders,
          // truncated locations and streaming ids; proposing those was alarming
          // and the backend refuses them anyway.
          .filter((loc: string) => loc && looksLikePlayableFile(loc)
            && normalizePathForCompare(loc) !== keeperLocation);
      });
      const uniquePaths = Array.from(new Set(losingPaths));
      if (uniquePaths.length === 0) {
        // Nothing to trash (e.g. every copy points at the same file) — don't
        // make the user confirm a deletion that would delete nothing.
        await executeResolve(false);
        return;
      }
      setPendingDeletePaths(uniquePaths);
      return;
    }

    await executeResolve(false);
  }, [selectedDuplicates, duplicates, deleteFromDisk, executeResolve, showNotification, libraryPath, resolveInDatabase]);

  return { resolveDuplicates, executeResolve, resolveInDatabase };
}
