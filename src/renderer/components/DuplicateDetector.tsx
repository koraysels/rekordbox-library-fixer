import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Settings,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Sparkles,
  Shield
} from 'lucide-react';
import { useDuplicates } from '../hooks';
import { VirtualizedDuplicateList } from './VirtualizedDuplicateList';
import { SettingsPanel } from './SettingsPanel';
import { useSettingsStore } from '../stores/settingsStore';
import type { LibraryData, NotificationType } from '../types';

interface PopoverButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  className?: string;
  children: React.ReactNode;
}

const PopoverButton: React.FC<PopoverButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  icon: Icon,
  title,
  description,
  variant = 'secondary',
  className = '',
  children
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary', 
    danger: 'bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors',
    success: 'btn-primary bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500'
  };

  const updatePopoverPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopoverPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    }
  };

  const handleMouseEnter = () => {
    updatePopoverPosition();
    setShowPopover(true);
  };

  const handleMouseLeave = () => {
    setShowPopover(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onClick}
        disabled={disabled || loading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`${variantClasses[variant]} ${className} flex items-center space-x-2`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Icon size={16} />
        )}
        <span>{children}</span>
      </button>

      {showPopover && createPortal(
        <div 
          className="fixed w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl pointer-events-none"
          style={{
            left: popoverPosition.x,
            top: popoverPosition.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 10000
          }}
        >
          <div className="flex items-start space-x-2">
            <Icon size={16} className="text-rekordbox-purple mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-white text-sm">{title}</h3>
              <p className="text-gray-300 text-xs mt-1">{description}</p>
            </div>
          </div>
          <div 
            className="absolute w-2 h-2 bg-gray-900 border-r border-b border-gray-700 transform rotate-45"
            style={{
              left: '50%',
              top: '100%',
              transform: 'translateX(-50%) translateY(-50%) rotate(45deg)'
            }}
          ></div>
        </div>,
        document.body
      )}
    </>
  );
};

interface DuplicateDetectorProps {
  libraryData: LibraryData;
  libraryPath: string;
  onUpdate: (updatedLibrary: LibraryData) => void;
  showNotification: (type: NotificationType, message: string) => void;
}

