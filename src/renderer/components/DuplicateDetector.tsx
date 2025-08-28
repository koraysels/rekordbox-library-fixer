import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Settings,
  Trash2,
  Loader2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useDuplicates } from '../hooks';
import { VirtualizedDuplicateList } from './VirtualizedDuplicateList';
import { SettingsSlideout, PopoverButton, PageHeader } from './ui';
import { SettingsPanel } from './SettingsPanel';
import { duplicateStorage } from '../db/duplicatesDb';
import { useAppContext } from '../AppWithRouter';

const DuplicateDetector: React.FC = () => {
  const { libraryData, libraryPath, showNotification, setLibraryData } = useAppContext();

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
  } = useDuplicates(libraryPath, showNotification);

  console.log('🎯 DuplicateDetector render - duplicates:', { length: duplicates.length, hasScanned, isScanning });

  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);

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
  const debouncedSaveRef = React.useRef<NodeJS.Timeout>();

  const saveDuplicateResults = useCallback(async () => {
    if (!libraryPath) return;

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
    setIsScanning(true);
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
    } catch (error) {
      showNotification('error', 'Failed to scan for duplicates');
    } finally {
      setIsScanning(false);
    }
  };

  const resolveDuplicates = async () => {
    if (selectedDuplicates.size === 0) {
      showNotification('error', 'Please select duplicates to resolve');
      return;
    }

    // Show confirmation dialog
    const confirmMessage = `This will:\n1. Create a backup of your XML file\n2. Remove ${selectedDuplicates.size} duplicate sets from your library\n3. Save the updated library\n\nProceed?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    const selectedDuplicateSets = duplicates.filter(d =>
      selectedDuplicates.has(d.id)
    );

    setIsScanning(true); // Reuse loading state
    showNotification('info', 'Creating backup and resolving duplicates...');

    try {
      const result = await window.electronAPI.resolveDuplicates({
        libraryPath,
        duplicates: selectedDuplicateSets,
        strategy: resolutionStrategy,
        pathPreferences: scanOptions.pathPreferences,
      });

      if (result.success) {
        // Remove resolved duplicates from the list
        const remainingDuplicates = duplicates.filter(d => !selectedDuplicates.has(d.id));
        setDuplicates(remainingDuplicates);
        setSelections([]);

        showNotification('success',
          `✅ Successfully resolved ${selectedDuplicates.size} duplicate sets!\n` +
          `📁 Backup created: ${result.backupPath}\n` +
          `📝 XML updated with ${result.tracksRemoved} tracks removed`
        );

        // Update library data with the new version to refresh UI
        if (result.updatedLibrary && libraryData) {
          const updatedLibraryData = {
            ...libraryData,
            tracks: result.updatedLibrary.tracks, // The API returns the updated tracks Map
            playlists: result.updatedLibrary.playlists || libraryData.playlists
          };
          setLibraryData(updatedLibraryData);
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
  };



  // Memoize expensive calculations

  return (
    <div className="flex-1 flex flex-col h-full bg-rekordbox-dark">
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
        <div className="flex-shrink-0 py-4 px-0 bg-gray-800 border-b border-gray-700">
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
                className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white w-72
                         focus:border-rekordbox-purple focus:ring-1 focus:ring-rekordbox-purple/50
                         transition-colors"
              />
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between mx-4">
            <div className="flex items-center space-x-4">
              {duplicates.length > 0 && (
                <>
                  <span className="text-sm text-zinc-400">
                    {searchFilter ? `${filteredDuplicates.length} of ${duplicates.length} sets` : `${duplicates.length} sets`}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {selectedDuplicates.size} selected
                  </span>
                </>
              )}
            </div>

            {duplicates.length > 0 && (
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
                    <Loader2 className="w-4 h-4 text-rekordbox-purple animate-spin spinner-loading" />
                  </div>
                  <div className="pl-10 text-sm text-rekordbox-purple">Filtering duplicates...</div>
                </div>
              ) : null}
            </div>
            <div className="relative">
              <VirtualizedDuplicateList
                duplicates={filteredDuplicates}
                selectedDuplicates={selectedDuplicates}
                onToggleSelection={toggleDuplicateSelection}
                resolutionStrategy={resolutionStrategy}
              />
            </div>
          </div>
        ) : hasScanned ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-medium mb-2">No Duplicates Found</h3>
              <p>Your library appears to be clean! No duplicate tracks were detected.</p>
            </div>
          </div>
        ) : isLoadingDuplicates ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Loader2 size={48} className="mx-auto mb-4 text-rekordbox-purple animate-spin spinner-loading" />
              <h3 className="text-lg font-medium mb-2 text-rekordbox-purple">Loading Duplicates</h3>
              <p>Reading duplicate results from database...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
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
    </div>
  );
};

export default DuplicateDetector;
