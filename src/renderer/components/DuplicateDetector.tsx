import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { duplicateStorage } from '../db/duplicatesDb';
import { useAppContext } from '../AppWithRouter';
import { VirtualizedDuplicateList } from './VirtualizedDuplicateList';
import { SettingsSlideout, PopoverButton, PageHeader, DeleteConfirmModal } from './ui';
import { SettingsPanel } from './SettingsPanel';
import { countPlaylistMembership } from '../utils/playlistMembership';

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
    selectAll,
    clearAll,
    setSelections,
    isResolveDisabled,
    searchFilter,
    setSearchFilter,
    isSearching,
    filteredDuplicates
  } = useDuplicates(libraryPath);

  console.log('🎯 DuplicateDetector render - duplicates:', { length: duplicates.length, hasScanned, isScanning });

  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [deleteFromDisk, setDeleteFromDisk] = useState(false);
  const [pendingDeletePaths, setPendingDeletePaths] = useState<string[] | null>(null);

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
            // Merge stored scan options with current preferences
            if (stored.scanOptions) {
              setScanOptions({...scanOptions, ...stored.scanOptions});
            }
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

  const scanForDuplicates = async () => {
    if (!libraryData) { return; }
    setIsScanning(true);
    // Let the browser paint the "Scanning..." state before the heavy,
    // synchronous work (Array.from over thousands of tracks + IPC clone)
    // blocks the main thread — otherwise the UI looks frozen for seconds.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const tracks = Array.from(libraryData.tracks.values());
      const result = await window.electronAPI.findDuplicates({
        tracks,
        ...scanOptions
      });

      if (result.success) {
        const duplicatesFound = result.data;

        // Enhance duplicates with path preferences for resolution strategy
        const enhancedDuplicates = duplicatesFound.map((duplicate: any) => ({
          ...duplicate,
          pathPreferences: scanOptions.pathPreferences
        }));

        setDuplicates(enhancedDuplicates);
        setHasScanned(true);

        // Immediately save scan results to Dexie
        // (The auto-save effect will handle this, but this ensures immediate save)

        showNotification(
          duplicatesFound.length > 0 ? 'info' : 'success',
          duplicatesFound.length > 0
            ? `Found ${duplicatesFound.length} duplicate sets`
            : 'No duplicates found in your library!'
        );
      } else {
        showNotification('error', result.error || 'Scan failed');
      }
    } catch {
      showNotification('error', 'Failed to scan for duplicates');
    } finally {
      setIsScanning(false);
    }
  };

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

        let msg = `✅ Resolved ${selectedDuplicates.size} duplicate sets — ${result.tracksRemoved} tracks removed from XML.\n📁 Backup: ${result.backupPath}`;
        if (withDelete) {
          msg += `\n🗑️ ${result.filesDeleted} file${result.filesDeleted !== 1 ? 's' : ''} deleted from disk`;
          if ((result.deleteErrors?.length ?? 0) > 0) {
            msg += ` (${result.deleteErrors!.length} failed — check paths)`;
          }
        }
        showNotification('success', msg);

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

    if (deleteFromDisk) {
      // Collect all file paths that will be removed so the modal can show them
      const selectedSets = duplicates.filter(d => selectedDuplicates.has(d.id));
      // We don't know which track "wins" client-side perfectly, but we show all paths —
      // the backend will only delete the losers. Show a conservative "up to N files" list.
      const allPaths = selectedSets.flatMap((d: any) =>
        d.tracks.map((t: any) => t.location).filter(Boolean)
      );
      setPendingDeletePaths(allPaths);
      return;
    }

    await executeResolve(false);
  }, [selectedDuplicates, duplicates, deleteFromDisk, executeResolve, showNotification]);


  // Memoize expensive calculations

  return (
    <div className="flex-1 flex flex-col h-full bg-te-grey-100">
      {/* Header */}
      <PageHeader
        title="Duplicate Detection"
        icon={Search}
        stats={`${duplicates.length} sets found • ${selectedDuplicates.size} selected`}
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

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Actions Bar */}
        <div className="flex-shrink-0 py-4 px-0 bg-te-grey-200 border-b-2 border-te-grey-300">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 mx-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <PopoverButton
                onClick={scanForDuplicates}
                disabled={isScanning}
                loading={isScanning}
                icon={Search}
                title="Scan for Duplicates"
                description="Analyze your library to find duplicate tracks using advanced algorithms"
                variant="primary"
              >
                {isScanning ? 'Scanning...' : 'Scan for Duplicates'}
              </PopoverButton>

              <PopoverButton
                onClick={selectAll}
                disabled={duplicates.length === 0}
                icon={CheckCircle2}
                title="Select All Duplicates"
                description="Select all duplicate sets for bulk resolution"
                variant="secondary"
              >
                Select All ({duplicates.length})
              </PopoverButton>

              <PopoverButton
                onClick={clearAll}
                disabled={selectedDuplicates.size === 0}
                icon={Trash2}
                title="Clear Selection"
                description="Deselect all currently selected duplicate sets"
                variant="secondary"
              >
                Clear Selection ({selectedDuplicates.size})
              </PopoverButton>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search duplicates..."
                className="input w-72"
              />
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between mx-4">
            <div className="flex items-center space-x-4">
              {duplicates.length > 0 && (
                <>
                  <span className="te-value">
                    {searchFilter ? `${filteredDuplicates.length} of ${duplicates.length} sets` : `${duplicates.length} sets`}
                  </span>
                  <span className="te-value">
                    {selectedDuplicates.size} selected
                  </span>
                </>
              )}
            </div>

            {duplicates.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Permanently delete the losing duplicate files from disk after resolving">
                  <input
                    type="checkbox"
                    checked={deleteFromDisk}
                    onChange={e => setDeleteFromDisk(e.target.checked)}
                    className="checkbox"
                  />
                  <span className="flex items-center gap-1 text-xs font-te-mono text-te-red-500">
                    <AlertTriangle className="w-3 h-3" />
                    Also delete files from disk
                  </span>
                </label>
                <PopoverButton
                  onClick={resolveDuplicates}
                  disabled={isResolveDisabled}
                  loading={isScanning}
                  icon={Sparkles}
                  title="Resolve Selected Duplicates"
                  description="Apply resolution strategy to selected duplicate sets"
                  variant="success"
                >
                  {isScanning ? 'Resolving...' : 'Resolve Selected'}
                </PopoverButton>
              </div>
            )}
          </div>
        </div>

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
                duplicates={filteredDuplicates}
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
        ) : isScanning ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center te-value">
              <Loader2 size={48} className="mx-auto mb-4 text-te-orange animate-spin spinner-loading" />
              <h3 className="te-title mb-2">Scanning your library…</h3>
              <p>Comparing tracks for duplicates — this can take a moment on large libraries.</p>
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