const DuplicateDetector: React.FC<DuplicateDetectorProps> = ({
  libraryData,
  libraryPath,
  showNotification
}) => {
  console.log('🏗️ DuplicateDetector render - libraryPath:', libraryPath);
  
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
    selectedCount,
    isResolveDisabled,
    searchFilter,
    setSearchFilter,
    isSearching,
    filteredDuplicates,
    memoizedVisibleDuplicates
  } = useDuplicates(libraryPath, showNotification);
  
  console.log('🎯 DuplicateDetector render - duplicates:', { length: duplicates.length, hasScanned, isScanning });
  
  const [showSettings, setShowSettings] = useState(false);
  const [pathPreferenceInput, setPathPreferenceInput] = useState('');
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  
  // Zustand actions for path preferences
  const addPathPreference = useSettingsStore((state) => state.addPathPreference);
  const removePathPreference = useSettingsStore((state) => state.removePathPreference);

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
          const result = await window.electronAPI.getDuplicateResults(libraryPath);
          if (result.success && result.data) {
            const stored = result.data;
            console.log(`✅ Loaded stored results from SQLite for: ${libraryPath}`);
            console.log(`   - ${stored.duplicates.length} duplicate sets`);
            console.log(`   - ${stored.selectedDuplicates.length} selected`);
            console.log(`   - Has scanned: ${stored.hasScanned}`);
            
            setDuplicates(stored.duplicates || []);
            setSelections(stored.selectedDuplicates || []);
            setHasScanned(stored.hasScanned || false);
            // Merge stored scan options with current preferences
            if (stored.scanOptions) {
              setScanOptions({...scanOptions, ...stored.scanOptions});
            }
          } else {
            // No stored results for this library, reset to default state
            console.log(`🆕 No stored results in SQLite for: ${libraryPath} - fresh start`);
            setHasScanned(false);
            setDuplicates([]);
            setSelections([]);
          }
        } catch (error) {
          console.error('❌ Failed to load stored duplicate results from SQLite:', error);
          // Reset to default state on error
          setHasScanned(false);
          setDuplicates([]);
          setSelections([]);
        } finally {
          setIsLoadingDuplicates(false);
        }
      } else {
        // No library loaded, reset state
        console.log('📭 No library loaded - clearing all state');
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
        const result = await window.electronAPI.saveDuplicateResults({
          libraryPath,
          duplicates,
          selectedDuplicates: Array.from(selectedDuplicates),
          hasScanned,
          scanOptions
        });
        
        if (result.success) {
          console.log(`💾 Saved results to SQLite for: ${libraryPath}`);
        } else {
          console.error('Failed to save duplicate results to SQLite:', result.error);
        }
      } catch (error) {
        console.error('Failed to save duplicate results to SQLite:', error);
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
        
        // Immediately save scan results to SQLite
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
        
        // Update library data with the new version
        if (result.updatedLibrary) {
          // The onUpdate callback should refresh the main library data
          // This will trigger a re-scan if needed
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


  // Path preference functions now use Zustand store
  const handleAddPathPreference = useCallback(() => {
    if (pathPreferenceInput.trim()) {
      addPathPreference(pathPreferenceInput.trim());
      setPathPreferenceInput('');
    }
  }, [pathPreferenceInput, addPathPreference]);

  // Memoize expensive calculations

  return (
    <div className="h-full flex flex-col">
      {/* Library Info - Compact */}
      {libraryPath && (
        <div className="mb-3 px-3 py-2 bg-blue-900/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <p className="text-xs text-blue-300 font-mono truncate">
              {libraryPath.length > 60 ? '...' + libraryPath.slice(-57) : libraryPath}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <PopoverButton
              onClick={scanForDuplicates}
              disabled={isScanning}
              loading={isScanning}
              icon={Search}
              title="Scan for Duplicates"
              description="Analyze your library to find duplicate tracks using advanced algorithms. Uses fingerprinting, metadata matching, and path analysis to identify duplicates with high accuracy."
              variant="primary"
            >
              {isScanning ? 'Scanning...' : 'Scan for Duplicates'}
            </PopoverButton>
            
            <PopoverButton
              onClick={() => setShowSettings(!showSettings)}
              icon={Settings}
              title="Scan Settings"
              description="Configure duplicate detection options including fingerprinting, metadata fields, path preferences, and resolution strategy. Fine-tune the scan to match your needs."
              variant="secondary"
              className={showSettings ? "border-rekordbox-purple" : ""}
            >
              <span className="flex items-center">
                Settings 
                {showSettings ? (
                  <ChevronUp className="w-4 h-4 ml-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-1" />
                )}
              </span>
            </PopoverButton>
          </div>

          {duplicates.length > 0 && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-zinc-400">
                {selectedDuplicates.size} of {duplicates.length} selected
              </span>
              <PopoverButton
                onClick={selectAll}
                icon={CheckCircle2}
                title="Select All Duplicates"
                description="Select all duplicate sets for bulk resolution. This will mark every duplicate set found in your library for processing."
                className="text-sm text-rekordbox-purple hover:text-purple-400 bg-transparent hover:bg-rekordbox-purple/10 px-3 py-1"
              >
                Select All
              </PopoverButton>
              <PopoverButton
                onClick={clearAll}
                icon={Trash2}
                title="Deselect All"
                description="Clear all selections and start fresh. Use this to uncheck all duplicate sets if you want to manually choose which ones to resolve."
                className="text-sm text-rekordbox-purple hover:text-purple-400 bg-transparent hover:bg-rekordbox-purple/10 px-3 py-1"
              >
                Deselect All
              </PopoverButton>
            </div>
          )}
        </div>

        {/* Settings moved to slideout panel */}
      </div>

      {/* Results */}
      {duplicates.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="mb-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold">Duplicate Sets Found</h2>
              <p className="text-sm text-zinc-400 mt-1">
                {searchFilter ? `${filteredDuplicates.length} of ${duplicates.length} sets` : `${duplicates.length} sets`}
              </p>
            </div>
            <PopoverButton
              onClick={resolveDuplicates}
              disabled={isResolveDisabled}
              loading={isScanning}
              icon={Sparkles}
              title="Resolve Selected Duplicates"
              description="Apply resolution strategy to selected duplicate sets. Creates a backup, removes duplicate tracks based on your settings, and updates your library. This action cannot be undone without restoring the backup."
              variant="success"
            >
              {isScanning ? 'Resolving...' : 'Resolve Selected'}
            </PopoverButton>
          </div>

          {/* Search Filter */}
          <div className="mb-4 flex-shrink-0">
            <div className="relative">
              {isSearching ? (
                <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-rekordbox-purple animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              )}
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search duplicates by title, artist, album, or path..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-sm placeholder:text-zinc-500 focus:border-rekordbox-purple focus:outline-none"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="text-xs text-rekordbox-purple">Searching...</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            <VirtualizedDuplicateList
              duplicates={filteredDuplicates}
              selectedDuplicates={selectedDuplicates}
              onToggleSelection={toggleDuplicateSelection}
              resolutionStrategy={resolutionStrategy}
            />
            {isSearching && (
              <div className="absolute inset-0 bg-rekordbox-dark/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                <div className="bg-zinc-800/90 px-4 py-2 rounded-lg border border-rekordbox-purple/30 shadow-lg">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="w-4 h-4 text-rekordbox-purple animate-spin" />
                    <span className="text-sm text-rekordbox-purple">Filtering duplicates...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State - Loading duplicates from database */}
      {isLoadingDuplicates && (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 mx-auto text-rekordbox-purple mb-4 animate-spin" />
            <h3 className="text-lg font-semibold mb-2 text-rekordbox-purple">Loading Duplicates</h3>
            <p className="text-zinc-400">
              Reading duplicate results from database...
            </p>
          </div>
        </div>
      )}
      
      {/* Empty State - After Scan */}
      {!isScanning && !isLoadingDuplicates && duplicates.length === 0 && hasScanned && (
        <div className="card text-center py-12">
          <CheckCircle2 className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Duplicates Found</h3>
          <p className="text-zinc-400">
            Your library appears to be clean! No duplicate tracks were detected.
          </p>
        </div>
      )}

      {/* Initial State - Before Any Scan */}
      {!isScanning && !isLoadingDuplicates && duplicates.length === 0 && !hasScanned && (
        <div className="card text-center py-12">
          <Search className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ready to Scan</h3>
          <p className="text-zinc-400 mb-4">
            Click "Find Duplicates" to scan your library for duplicate tracks.
          </p>
          <PopoverButton
            onClick={scanForDuplicates}
            icon={Search}
            title="Find Duplicates"
            description="Start scanning your library for duplicate tracks. This process analyzes track metadata, file paths, and optionally audio fingerprints to identify potential duplicates."
            variant="primary"
            className="mx-auto"
          >
            Find Duplicates
          </PopoverButton>
        </div>
      )}

      {/* Settings Slideout Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        scanOptions={scanOptions}
        setScanOptions={setScanOptions}
        resolutionStrategy={resolutionStrategy}
        setResolutionStrategy={setResolutionStrategy}
        pathPreferenceInput={pathPreferenceInput}
        setPathPreferenceInput={setPathPreferenceInput}
        addPathPreference={handleAddPathPreference}
        removePathPreference={removePathPreference}
      />
    </div>
  );
};

export default DuplicateDetector;
