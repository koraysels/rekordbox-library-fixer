import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import type { LibraryData, NotificationType } from '../types';

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
    memoizedVisibleDuplicates
  } = useDuplicates(libraryPath, showNotification);
  
  const [showSettings, setShowSettings] = useState(false);
  const [pathPreferenceInput, setPathPreferenceInput] = useState('');

  // Load preferences from localStorage
  useEffect(() => {
    const savedPreferences = localStorage.getItem('duplicateDetectorPreferences');
    if (savedPreferences) {
      try {
        const prefs = JSON.parse(savedPreferences);
        setScanOptions(prefs.scanOptions || scanOptions);
        setResolutionStrategy(prefs.resolutionStrategy || resolutionStrategy);
        // Don't restore hasScanned - it should always start false for new sessions
      } catch (error) {
        console.warn('Failed to load preferences:', error);
      }
    }
  }, []);

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
              setScanOptions(prev => ({...prev, ...stored.scanOptions}));
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
        }
      } else {
        // No library loaded, reset state
        console.log('📭 No library loaded - clearing all state');
        setHasScanned(false);
        setDuplicates([]);
        setSelections([]);
      }

      // Update the current library path tracker
      setCurrentLibraryPath(libraryPath || '');
    };

    loadStoredResults();
  }, [libraryPath]);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    const preferences = {
      scanOptions,
      resolutionStrategy
      // Note: hasScanned is NOT saved in localStorage - now saved in SQLite
    };
    localStorage.setItem('duplicateDetectorPreferences', JSON.stringify(preferences));
  }, [scanOptions, resolutionStrategy]);

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
        setDuplicates(duplicatesFound);
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


  const addPathPreference = useCallback(() => {
    if (pathPreferenceInput.trim() && !scanOptions.pathPreferences.includes(pathPreferenceInput.trim())) {
      setScanOptions(prev => ({
        ...prev,
        pathPreferences: [...prev.pathPreferences, pathPreferenceInput.trim()]
      }));
      setPathPreferenceInput('');
    }
  }, [pathPreferenceInput, scanOptions.pathPreferences]);

  const removePathPreference = useCallback((index: number) => {
    setScanOptions(prev => ({
      ...prev,
      pathPreferences: prev.pathPreferences.filter((_, i) => i !== index)
    }));
  }, []);

  // Memoize expensive calculations

  return (
    <div className="h-full flex flex-col">
      {/* Library Info */}
      {libraryPath && (
        <div className="card mb-4 bg-blue-900/20 border-blue-500/30">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse"></div>
            <div>
              <p className="text-sm text-blue-200 font-medium">Active Library</p>
              <p className="text-xs text-blue-300 font-mono break-all">
                {libraryPath.length > 80 ? '...' + libraryPath.slice(-77) : libraryPath}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={scanForDuplicates}
              disabled={isScanning}
              className="btn-primary flex items-center space-x-2"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{isScanning ? 'Scanning...' : 'Scan for Duplicates'}</span>
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
              {showSettings ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {duplicates.length > 0 && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-zinc-400">
                {selectedDuplicates.size} of {duplicates.length} selected
              </span>
              <button
                onClick={selectAll}
                className="text-sm text-rekordbox-purple hover:text-purple-400"
              >
                Select All
              </button>
              <button
                onClick={clearAll}
                className="text-sm text-rekordbox-purple hover:text-purple-400"
              >
                Deselect All
              </button>
            </div>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t border-zinc-700 pt-4">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Detection Methods</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={scanOptions.useFingerprint}
                      onChange={(e) => setScanOptions({
                        ...scanOptions,
                        useFingerprint: e.target.checked
                      })}
                      className="checkbox"
                    />
                    <span>Audio Fingerprinting (Most Accurate)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={scanOptions.useMetadata}
                      onChange={(e) => setScanOptions({
                        ...scanOptions,
                        useMetadata: e.target.checked
                      })}
                      className="checkbox"
                    />
                    <span>Metadata Matching</span>
                  </label>
                </div>

                {scanOptions.useMetadata && (
                  <div className="mt-3 ml-6 space-y-2">
                    <p className="text-sm text-zinc-400">Match by:</p>
                    {['artist', 'title', 'album', 'duration', 'bpm'].map(field => (
                      <label key={field} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={scanOptions.metadataFields.includes(field)}
                          onChange={(e) => {
                            const fields = e.target.checked
                              ? [...scanOptions.metadataFields, field]
                              : scanOptions.metadataFields.filter(f => f !== field);
                            setScanOptions({
                              ...scanOptions,
                              metadataFields: fields
                            });
                          }}
                          className="checkbox"
                        />
                        <span className="capitalize text-sm">{field}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">Resolution Strategy</h3>
                <div className="space-y-3">
                  <label className="flex items-start space-x-3 p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="strategy"
                      value="keep-highest-quality"
                      checked={resolutionStrategy === 'keep-highest-quality'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="mt-1 text-rekordbox-purple"
                    />
                    <div>
                      <span className="font-medium">Keep Highest Quality</span>
                      <p className="text-sm text-zinc-400">Keeps tracks with higher bitrate and file size</p>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="strategy"
                      value="keep-newest"
                      checked={resolutionStrategy === 'keep-newest'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="mt-1 text-rekordbox-purple"
                    />
                    <div>
                      <span className="font-medium">Keep Newest</span>
                      <p className="text-sm text-zinc-400">Keeps tracks with most recent modification date</p>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="strategy"
                      value="keep-oldest"
                      checked={resolutionStrategy === 'keep-oldest'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="mt-1 text-rekordbox-purple"
                    />
                    <div>
                      <span className="font-medium">Keep Oldest</span>
                      <p className="text-sm text-zinc-400">Keeps tracks that were added to library first</p>
                    </div>
                  </label>
                  <label className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    resolutionStrategy === 'keep-preferred-path' 
                      ? 'border-rekordbox-purple bg-rekordbox-purple/10' 
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}>
                    <input
                      type="radio"
                      name="strategy"
                      value="keep-preferred-path"
                      checked={resolutionStrategy === 'keep-preferred-path'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="mt-1 text-rekordbox-purple"
                    />
                    <div>
                      <span className="font-medium">Keep Preferred Path</span>
                      <p className="text-sm text-zinc-400">Keeps tracks from your preferred folders/locations</p>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="strategy"
                      value="manual"
                      checked={resolutionStrategy === 'manual'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="mt-1 text-rekordbox-purple"
                    />
                    <div>
                      <span className="font-medium">Manual Selection</span>
                      <p className="text-sm text-zinc-400">Let you choose which track to keep for each duplicate</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Path Preferences</h3>
                <p className="text-sm text-zinc-400 mb-3">
                  Preferred paths/folders when using "Keep Preferred Path" strategy. Higher priority paths should be listed first.
                </p>
                
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={pathPreferenceInput}
                    onChange={(e) => setPathPreferenceInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPathPreference()}
                    placeholder="/Users/dj/Music"
                    className="flex-1 px-3 py-1 bg-zinc-800 border border-zinc-600 rounded text-sm"
                  />
                  <button
                    onClick={addPathPreference}
                    className="px-3 py-1 bg-rekordbox-purple hover:bg-purple-600 rounded text-sm"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2">
                  {scanOptions.pathPreferences.map((path, index) => (
                    <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded">
                      <span className="text-sm text-zinc-300">{index + 1}. {path}</span>
                      <button
                        onClick={() => removePathPreference(index)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {scanOptions.pathPreferences.length === 0 && (
                    <div className="text-sm text-zinc-500 text-center py-2">
                      No path preferences set
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Path Preferences - Always visible when strategy is selected */}
        {resolutionStrategy === 'keep-preferred-path' && (
          <div className="card mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">📁 Path Preferences</h3>
              <span className="text-sm text-zinc-400">Priority order (drag to reorder)</span>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-200">
                <strong>How it works:</strong> When duplicates are found, tracks in paths listed here will be kept over others. 
                Higher priority paths (listed first) take precedence.
              </p>
            </div>

            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={pathPreferenceInput}
                onChange={(e) => setPathPreferenceInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPathPreference()}
                placeholder="e.g., /Users/DJ/Main Library, C:\Music\Master"
                className="flex-1 input"
              />
              <button
                onClick={addPathPreference}
                disabled={!pathPreferenceInput.trim()}
                className="btn-primary px-4"
              >
                Add Path
              </button>
            </div>

            <div className="space-y-2">
              {scanOptions.pathPreferences.map((path, index) => (
                <div key={index} className="flex items-center justify-between bg-zinc-800 px-4 py-3 rounded-lg border border-zinc-700">
                  <div className="flex items-center space-x-3">
                    <span className="text-rekordbox-purple font-semibold text-sm">#{index + 1}</span>
                    <span className="font-mono text-sm text-zinc-200">{path}</span>
                  </div>
                  <button
                    onClick={() => removePathPreference(index)}
                    className="text-red-400 hover:text-red-300 text-sm hover:bg-red-900/20 px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {scanOptions.pathPreferences.length === 0 && (
                <div className="text-center py-8 text-zinc-500">
                  <div className="text-4xl mb-2">📂</div>
                  <p>No preferred paths set</p>
                  <p className="text-sm">Add folder paths that should be prioritized when resolving duplicates</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {duplicates.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="mb-4 flex items-center justify-between flex-shrink-0">
            <h2 className="text-xl font-semibold">Duplicate Sets Found</h2>
            <button
              onClick={resolveDuplicates}
              disabled={isResolveDisabled}
              className="btn-primary flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Resolving...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <Shield className="w-3 h-3" />
                  <span>Resolve Selected</span>
                </>
              )}
            </button>
          </div>

          <VirtualizedDuplicateList
            duplicates={duplicates}
            selectedDuplicates={selectedDuplicates}
            onToggleSelection={toggleDuplicateSelection}
            resolutionStrategy={resolutionStrategy}
          />
        </div>
      )}

      
      {/* Empty State - After Scan */}
      {!isScanning && duplicates.length === 0 && hasScanned && (
        <div className="card text-center py-12">
          <CheckCircle2 className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Duplicates Found</h3>
          <p className="text-zinc-400">
            Your library appears to be clean! No duplicate tracks were detected.
          </p>
        </div>
      )}

      {/* Initial State - Before Any Scan */}
      {!isScanning && duplicates.length === 0 && !hasScanned && (
        <div className="card text-center py-12">
          <Search className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ready to Scan</h3>
          <p className="text-zinc-400 mb-4">
            Click "Find Duplicates" to scan your library for duplicate tracks.
          </p>
          <button
            onClick={scanForDuplicates}
            className="btn-primary flex items-center space-x-2 mx-auto"
          >
            <Search className="w-4 h-4" />
            <span>Find Duplicates</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DuplicateDetector;
