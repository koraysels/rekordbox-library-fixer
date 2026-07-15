import React, { useEffect, useRef } from 'react';
import {
  MediaController,
  MediaPlayButton,
  MediaTimeRange,
  MediaTimeDisplay,
  MediaMuteButton,
  MediaVolumeRange,
} from 'media-chrome/react';
import { X } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { audioController } from '../../audio/audioController';
import type { NotificationType } from '../../types';

interface MiniPlayerProps {
  showNotification: (type: NotificationType, message: string) => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ showNotification }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const status = usePlayerStore((s) => s.status);
  const errorMessage = usePlayerStore((s) => s.errorMessage);

  // The <audio> element stays mounted even while the bar is hidden —
  // a row's first play command needs a registered element to exist.
  useEffect(() => {
    if (audioRef.current) {
      return audioController.register(audioRef.current);
    }
  }, []);

  // Error → toast, then reset to idle
  useEffect(() => {
    if (status === 'error') {
      showNotification('error', errorMessage ?? 'Playback failed');
      audioController.stop();
    }
  }, [status, errorMessage, showNotification]);

  // Space toggles play/pause when not typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') { return; }
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) { return; }
      if (usePlayerStore.getState().status === 'idle') { return; }
      e.preventDefault();
      audioController.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      data-testid="mini-player"
      className={`flex-shrink-0 bg-te-grey-700 border-t border-te-grey-600 px-3 py-1.5 ${currentTrack ? '' : 'hidden'}`}
    >
      <MediaController audio className="w-full" style={{ '--media-background-color': 'transparent' } as React.CSSProperties}>
        <audio slot="media" ref={audioRef} />
        <div className="flex items-center gap-3">
          <MediaPlayButton className="w-8 h-8 rounded bg-te-grey-600 hover:bg-te-orange transition-colors" />
          <div className="min-w-0 w-48">
            <p className="text-xs font-te-mono text-white truncate">{currentTrack?.name}</p>
            <p className="text-[10px] font-te-mono text-te-grey-400 truncate">{currentTrack?.artist}</p>
          </div>
          <MediaTimeRange className="flex-1 h-8" />
          <MediaTimeDisplay showDuration className="text-[10px] font-te-mono text-te-grey-300" />
          <MediaMuteButton className="w-7 h-7" />
          <MediaVolumeRange className="w-20 h-8" />
          <button
            onClick={() => audioController.stop()}
            className="p-1 text-te-grey-400 hover:text-te-orange transition-colors"
            title="Stop and close player"
          >
            <X size={14} />
          </button>
        </div>
      </MediaController>
    </div>
  );
};
