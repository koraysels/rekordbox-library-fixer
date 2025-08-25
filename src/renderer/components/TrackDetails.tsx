import React from 'react';
import {
  Music,
  Disc,
  Clock,
  HardDrive,
  Calendar,
  Hash,
  Zap,
  PlayCircle,
  Star
} from 'lucide-react';

interface TrackDetailsProps {
  track: any;
}

const TrackDetails: React.FC<TrackDetailsProps> = ({ track }) => {
  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Music className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Artist:</span>
            <span className="text-sm font-medium">{track.artist}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Disc className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Album:</span>
            <span className="text-sm font-medium">{track.album || 'N/A'}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Genre:</span>
            <span className="text-sm font-medium">{track.genre || 'N/A'}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Duration:</span>
            <span className="text-sm font-medium">{formatDuration(track.duration)}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">BPM:</span>
            <span className="text-sm font-medium">{track.bpm || 'N/A'}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Size:</span>
            <span className="text-sm font-medium">{formatFileSize(track.size)}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-zinc-400 ml-6">Bitrate:</span>
            <span className="text-sm font-medium">{track.bitrate || 'N/A'} kbps</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Added:</span>
            <span className="text-sm font-medium">{formatDate(track.dateAdded)}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <PlayCircle className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Plays:</span>
            <span className="text-sm font-medium">{track.playCount || 0}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Rating:</span>
            <span className="text-sm font-medium">{track.rating || 0}/5</span>
          </div>
        </div>
      </div>
      
      <div className="pt-2 border-t border-zinc-700">
        <div className="text-sm text-zinc-400">File Location:</div>
        <div className="text-sm font-mono text-zinc-300 mt-1 break-all">
          {track.location}
        </div>
      </div>
      
      {track.comments && (
        <div className="pt-2 border-t border-zinc-700">
          <div className="text-sm text-zinc-400">Comments:</div>
          <div className="text-sm text-zinc-300 mt-1">
            {track.comments}
          </div>
        </div>
      )}
      
      <div className="pt-2 border-t border-zinc-700 flex space-x-6">
        {track.cues && track.cues.length > 0 && (
          <div className="text-sm">
            <span className="text-green-500">✓</span>
            <span className="ml-1">{track.cues.length} Cue Points</span>
          </div>
        )}
        
        {track.loops && track.loops.length > 0 && (
          <div className="text-sm">
            <span className="text-green-500">✓</span>
            <span className="ml-1">{track.loops.length} Loops</span>
          </div>
        )}
        
        {track.beatgrid && (
          <div className="text-sm">
            <span className="text-green-500">✓</span>
            <span className="ml-1">Beat Grid</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackDetails;
