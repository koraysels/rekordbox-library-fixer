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
import type { ShowNotification } from '../../types';

interface MiniPlayerProps {
  showNotification: ShowNotification;
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
      if (target?.closest('input, textarea, select, button, [contenteditable]')) { return; }
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
      // Light like the rest of the app: a dark bar squeezed above the footer
      // read as a rendering fault rather than a player.
      className={`flex-shrink-0 bg-te-grey-200 border-t-2 border-te-grey-300 px-4 py-2 ${currentTrack ? '' : 'hidden'}`}
    >
      <MediaController audio className="w-full" style={{
          '--media-background-color': 'transparent',
          '--media-control-background': 'transparent',
          '--media-control-hover-background': 'transparent',
          '--media-icon-color': '#3f3f46',
          '--media-range-track-color': '#d4d4d8',
          '--media-range-bar-color': '#f97316',
          '--media-range-thumb-color': '#f97316',
          '--media-text-color': '#52525b',
        } as React.CSSProperties}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- music preview, captions not applicable */}
        <audio slot="media" ref={audioRef} />
        <div className="flex items-center gap-3">
          <MediaPlayButton className="w-9 h-9 flex-shrink-0 rounded-te bg-te-orange hover:bg-te-orange/90 transition-colors" />
          <div className="min-w-0 w-56 flex-shrink-0">
            <p className="text-xs font-te-mono text-te-grey-800 truncate">{currentTrack?.name}</p>
            <p className="text-[10px] font-te-mono text-te-grey-500 truncate normal-case">{currentTrack?.artist}</p>
          </div>
          <MediaTimeRange className="flex-1 min-w-0 h-9" />
          <MediaTimeDisplay
            showDuration
            className="text-[10px] font-te-mono text-te-grey-600 flex-shrink-0 tabular-nums"
          />
          <MediaMuteButton className="w-8 h-8 flex-shrink-0" />
          <MediaVolumeRange className="w-24 h-9 flex-shrink-0" />
          <button
            onClick={() => audioController.stop()}
            className="p-1.5 flex-shrink-0 text-te-grey-500 hover:text-te-orange transition-colors"
            title="Stop and close player"
          >
            <X size={14} />
          </button>
        </div>
      </MediaController>
    </div>
  );
};
