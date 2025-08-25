import React, { useState, memo, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Music,
  Disc,
  Clock,
  HardDrive,
  Star,
  CheckCircle,
  ExternalLink
} from 'lucide-react';

interface DuplicateItemProps {
  duplicate: any;
  isSelected: boolean;
  onToggleSelection: () => void;
  resolutionStrategy: string;
}

const DuplicateItem: React.FC<DuplicateItemProps> = memo(({
  duplicate,
  isSelected,
  onToggleSelection,
  resolutionStrategy
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const getConfidenceBadge = useCallback((confidence: number) => {
    if (confidence >= 90) {
      return <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">High</span>;
    } else if (confidence >= 70) {
      return <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded-full">Medium</span>;
    } else {
      return <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full">Low</span>;
    }
  }, []);

  const formatFileSize = useCallback((bytes: number | undefined) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }, []);

  const formatDuration = useCallback((seconds: number | undefined) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const recommendedTrack = useMemo(() => {
    if (resolutionStrategy === 'manual') return null;
    
    let recommended = duplicate.tracks[0];
    
    if (resolutionStrategy === 'keep-highest-quality') {
      recommended = duplicate.tracks.reduce((best: any, current: any) => {
        const bestScore = (best.bitrate || 0) + (best.size || 0) / 1000000;
        const currentScore = (current.bitrate || 0) + (current.size || 0) / 1000000;
        return currentScore > bestScore ? current : best;
      });
    } else if (resolutionStrategy === 'keep-newest') {
      recommended = duplicate.tracks.reduce((newest: any, current: any) => {
        if (!newest.dateModified) return current;
        if (!current.dateModified) return newest;
        return new Date(current.dateModified) > new Date(newest.dateModified) ? current : newest;
      });
    } else if (resolutionStrategy === 'keep-oldest') {
      recommended = duplicate.tracks.reduce((oldest: any, current: any) => {
        if (!oldest.dateAdded) return current;
        if (!current.dateAdded) return oldest;
        return new Date(current.dateAdded) < new Date(oldest.dateAdded) ? current : oldest;
      });
    } else if (resolutionStrategy === 'keep-preferred-path') {
      // Find track with path that matches any of the preferred paths
      const pathPreferences = duplicate.pathPreferences || [];
      console.log('🔍 Path preferences:', pathPreferences);
      
      if (pathPreferences.length > 0) {
        // Sort tracks by preference priority (lower index = higher priority)
        const sortedTracks = [...duplicate.tracks].sort((a: any, b: any) => {
          const aMatch = pathPreferences.findIndex((pref: string) => 
            a.location && a.location.toLowerCase().includes(pref.toLowerCase())
          );
          const bMatch = pathPreferences.findIndex((pref: string) => 
            b.location && b.location.toLowerCase().includes(pref.toLowerCase())
          );
          
          // If both match, return the one with lower index (higher priority)
          if (aMatch !== -1 && bMatch !== -1) return aMatch - bMatch;
          // If only one matches, prioritize the matching one
          if (aMatch !== -1) return -1;
          if (bMatch !== -1) return 1;
          // If neither match, keep original order
          return 0;
        });
        
        recommended = sortedTracks[0];
        console.log('📁 Recommended track by path preference:', recommended?.location);
      }
    }
    
    return recommended;
  }, [duplicate.tracks, resolutionStrategy, duplicate.pathPreferences]);

  const openFileLocation = useCallback(async (filePath: string) => {
    console.log('🗂️ Opening file location:', filePath);
    try {
      if (window.electronAPI?.showFileInFolder) {
        const result = await window.electronAPI.showFileInFolder(filePath);
        console.log('✅ File location opened:', result);
      } else {
        console.error('❌ showFileInFolder API not available');
        alert('File manager integration not available');
      }
    } catch (error) {
      console.error('❌ Failed to open file location:', error);
      alert(`Failed to open file location: ${error}`);
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    if (onExpansionChange) {
      onExpansionChange(!isExpanded);
    }
  }, [isExpanded, onExpansionChange]);

  const handleManualSelection = useCallback((trackId: string) => {
    setSelectedTrackId(trackId);
  }, []);

  return (
    <div className={`bg-zinc-800 border rounded-lg p-3 ${isSelected ? 'ring-2 ring-rekordbox-purple border-rekordbox-purple' : 'border-zinc-700'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            className="checkbox"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base truncate">
              {duplicate.tracks[0].artist} - {duplicate.tracks[0].name}
            </h3>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-xs text-zinc-400">
                {duplicate.tracks.length} duplicates
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span className="text-xs text-zinc-400 capitalize">
                {duplicate.matchType} match
              </span>
              {getConfidenceBadge(duplicate.confidence)}
            </div>
          </div>
        </div>

        <button
          onClick={toggleExpanded}
          className="p-1 hover:bg-zinc-700 rounded transition-colors flex-shrink-0 ml-2"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {duplicate.tracks.map((track: any) => {
            console.log('🎵 Rendering track:', { id: track.id, location: track.location, name: track.name });
            const isRecommended = recommendedTrack && track.id === recommendedTrack.id;
            const isManuallySelected = resolutionStrategy === 'manual' && track.id === selectedTrackId;
            
            return (
              <div
                key={track.id}
                className={`p-3 bg-zinc-900 rounded border ${
                  isRecommended ? 'border-green-600' : 
                  isManuallySelected ? 'border-rekordbox-purple' : 
                  'border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1.5">
                      {(isRecommended || isManuallySelected) && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      <h4 className="font-medium text-sm truncate">{track.name}</h4>
                      {isRecommended && (
                        <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-zinc-400">
                          <Music className="w-3 h-3" />
                          <span className="truncate">{track.artist}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-zinc-400">
                          <Disc className="w-3 h-3" />
                          <span className="truncate">{track.album || 'No Album'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-zinc-400">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(track.duration)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-zinc-400">
                          <HardDrive className="w-3 h-3" />
                          <span>{formatFileSize(track.size)}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-zinc-400">
                          <span>Bitrate:</span>
                          <span>{track.bitrate || 'N/A'} kbps</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-zinc-400">
                          <Star className="w-3 h-3" />
                          <span>Rating: {track.rating || 0}/5</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-1.5 text-xs text-zinc-500">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-600 font-medium">Path:</span>
                          <button
                            onClick={() => {
                              console.log('🔵 Go to File button clicked!', track.location);
                              openFileLocation(track.location);
                            }}
                            className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded border border-blue-500 hover:border-blue-400 transition-all duration-200"
                            title="Open file location in system file manager"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="font-medium">Go to File</span>
                          </button>
                        </div>
                        <div 
                          className="font-mono text-xs bg-zinc-900 p-1.5 rounded border border-zinc-700 select-all whitespace-pre-wrap word-break-all"
                          title="Click to select full path"
                          style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}
                        >
                          {track.location || 'No file path available'}
                        </div>
                      </div>
                    </div>

                    {(track.cues?.length > 0 || track.loops?.length > 0) && (
                      <div className="mt-1 flex space-x-2 text-xs text-green-500">
                        {track.cues?.length > 0 && <span>✓ {track.cues.length} cues</span>}
                        {track.loops?.length > 0 && <span>✓ {track.loops.length} loops</span>}
                      </div>
                    )}
                  </div>

                  {resolutionStrategy === 'manual' && (
                    <button
                      onClick={() => handleManualSelection(track.id)}
                      className={`ml-3 px-2 py-1 text-xs rounded transition-colors ${
                        isManuallySelected
                          ? 'bg-rekordbox-purple text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      }`}
                    >
                      {isManuallySelected ? 'Selected' : 'Select'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if relevant props changed
  return (
    prevProps.duplicate.id === nextProps.duplicate.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.resolutionStrategy === nextProps.resolutionStrategy &&
    JSON.stringify(prevProps.duplicate.pathPreferences) === JSON.stringify(nextProps.duplicate.pathPreferences) &&
    prevProps.duplicate.tracks.length === nextProps.duplicate.tracks.length
  );
});

DuplicateItem.displayName = 'DuplicateItem';

export default DuplicateItem;
