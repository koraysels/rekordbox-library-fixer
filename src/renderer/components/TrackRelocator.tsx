import React, { useState, useEffect } from 'react';
import {
  Search,
  FolderOpen,
  Settings,
  RefreshCw,
  MapPin,
  FileX,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Trash2,
  Plus,
  X,
  Cloud,
  User
} from 'lucide-react';
import { useTrackRelocator } from '../hooks/useTrackRelocator';
import type { 
  LibraryData, 
  NotificationType, 
  MissingTrack, 
  RelocationCandidate,
  CloudSyncIssue,
  OwnershipIssue 
} from '../types';

interface TrackRelocatorProps {
  libraryData: LibraryData | null;
  showNotification: (type: NotificationType, message: string) => void;
}

const TrackRelocator: React.FC<TrackRelocatorProps> = ({
  libraryData,
  showNotification
}) => {
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
    relocationResults,
    cloudSyncIssues,
    isDetectingCloudIssues,
    isFixingCloudIssues,
    ownershipIssues,
    isDetectingOwnershipIssues,
    isFixingOwnershipIssues,
    searchOptions,
    dropboxConnected,
    stats,
    
    // Actions
    scanForMissingTracks,
    findRelocationCandidates,
    addRelocation,
    removeRelocation,
    executeRelocations,
    detectCloudSyncIssues,
    fixCloudSyncIssues,
    initializeDropboxAPI,
    detectOwnershipIssues,
    fixOwnershipIssues,
    updateSearchOptions,
    clearResults
  } = useTrackRelocator(libraryData, showNotification);

  const [activeTab, setActiveTab] = useState<'missing' | 'cloud' | 'ownership' | 'settings'>('missing');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMissingTracks, setSelectedMissingTracks] = useState<Set<string>>(new Set());
  const [selectedCloudIssues, setSelectedCloudIssues] = useState<Set<string>>(new Set());
  const [selectedOwnershipIssues, setSelectedOwnershipIssues] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [newSearchPath, setNewSearchPath] = useState('');

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
    setSelectedCloudIssues(new Set());
    setSelectedOwnershipIssues(new Set());
  };

  // Add search path
  const addSearchPath = () => {
    if (newSearchPath.trim()) {
      updateSearchOptions({
        searchPaths: [...searchOptions.searchPaths, newSearchPath.trim()]
      });
      setNewSearchPath('');
    }
  };

  // Remove search path
  const removeSearchPath = (index: number) => {
    const newPaths = searchOptions.searchPaths.filter((_, i) => i !== index);
    updateSearchOptions({ searchPaths: newPaths });
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
      <div className="flex-shrink-0 p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <MapPin className="text-rekordbox-purple" size={24} />
              <h1 className="text-xl font-bold text-white">Track Relocator</h1>
            </div>
            <div className="text-sm text-gray-400">
              {stats.totalMissingTracks} missing • {stats.configuredRelocations} configured
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Settings"
            >
              <Settings size={20} className="text-gray-300" />
            </button>
            <button
              onClick={clearResults}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Clear Results"
            >
              <RefreshCw size={20} className="text-gray-300" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mt-4">
          {[
            { id: 'missing' as const, label: 'Missing Tracks', count: stats.totalMissingTracks, icon: FileX },
            { id: 'cloud' as const, label: 'Cloud Sync', count: stats.cloudSyncIssues, icon: Cloud },
            { id: 'ownership' as const, label: 'Ownership', count: stats.ownershipIssues, icon: User }
          ].map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                activeTab === id
                  ? 'bg-rekordbox-purple text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
              {count > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700">
          <h3 className="font-medium text-white mb-3">Search Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Search Depth</label>
              <input
                type="number"
                min="1"
                max="10"
                value={searchOptions.searchDepth}
                onChange={(e) => updateSearchOptions({ searchDepth: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Match Threshold</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={searchOptions.matchThreshold}
                onChange={(e) => updateSearchOptions({ matchThreshold: parseFloat(e.target.value) })}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{Math.round(searchOptions.matchThreshold * 100)}%</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-2">Search Paths</label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={newSearchPath}
                onChange={(e) => setNewSearchPath(e.target.value)}
                placeholder="Enter search path..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                onKeyDown={(e) => e.key === 'Enter' && addSearchPath()}
              />
              <button
                onClick={addSearchPath}
                className="px-4 py-2 bg-rekordbox-purple hover:bg-purple-600 text-white rounded-lg transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {searchOptions.searchPaths.map((path, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-700 px-3 py-2 rounded-lg">
                  <span className="text-white text-sm font-mono">{path}</span>
                  <button
                    onClick={() => removeSearchPath(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Missing Tracks Tab */}
          {activeTab === 'missing' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Actions Bar */}
              <div className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={scanForMissingTracks}
                      disabled={isScanning}
                      className="flex items-center space-x-2 px-4 py-2 bg-rekordbox-purple hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      {isScanning ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Search size={16} />
                      )}
                      <span>{isScanning ? 'Scanning...' : 'Scan for Missing'}</span>
                    </button>
                    
                    <button
                      onClick={executeRelocations}
                      disabled={isRelocating || relocations.size === 0}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      {isRelocating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      <span>Apply Relocations ({relocations.size})</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search tracks..."
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white w-64"
                    />
                  </div>
                </div>
              </div>

              {/* Missing Tracks List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {!hasScanCompleted ? (
                  <div className="text-center text-gray-400 py-12">
                    <FileX size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Click "Scan for Missing" to find tracks that need relocation</p>
                  </div>
                ) : filteredMissingTracks.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                    <p>No missing tracks found!</p>
                  </div>
                ) : (
                  filteredMissingTracks.map((track) => (
                    <div
                      key={track.id}
                      className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{track.name}</h3>
                          <p className="text-gray-400 text-sm">{track.artist}</p>
                          <p className="text-gray-500 text-xs font-mono mt-1">{track.originalLocation}</p>
                          {relocations.has(track.id) && (
                            <p className="text-green-400 text-xs font-mono mt-1">
                              → {relocations.get(track.id)}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => findRelocationCandidates(track)}
                            disabled={isFindingCandidates}
                            className="p-2 bg-rekordbox-purple hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                            title="Find Candidates"
                          >
                            <Search size={16} />
                          </button>
                          
                          {relocations.has(track.id) && (
                            <button
                              onClick={() => removeRelocation(track.id)}
                              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                              title="Remove Relocation"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Cloud Sync Tab */}
          {activeTab === 'cloud' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={detectCloudSyncIssues}
                      disabled={isDetectingCloudIssues}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      {isDetectingCloudIssues ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Cloud size={16} />
                      )}
                      <span>Detect Cloud Issues</span>
                    </button>
                    
                    <span className="text-gray-400">
                      Dropbox: {dropboxConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {cloudSyncIssues.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <Cloud size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No cloud sync issues detected</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cloudSyncIssues.map((issue) => (
                      <div key={issue.trackId} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-white">{issue.trackName}</h3>
                            <p className="text-gray-400 text-sm capitalize">{issue.issueType.replace('-', ' ')}</p>
                            <p className="text-gray-500 text-xs font-mono mt-1">{issue.originalLocation}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            issue.severity === 'high' ? 'bg-red-900 text-red-300' :
                            issue.severity === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                            'bg-blue-900 text-blue-300'
                          }`}>
                            {issue.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ownership Tab */}
          {activeTab === 'ownership' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700">
                <button
                  onClick={detectOwnershipIssues}
                  disabled={isDetectingOwnershipIssues}
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {isDetectingOwnershipIssues ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <User size={16} />
                  )}
                  <span>Detect Ownership Issues</span>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {ownershipIssues.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <User size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No ownership issues detected</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ownershipIssues.map((issue) => (
                      <div key={issue.trackId} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-white">{issue.trackName}</h3>
                            <p className="text-gray-400 text-sm capitalize">{issue.issueType.replace('-', ' ')}</p>
                            <p className="text-gray-500 text-xs font-mono mt-1">{issue.trackLocation}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            issue.severity === 'high' ? 'bg-red-900 text-red-300' :
                            issue.severity === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                            'bg-blue-900 text-blue-300'
                          }`}>
                            {issue.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Candidates Sidebar */}
        {selectedTrack && (
          <div className="w-96 bg-gray-850 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">Relocation Candidates</h3>
                <button
                  onClick={() => findRelocationCandidates(selectedTrack)}
                  disabled={isFindingCandidates}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <RefreshCw size={16} className={`text-gray-300 ${isFindingCandidates ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-sm text-gray-400 mt-1">{selectedTrack.name}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isFindingCandidates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={32} className="animate-spin text-rekordbox-purple" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <FileX size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No candidates found</p>
                </div>
              ) : (
                candidates.map((candidate, index) => (
                  <div
                    key={index}
                    className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors"
                    onClick={() => selectCandidate(candidate)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {candidate.path.split('/').pop()}
                        </p>
                        <p className="text-gray-400 text-xs font-mono truncate">
                          {candidate.path}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs bg-rekordbox-purple px-2 py-0.5 rounded">
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
    </div>
  );
};

export { TrackRelocator };