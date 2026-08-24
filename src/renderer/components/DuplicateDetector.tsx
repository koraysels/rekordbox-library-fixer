import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  startDuplicateScan, cancelDuplicateScan, subscribeScan, getScanSnapshot,
  consumeScanResult, type ScanResult,
} from '../scan/duplicateScanSession';
import {
  Search,
  Settings,
  Trash2,
  Loader2,
  CheckCircle2,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { useDuplicates } from '../hooks';
import { useSettingsStore } from '../stores/settingsStore';
import { duplicateStorage } from '../db/duplicatesDb';
import { useAppContext } from '../AppWithRouter';
import { VirtualizedDuplicateList } from './VirtualizedDuplicateList';
import { SettingsSlideout, PopoverButton, PageHeader, DeleteConfirmModal, DuplicateHelp } from './ui';
import { SettingsPanel } from './SettingsPanel';
import { countPlaylistMembership } from '../utils/playlistMembership';
import { pickRecommendedTrack } from '../utils/pickRecommendedTrack';
import { normalizePathForCompare } from '../utils/normalizePath';
import { classifyDuplicateSet, looksLikePlayableFile } from '../utils/classifyDuplicateSet';
import { isStreamingTrack } from '../utils/streamingSource';
import { duplicationHistoryStorage, type ActivityDetail } from '../db/duplicationHistoryDb';

const DuplicateDetector: React.FC = () => {
  const { libraryData, libraryPath, showNotification, setLibraryData } = useAppContext();

  // How many playlists each track belongs to — shown in each duplicate row so
  // you can see a track's playlist reach before choosing which copy to keep.
  const playlistMembership = useMemo(
    () => (libraryData ? countPlaylistMembership(libraryData.playlists) : new Map()),
    [libraryData]
  );

  // Use the custom duplicates hook
  const {
    duplicates,
    setDuplicates,
    isScanning,
    setIsScanning,
    hasScanned,
    setHasScanned,
    selectedDuplicates,
    scanOptions,
    setScanOptions,
    resolutionStrategy,
    setResolutionStrategy,
    currentLibraryPath,
    setCurrentLibraryPath,
    toggleDuplicateSelection,
    clearAll,
    setSelections,
    isResolveDisabled,
    searchFilter,
    setSearchFilter,
    isSearching,
    filteredDuplicates
  } = useDuplicates(libraryPath);

  // "Duplicate" covers two unrelated jobs: real duplicate FILES on disk, and
  // several rekordbox ENTRIES for one file. They are cleaned up separately.
  const [kindFilter, setKindFilter] = useState<'all' | 'files' | 'entries' | 'streaming'>('all');

  const kindCounts = useMemo(() => {
    let entries = 0, files = 0, streaming = 0;
    for (const d of duplicates as any[]) {
      if (d.tracks.some((t: any) => isStreamingTrack(t.location))) { streaming++; continue; }
      if (classifyDuplicateSet(d.tracks) === 'entries') { entries++; } else { files++; }
    }
    return { entries, files, streaming };
  }, [duplicates]);

  // The filter narrows the list; Select All follows it, so you can act on just
  // the real duplicate files or just the same-file entries.
  const visibleDuplicates = useMemo(() => {
    const sets = filteredDuplicates as any[];
    if (kindFilter === 'all') { return sets; }
    if (kindFilter === 'streaming') {
      return sets.filter((d) => d.tracks.some((t: any) => isStreamingTrack(t.location)));
    }
    // Streaming sets belong to neither file group: they have no file at all.
    return sets.filter((d) => {
      if (d.tracks.some((t: any) => isStreamingTrack(t.location))) { return false; }
      return (classifyDuplicateSet(d.tracks) === 'entries') === (kindFilter === 'entries');
    });
  }, [filteredDuplicates, kindFilter]);

  // A set that the filter hides must not stay selected: Resolve would act on
  // sets you can no longer see, which is exactly the kind of surprise this
  // tool must not spring on anyone.
  useEffect(() => {
    const visible = new Set(visibleDuplicates.map((d: any) => d.id));
    const stillValid = Array.from(selectedDuplicates).filter((id: string) => visible.has(id));
    if (stillValid.length !== selectedDuplicates.size) {
      setSelections(stillValid);
    }
  }, [visibleDuplicates, selectedDuplicates, setSelections]);

  const selectAllInMode = useCallback(() => {
    setSelections(visibleDuplicates.map((d: any) => d.id));
  }, [visibleDuplicates, setSelections]);

  console.log('🎯 DuplicateDetector render - duplicates:', { length: duplicates.length, hasScanned, isScanning });

  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [deleteFromDisk, setDeleteFromDisk] = useState(false);
  const [pendingDeletePaths, setPendingDeletePaths] = useState<string[] | null>(null);
  const [wasCancelled, setWasCancelled] = useState(false);

  // The scan lives outside this component (see duplicateScanSession), because
  // switching tabs unmounts the page while the main process scans on.
  const session = useSyncExternalStore(subscribeScan, getScanSnapshot);
  const scanProgress = session.scanning ? session.progress : null;
  // Resolving also blocks the page, so the two reasons to look busy are merged.
  const busy = isScanning || session.scanning;

  // Preferences are now loaded in the useDuplicates hook

  // Load stored duplicate results when library changes OR when component mounts
  useEffect(() => {
    const loadStoredResults = async () => {
      console.log(`🔄 DuplicateDetector effect triggered - Current: "${currentLibraryPath}", New: "${libraryPath}"`);

      // Always load when component first mounts (currentLibraryPath is empty)
      // Or when library actually changes
      if (currentLibraryPath === libraryPath && currentLibraryPath !== '') {
        console.log('↩️ No library change, skipping load');
        return;
      }

      console.log(`📚 Library loading: "${libraryPath}"`);

      if (libraryPath) {
        setIsLoadingDuplicates(true);
        try {
          const stored = await duplicateStorage.getDuplicateResult(libraryPath);
          if (stored) {

            setDuplicates(stored.duplicates || []);
            setSelections(stored.selectedDuplicates || []);
            setHasScanned(stored.hasScanned || false);
            // NOTE: scan options and the resolution strategy are NOT restored
            // from this per-library cache. The persisted settings store is the
            // single source of truth; restoring a stale snapshot here used to
            // reset the user's chosen strategy back to the default.
          } else {
            // No stored results for this library, reset to default state
            setHasScanned(false);
            setDuplicates([]);
            setSelections([]);
          }
        } catch (error) {
          console.error('❌ Failed to load stored duplicate results from Dexie:', error);
          // Reset to default state on error
          setHasScanned(false);
          setDuplicates([]);
          setSelections([]);
        } finally {
          setIsLoadingDuplicates(false);
        }
      } else {
        // No library loaded, reset state
        setHasScanned(false);
        setDuplicates([]);
        setSelections([]);
        setIsLoadingDuplicates(false);
      }

      // Update the current library path tracker
      setCurrentLibraryPath(libraryPath || '');
    };

    loadStoredResults();
  }, [libraryPath]);

  // Preferences are now saved in the useDuplicates hook

  // Debounced save function to reduce database writes
  const debouncedSaveRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDuplicateResults = useCallback(async () => {
    if (!libraryPath) {return;}

    // Clear existing timeout
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }

    // Debounce saves by 1 second
    debouncedSaveRef.current = setTimeout(async () => {
      try {
        await duplicateStorage.saveDuplicateResult({
          libraryPath,
          duplicates,
          selectedDuplicates: Array.from(selectedDuplicates),
          hasScanned,
          scanOptions
        });
        console.log(`💾 Saved results to Dexie for: ${libraryPath}`);
      } catch (error) {
        console.error('Failed to save duplicate results to Dexie:', error);
      }
    }, 1000);
  }, [libraryPath, duplicates, selectedDuplicates, hasScanned, scanOptions]);

  // Auto-save duplicate results when they change (but only for the current library)
  useEffect(() => {
    if (libraryPath && libraryPath === currentLibraryPath) {
      console.log(`💾 Auto-saving results for: ${libraryPath}`);
      saveDuplicateResults();
    }
  }, [duplicates, selectedDuplicates, hasScanned, libraryPath, currentLibraryPath]);

  /**
   * Apply a finished scan. Kept apart from starting one because a scan can
   * finish while the page is on another tab, and its result must still land.
   */
  const applyScanResult = useCallback((result: ScanResult) => {
    if (result.error) {
      showNotification('error', result.error);
      return;
    }
    setDuplicates(result.duplicates);
    setHasScanned(true);
    setWasCancelled(result.cancelled);
    showNotification(
      result.cancelled ? 'info' : (result.duplicates.length > 0 ? 'info' : 'success'),
      result.cancelled
        ? `Scan cancelled — keeping ${result.duplicates.length} sets found so far`
        : result.duplicates.length > 0
          ? `Found ${result.duplicates.length} duplicate sets`
          : 'No duplicates found in your library!',
      // A full scan takes minutes; say so even if the window is behind others.
      { important: !result.cancelled }
    );
  }, [setDuplicates, setHasScanned, showNotification]);

  // Coming back to this tab: show the sets found while away, and apply a scan
  // that finished in the meantime. Without this the page looked as if the scan
  // had been interrupted, when only its display had gone.
  useEffect(() => {
    if (session.scanning && session.libraryPath === libraryPath) {
      setDuplicates(session.sets);
      return;
    }
    const pending = consumeScanResult();
    if (pending && session.libraryPath === libraryPath) {
      applyScanResult(pending);
    }
    // Only on arrival and whenever the session changes state, not per set.
  }, [session.scanning, session.sets, session.libraryPath, libraryPath, setDuplicates, applyScanResult]);

  const scanForDuplicates = async () => {
    if (!libraryData) { return; }
    setIsScanning(true);
    setWasCancelled(false);
    setDuplicates([]);

    // Let the browser paint the scanning state before the heavy, synchronous
    // work (Array.from over thousands of tracks + IPC clone) blocks the thread.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // The scan runs in a module-level session, so leaving this tab no longer
    // throws away the progress and the sets found so far.
    const result = await startDuplicateScan({
      libraryPath,
      tracks: Array.from(libraryData.tracks.values()),
      scanOptions,
    });
    consumeScanResult();
    applyScanResult(result);
    setIsScanning(false);
  };

  const cancelScan = useCallback(async () => {
    if (!await cancelDuplicateScan()) {
      showNotification('error', 'Failed to cancel scan');
    }
  }, [showNotification]);

  /**
   * With a database-backed library, resolving edits rekordbox's own catalogue:
   * the XML format cannot remove tracks, so an export can never clean the
   * collection. Playlist links move to the kept entry and the extra entries are
   * marked deleted; no audio file is touched.
   */
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


  // Memoize expensive calculations

  return (
    <div className="flex-1 flex flex-col h-full bg-te-grey-100">
      {/* Header */}
      <PageHeader
        title="Duplicate Detection"
        icon={Search}
        stats={`${visibleDuplicates.length} of ${duplicates.length} sets${wasCancelled ? ' (partial scan)' : ''} • ${selectedDuplicates.size} selected`}
        actions={
          <PopoverButton
            onClick={() => setShowSettings(!showSettings)}
            icon={Settings}
            title="Scan Settings"
            description="Configure duplicate detection options including fingerprinting, metadata fields, path preferences, and resolution strategy"
          >
            Settings
          </PopoverButton>
        }
      />

      {/* Which library every action here will change. Auto-loading the last
          library on start made it easy to act on the wrong one. */}
      {libraryPath && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 bg-te-grey-100 border-b border-te-grey-300">
          <span className="te-label text-[10px] normal-case">
            Working on{libraryPath.toLowerCase().endsWith('.db') ? ' rekordbox database' : ''}
          </span>
          <span className="te-path-tail text-[11px] text-te-grey-700 flex-1" title={libraryPath}>
            {libraryPath}
          </span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Actions Bar */}
        <div className="flex-shrink-0 bg-te-grey-200 border-b-2 border-te-grey-300">
          {/* Row 1 — the one thing you came here to do, plus finding your way
              around the result. The search grows; nothing else competes. */}
          <div className="flex items-center gap-3 px-4 pt-4">
            {busy ? (
              /* While scanning, this spot carries the progress and the way out.
                 It used to live in the empty results area, which disappears as
                 soon as the first streamed set arrives — taking Cancel with it. */
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button onClick={cancelScan} className="btn-secondary text-xs whitespace-nowrap">
                  <Trash2 size={13} className="inline mr-1.5" />
                  Cancel scan
                </button>
                <div className="flex-1 min-w-0">
                  {scanProgress && scanProgress.total > 0 && (
                    <>
                      <div className="w-full bg-te-grey-300 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-te-orange h-full transition-all duration-200"
                          style={{ width: `${Math.round((scanProgress.current / scanProgress.total) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-te-mono text-te-grey-600 mt-1 truncate normal-case">
                        {scanProgress.current} / {scanProgress.total} tracks · {scanProgress.setsFound} sets found
                        {scanProgress.trackName ? ` · ${scanProgress.trackName}` : ''}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <PopoverButton
                onClick={scanForDuplicates}
                icon={Search}
                title="Scan for Duplicates"
                description="Analyze your library to find duplicate tracks using advanced algorithms"
                variant="primary"
              >
                Scan for Duplicates
              </PopoverButton>
            )}

            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search duplicates..."
              className="input flex-1 min-w-0"
            />
          </div>

          {/* Row 2 — which kind of duplicate you are looking at, and what you
              do with that subset. One segmented control, never wrapping. */}
          {duplicates.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="inline-flex rounded-te border border-te-grey-300 overflow-hidden">
                {([
                  ['all', 'All', duplicates.length,
                    'Every duplicate set found'],
                  ['files', 'Duplicate files', kindCounts.files,
                    'Separate files on disk — resolving can move the extra files to the trash'],
                  ['entries', 'Same-file entries', kindCounts.entries,
                    'Several rekordbox entries for one file — resolving removes the extra entries, no file is touched'],
                  ['streaming', 'Streaming', kindCounts.streaming,
                    'TIDAL, Spotify and the like — these have no file on disk, so nothing can be deleted for them'],
                ] as const).map(([value, label, count, hint], i) => (
                  <button
                    key={value}
                    onClick={() => setKindFilter(value)}
                    title={hint}
                    className={`px-3 py-1.5 text-xs font-te-mono whitespace-nowrap normal-case transition-colors ${
                      i > 0 ? 'border-l border-te-grey-300' : ''
                    } ${
                      kindFilter === value
                        ? 'bg-te-orange text-te-cream'
                        : 'bg-te-grey-100 text-te-grey-700 hover:bg-te-grey-50'
                    }`}
                  >
                    {label}
                    <span className={`ml-1.5 tabular-nums ${kindFilter === value ? 'opacity-70' : 'text-te-grey-500'}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllInMode}
                  disabled={visibleDuplicates.length === 0}
                  className="btn-ghost text-xs disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
                  Select all {visibleDuplicates.length}
                </button>
                <button
                  onClick={clearAll}
                  disabled={selectedDuplicates.size === 0}
                  className="btn-ghost text-xs disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Row 3 — the destructive step. Hidden until something is selected,
              so the resting toolbar has no armed delete control in it. The
              counts live in the page header; repeating them here was noise. */}
          {selectedDuplicates.size > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-3 mx-4 pb-4">
              <span className="te-label text-xs normal-case mr-auto">
                {selectedDuplicates.size} set{selectedDuplicates.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Move the duplicate files of the copies being merged to the system trash. A file the kept track still uses is never touched.">
                  <input
                    type="checkbox"
                    checked={deleteFromDisk}
                    onChange={e => setDeleteFromDisk(e.target.checked)}
                    className="checkbox"
                  />
                  <span className="flex items-center gap-1 text-xs font-te-mono text-te-red-500 normal-case">
                    <AlertTriangle className="w-3 h-3" />
                    Also move duplicate files to trash
                  </span>
                </label>
                <PopoverButton
                  onClick={resolveDuplicates}
                  disabled={isResolveDisabled}
                  loading={busy}
                  icon={Sparkles}
                  title="Resolve Selected Duplicates"
                  description="Apply resolution strategy to selected duplicate sets"
                  variant="success"
                >
                  {busy ? 'Resolving...' : 'Resolve Selected'}
                </PopoverButton>
              </div>
            </div>
          )}
        </div>

        {duplicates.length > 0 && <DuplicateHelp />}

        {/* Results List */}
        {duplicates.length > 0 ? (
          <div className="flex-1 overflow-y-auto py-4 px-2">
            <div className="mb-4 mx-4">
              {isSearching ? (
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-te-orange animate-spin spinner-loading" />
                  </div>
                  <div className="pl-10 text-sm text-te-orange font-te-mono">Filtering duplicates...</div>
                </div>
              ) : null}
            </div>
            <div className="relative">
              <VirtualizedDuplicateList
                duplicates={visibleDuplicates}
                selectedDuplicates={selectedDuplicates}
                onToggleSelection={toggleDuplicateSelection}
                resolutionStrategy={resolutionStrategy}
                playlistMembership={playlistMembership}
              />
            </div>
          </div>
        ) : hasScanned ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center te-value">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-medium mb-2">No Duplicates Found</h3>
              <p>Your library appears to be clean! No duplicate tracks were detected.</p>
            </div>
          </div>
        ) : busy ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center te-value max-w-md w-full px-6">
              <Loader2 size={48} className="mx-auto mb-4 text-te-orange animate-spin spinner-loading" />
              <h3 className="te-title mb-2">Scanning your library…</h3>
              {scanProgress && scanProgress.total > 0 && (
                <>
                  <div className="w-full bg-te-grey-300 rounded-full h-2 overflow-hidden my-3">
                    <div
                      className="bg-te-orange h-full transition-all duration-200"
                      style={{ width: `${Math.round((scanProgress.current / scanProgress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs font-te-mono text-te-grey-600">
                    {scanProgress.current} / {scanProgress.total} tracks • {scanProgress.setsFound} sets found
                  </p>
                  {scanProgress.trackName && (
                    <p className="te-path text-xs text-te-grey-500 truncate mt-1">{scanProgress.trackName}</p>
                  )}
                </>
              )}
              <button onClick={cancelScan} className="btn-secondary mt-4 inline-flex items-center gap-2">
                <Trash2 size={14} /> Cancel scan
              </button>
              <p className="text-xs text-te-grey-500 mt-2 normal-case">
                Results found so far are kept.
              </p>
            </div>
          </div>
        ) : isLoadingDuplicates ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center te-value">
              <Loader2 size={48} className="mx-auto mb-4 text-te-orange animate-spin spinner-loading" />
              <h3 className="te-title mb-2">Loading Duplicates</h3>
              <p>Reading duplicate results from database...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center te-value">
              <Search size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Ready to Scan</h3>
              <p>Click "Scan for Duplicates" to analyze your library for duplicate tracks.</p>
            </div>
          </div>
        )}
      </div>

      {/* Settings Slideout Panel */}
      <SettingsSlideout
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Duplicate Detection Settings"
        subtitle="Configure scan options and resolution preferences"
        width="xl"
      >
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          scanOptions={scanOptions}
          setScanOptions={setScanOptions}
          resolutionStrategy={resolutionStrategy}
          setResolutionStrategy={setResolutionStrategy}
        />
      </SettingsSlideout>

      {/* 3-step delete confirmation modal */}
      {pendingDeletePaths && (
        <DeleteConfirmModal
          libraryPath={libraryPath}
          filePaths={pendingDeletePaths}
          onConfirm={() => {
            setPendingDeletePaths(null);
            executeResolve(true);
          }}
          onCancel={() => setPendingDeletePaths(null)}
        />
      )}
    </div>
  );
};

export default DuplicateDetector;
