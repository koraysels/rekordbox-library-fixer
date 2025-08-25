import React, { useState } from 'react';
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

const DuplicateItem: React.FC<DuplicateItemProps> = ({
  duplicate,
  isSelected,
  onToggleSelection,
  resolutionStrategy
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">High</span>;
    } else if (confidence >= 70) {
      return <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded-full">Medium</span>;
    } else {
      return <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full">Low</span>;
    }
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecommendedTrack = () => {
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
  };

  const recommendedTrack = getRecommendedTrack();

  const openFileLocation = async (filePath: string) => {
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
  };

  return (
    <div className={`card ${isSelected ? 'ring-2 ring-rekordbox-purple' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            className="checkbox"
          />
          <div>
            <h3 className="font-semibold text-lg">
              {duplicate.tracks[0].artist} - {duplicate.tracks[0].name}
            </h3>
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-sm text-zinc-400">
                {duplicate.tracks.length} duplicates found
              </span>
              <span className="text-sm text-zinc-400">•</span>
              <span className="text-sm text-zinc-400 capitalize">
                {duplicate.matchType} match
              </span>
              {getConfidenceBadge(duplicate.confidence)}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {duplicate.tracks.map((track: any) => {
            console.log('🎵 Rendering track:', { id: track.id, location: track.location, name: track.name });
            const isRecommended = recommendedTrack && track.id === recommendedTrack.id;
            const isManuallySelected = resolutionStrategy === 'manual' && track.id === selectedTrackId;
            
            return (
              <div
                key={track.id}
                className={`p-4 bg-zinc-800 rounded-lg border ${
                  isRecommended ? 'border-green-600' : 
                  isManuallySelected ? 'border-rekordbox-purple' : 
                  'border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {(isRecommended || isManuallySelected) && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      <h4 className="font-medium">{track.name}</h4>
                      {isRecommended && (
                        <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-zinc-400">
                          <Music className="w-4 h-4" />
                          <span>{track.artist}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-zinc-400">
                          <Disc className="w-4 h-4" />
                          <span>{track.album || 'No Album'}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-zinc-400">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(track.duration)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-zinc-400">
                          <HardDrive className="w-4 h-4" />
                          <span>{formatFileSize(track.size)}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-zinc-400">
                          <span className="text-xs">Bitrate:</span>
                          <span>{track.bitrate || 'N/A'} kbps</span>
                        </div>
                        <div className="flex items-center space-x-2 text-zinc-400">
                          <Star className="w-4 h-4" />
                          <span>Rating: {track.rating || 0}/5</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-600 font-medium">Full Path:</span>
                          <button
                            onClick={() => {
                              console.log('🔵 Go to File button clicked!', track.location);
                              openFileLocation(track.location);
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-md border border-blue-500 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md"
                            title="Open file location in system file manager"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="font-medium">📁 Go to File</span>
                          </button>
                        </div>
                        <div 
                          className="font-mono text-xs bg-zinc-900 p-2 rounded border border-zinc-700 select-all whitespace-pre-wrap word-break-all"
                          title="Click to select full path"
                          style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}
                        >
                          {track.location || 'No file path available'}
                        </div>
                      </div>
                    </div>

                    {track.cues && track.cues.length > 0 && (
                      <div className="mt-2 text-xs text-green-500">
                        ✓ {track.cues.length} cue points
                      </div>
                    )}
                    {track.loops && track.loops.length > 0 && (
                      <div className="text-xs text-green-500">
                        ✓ {track.loops.length} loops
                      </div>
                    )}
                  </div>

                  {resolutionStrategy === 'manual' && (
                    <button
                      onClick={() => setSelectedTrackId(track.id)}
                      className={`ml-4 px-3 py-1 text-sm rounded-lg transition-colors ${
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
};

export default DuplicateItem;
