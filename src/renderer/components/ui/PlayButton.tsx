import React from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { usePlayerStore, type PlayerTrack } from '../../stores/playerStore';
import { audioController } from '../../audio/audioController';

interface PlayButtonProps {
  track: PlayerTrack;
  size?: number;
  className?: string;
}

export const PlayButton: React.FC<PlayButtonProps> = ({ track, size = 14, className = '' }) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const status = usePlayerStore((s) => s.status);

  const isCurrent = currentTrack?.id === track.id;
  const isPlaying = isCurrent && status === 'playing';
  const isLoading = isCurrent && status === 'loading';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) { return; }
    if (isCurrent && (status === 'playing' || status === 'paused')) {
      audioController.toggle();
    } else {
      void audioController.playTrack(track);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      title={isPlaying ? 'Pause preview' : 'Preview track'}
      className={`flex-shrink-0 p-1 rounded transition-colors ${
        isCurrent ? 'text-te-orange' : 'text-te-grey-400 hover:text-te-orange'
      } ${className}`}
    >
      {isLoading
        ? <Loader2 size={size} className="animate-spin" />
        : isPlaying
          ? <Pause size={size} />
          : <Play size={size} />}
    </button>
  );
};
