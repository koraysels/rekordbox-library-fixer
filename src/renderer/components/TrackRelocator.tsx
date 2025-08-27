import React, { useState, useEffect } from 'react';
import {
  Search,
  Settings,
  RefreshCw,
  MapPin,
  FileX,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Trash2,
  RotateCcw,
  Zap,
  Target,
  FileSearch
} from 'lucide-react';
import { useTrackRelocator } from '../hooks/useTrackRelocator';
import { useSettingsStore } from '../stores/settingsStore';
import { SettingsSlideout, PopoverButton } from './ui';
import { TrackRelocatorSettings } from './TrackRelocatorSettings';
import { useAppContext } from '../AppWithRouter';
import type {
  RelocationCandidate
} from '../types';

const TrackRelocator: React.FC = () => {
  const { libraryData, showNotification } = useAppContext();
  const {
    // State
    missingTracks,
    isScanning,
    hasScanCompleted,
    selectedTrack,
    candidates,
    isFindingCandidates,
    relocations,
    isRelocating,
    searchOptions,
    stats,

    // Actions
    scanForMissingTracks,
    findRelocationCandidates,
    addRelocation,
    removeRelocation,
    executeRelocations,
    updateSearchOptions,
    clearResults
  } = useTrackRelocator(libraryData, showNotification);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMissingTracks, setSelectedMissingTracks] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [newSearchPath, setNewSearchPath] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isAutoRelocating, setIsAutoRelocating] = useState(false);

  // Get settings store
  const relocationOptions = useSettingsStore((state) => state.relocationOptions);
  const addRelocationSearchPath = useSettingsStore((state) => state.addRelocationSearchPath);
  const removeRelocationSearchPath = useSettingsStore((state) => state.removeRelocationSearchPath);

  // Sync search options with store
  useEffect(() => {
    updateSearchOptions(relocationOptions);
  }, [relocationOptions]);

  // Filter missing tracks based on search term
  const filteredMissingTracks = missingTracks.filter(track =>
    track.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
    track.originalLocation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle track selection
  const toggleTrackSelection = (trackId: string) => {
    setSelectedMissingTracks(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(trackId)) {
        newSelection.delete(trackId);
      } else {
        newSelection.add(trackId);
      }
      return newSelection;
    });
  };

  // Select all tracks
  const selectAllTracks = () => {
    setSelectedMissingTracks(new Set(filteredMissingTracks.map(t => t.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedMissingTracks(new Set());
  };

  // Reset track locations (makes them relocatable again)
  const resetSelectedTracks = async () => {
    const selectedIds = Array.from(selectedMissingTracks);
    if (selectedIds.length === 0) {
      showNotification('error', 'Please select tracks to reset');
      return;
    }

    setIsResetting(true);
    try {
      const result = await window.electronAPI.resetTrackLocations(selectedIds);
      if (result.success) {
        showNotification('success', `Reset ${result.data.resetTracks} track locations`);
        clearSelection();
        // Optionally refresh missing tracks scan
        setTimeout(() => scanForMissingTracks(), 500);
      } else {
        showNotification('error', `Reset failed: ${result.error}`);
      }
    } catch (error) {
      showNotification('error', 'Failed to reset track locations');
    } finally {
      setIsResetting(false);
    }
  };

  // Auto relocate selected tracks
  const autoRelocateSelected = async () => {
    const selectedTracks = filteredMissingTracks.filter(track =>
      selectedMissingTracks.has(track.id)
    );

    if (selectedTracks.length === 0) {
      showNotification('error', 'Please select tracks to auto-relocate');
      return;
    }

    if (searchOptions.searchPaths.length === 0) {
      showNotification('error', 'Please configure search paths first');
      return;
    }

    setIsAutoRelocating(true);
    try {
      const result = await window.electronAPI.autoRelocateTracks(selectedTracks, searchOptions);
      if (result.success) {
        const { successfulRelocations, totalTracks } = result.data;
        showNotification('success',
          `Auto-relocated ${successfulRelocations}/${totalTracks} tracks`);
        clearSelection();
        // Refresh the missing tracks list
        setTimeout(() => scanForMissingTracks(), 1000);
      } else {
        showNotification('error', `Auto-relocation failed: ${result.error}`);
      }
    } catch (error) {
      showNotification('error', 'Failed to auto-relocate tracks');
    } finally {
      setIsAutoRelocating(false);
    }
  };

  // Functions for managing search paths
  const addSearchPath = () => {
    if (newSearchPath.trim()) {
      addRelocationSearchPath(newSearchPath.trim());
      setNewSearchPath('');
    }
  };

  const removeSearchPath = (index: number) => {
    removeRelocationSearchPath(index);
  };

  // Handle candidate selection
  const selectCandidate = (candidate: RelocationCandidate) => {
    if (selectedTrack) {
      addRelocation(selectedTrack.id, candidate.path);
      showNotification('success', `Added relocation for "${selectedTrack.name}"`);
    }
  };

  // Show file in folder
  const showInFolder = async (filePath: string) => {
    try {
      await window.electronAPI.showFileInFolder(filePath);
    } catch (error) {
      showNotification('error', 'Failed to open file location');
    }
  };

  if (!libraryData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <FileX size={64} className="mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Library Loaded</h3>
          <p>Please load a Rekordbox library to use the track relocator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-rekordbox-dark">
      {/* Header */}
      <div className="flex-shrink-0 py-4 px-1 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <MapPin className="text-rekordbox-purple" size={24} />
              <h1 className="text-2xl font-bold text-white">Track Relocator</h1>
            </div>
            <div className="text-sm text-gray-400 bg-gray-800 px-3 py-1.5 rounded-full">
              {stats.totalMissingTracks} missing • {stats.configuredRelocations} configured • {selectedMissingTracks.size} selected
            </div>
          </div>
          <div className="flex items-center space-x-3 px-1">
            <PopoverButton
              onClick={() => setShowSettings(!showSettings)}
              icon={Settings}
              title="Search Settings"
              description="Configure search paths, depth, and matching criteria for finding relocated tracks"
            >
              Settings
            </PopoverButton>
            <PopoverButton
              onClick={clearResults}
              icon={RefreshCw}
              title="Clear All Data"
              description="Clear all scan results, relocations, and selections to start fresh"
            >
              Clear
            </PopoverButton>
          </div>
        </div>
      </div>


      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Actions Bar */}
          <div className="flex-shrink-0 py-4 px-0 bg-gray-800 border-b border-gray-700">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 mx-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <PopoverButton
                  onClick={scanForMissingTracks}
                  disabled={isScanning}
                  loading={isScanning}
                  icon={FileSearch}
                  title="Scan for Missing Tracks"
                  description="Analyze your library to find tracks with broken file paths that need relocation"
                  variant="primary"
                  className="w-full"
                >
                  {isScanning ? 'Scanning...' : 'Scan for Missing'}
                </PopoverButton>

                <PopoverButton
                  onClick={autoRelocateSelected}
                  disabled={
                    isAutoRelocating ||
                    selectedMissingTracks.size === 0 ||
                    searchOptions.searchPaths.length === 0
                  }
                  loading={isAutoRelocating}
                  icon={Zap}
                  title="Auto Relocate Tracks"
                  description={
                    "Automatically find and relocate selected tracks using AI-powered matching " +
                    "(80%+ confidence required)"
                  }
                  variant="success"
                  className="w-full"
                >
                  Auto Relocate ({selectedMissingTracks.size})
                </PopoverButton>

                <PopoverButton
                  onClick={resetSelectedTracks}
                  disabled={isResetting || selectedMissingTracks.size === 0}
                  loading={isResetting}
                  icon={RotateCcw}
                  title="Reset Track Locations"
                  description={
                    "Reset selected tracks to make them relocatable again. Tracks stay in " +
                    "playlists but marked as needing relocation"
                  }
                  variant="secondary"
                  className="w-full"
                >
                  Reset Locations ({selectedMissingTracks.size})
                </PopoverButton>

                <PopoverButton
                  onClick={executeRelocations}
                  disabled={isRelocating || relocations.size === 0}
                  loading={isRelocating}
                  icon={Target}
                  title="Apply Manual Relocations"
                  description="Apply all manually configured track relocations to update file paths in your library"
                  variant="success"
                  className="w-full"
                >
                  Apply Manual ({relocations.size})
                </PopoverButton>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tracks..."
                  className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white w-72
                           focus:border-rekordbox-purple focus:ring-1 focus:ring-rekordbox-purple/50
                           transition-colors"
                />
              </div>
            </div>

            {/* Selection Controls */}
            <div className="flex items-center justify-between mx-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={selectAllTracks}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                >
                  Select All ({filteredMissingTracks.length})
                </button>
                <button
                  onClick={clearSelection}
                  disabled={selectedMissingTracks.size === 0}
                  className={
                    "px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 " +
                    "disabled:opacity-50 text-white rounded text-sm transition-colors"
                  }
                >
                  Clear Selection
                </button>
              </div>

              {!stats.hasSearchPaths && (
                <div className="flex items-center space-x-2 text-yellow-400 text-sm">
                  <AlertTriangle size={16} />
                  <span>Configure search paths in Settings to enable auto-relocation</span>
                </div>
              )}
            </div>
          </div>

          {/* Missing Tracks List */}
          <div className="flex-1 overflow-y-auto py-4 px-0 space-y-3">
            {!hasScanCompleted ? (
              <div className="text-center text-gray-400 py-8">
                <FileX size={48} className="mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Track Relocator Ready</h3>
                <p>Click "Scan for Missing" to find tracks that need relocation</p>
                <p className="text-sm mt-2 text-gray-500">
                  This will identify tracks with broken file paths while keeping them in their playlists
                </p>
              </div>
            ) : filteredMissingTracks.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-medium mb-2">All Tracks Located!</h3>
                <p>No missing tracks found in your library</p>
              </div>
            ) : (
              filteredMissingTracks.map((track) => (
                <div
                  key={track.id}
                  className={`bg-gray-800 rounded-lg p-4 border transition-colors cursor-pointer ${
                    selectedMissingTracks.has(track.id)
                      ? 'border-rekordbox-purple bg-purple-900/20'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => toggleTrackSelection(track.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedMissingTracks.has(track.id)}
                          onChange={() => toggleTrackSelection(track.id)}
                          className="rounded border-gray-600 text-rekordbox-purple focus:ring-purple-500"
                        />
                        <div>
                          <h3 className="font-medium text-white">{track.name}</h3>
                          <p className="text-gray-400 text-sm">{track.artist}</p>
                          {track.album && (
                            <p className="text-gray-500 text-xs">{track.album}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 ml-6">
                        <p className="text-gray-500 text-xs font-mono">
                          Missing: {track.originalLocation}
                        </p>
                        {relocations.has(track.id) && (
                          <p className="text-green-400 text-xs font-mono mt-1">
                            → Relocate to: {relocations.get(track.id)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <PopoverButton
                        onClick={(e) => {
                          e?.stopPropagation();
                          findRelocationCandidates(track);
                        }}
                        disabled={isFindingCandidates}
                        loading={isFindingCandidates && selectedTrack?.id === track.id}
                        icon={Search}
                        title="Find Candidates"
                        description="Search for potential new locations for this track using smart matching algorithms"
                        variant="primary"
                      >
                        Find
                      </PopoverButton>

                      {relocations.has(track.id) && (
                        <PopoverButton
                          onClick={(e) => {
                            e?.stopPropagation();
                            removeRelocation(track.id);
                          }}
                          icon={Trash2}
                          title="Remove Relocation"
                          description="Remove the configured relocation for this track"
                          variant="danger"
                        >
                          Remove
                        </PopoverButton>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Candidates Sidebar */}
        {selectedTrack && (
          <div className="w-96 bg-gray-850 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">Relocation Candidates</h3>
                <PopoverButton
                  onClick={() => findRelocationCandidates(selectedTrack)}
                  disabled={isFindingCandidates}
                  loading={isFindingCandidates}
                  icon={RefreshCw}
                  title="Refresh Candidates"
                  description="Search again for potential locations for this track"
                  variant="secondary"
                >
                  Refresh
                </PopoverButton>
              </div>
              <p className="text-sm text-gray-400 mt-1">{selectedTrack.name}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isFindingCandidates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={32} className="animate-spin spinner-loading text-rekordbox-purple" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <FileX size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No candidates found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Try adding more search paths or adjusting the match threshold
                  </p>
                </div>
              ) : (
                candidates.map((candidate, index) => (
                  <div
                    key={index}
                    className={
                      "bg-gray-800 rounded-lg p-3 border border-gray-700 " +
                      "hover:border-gray-600 cursor-pointer transition-colors"
                    }
                    onClick={() => selectCandidate(candidate)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {candidate.path.split('/').pop()}
                        </p>
                        <p className="text-gray-400 text-xs font-mono">
                          {candidate.path}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            candidate.confidence > 0.8 
                              ? 'bg-green-600 text-white' 
                              : candidate.confidence > 0.6
                                ? 'bg-yellow-600 text-white'
                                : 'bg-red-600 text-white'
                          }`}>
                            {Math.round(candidate.confidence * 100)}%
                          </span>
                          <span className="text-xs text-gray-500 capitalize">
                            {candidate.matchType}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showInFolder(candidate.path);
                        }}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="Open in Finder/Explorer"
                      >
                        <ExternalLink size={14} className="text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings Slideout */}
      <SettingsSlideout
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Track Relocator Settings"
        subtitle="Configure search paths and matching criteria"
        width="xl"
      >
        <TrackRelocatorSettings
          searchOptions={searchOptions}
          updateSearchOptions={updateSearchOptions}
          newSearchPath={newSearchPath}
          setNewSearchPath={setNewSearchPath}
          addSearchPath={addSearchPath}
          removeSearchPath={removeSearchPath}
        />
      </SettingsSlideout>
    </div>
  );
};

export { TrackRelocator };
