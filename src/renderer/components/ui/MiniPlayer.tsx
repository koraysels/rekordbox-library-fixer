import React, { useEffect, useRef, useState } from 'react';
import {
  MediaController,
  MediaPlayButton,
  MediaTimeRange,
  MediaTimeDisplay,
  MediaMuteButton,
  MediaVolumeRange,
} from 'media-chrome/react';
import { X, Music } from 'lucide-react';
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
  const [artwork, setArtwork] = useState<string | null>(null);

  // Cover art from the file itself; a stale answer for a previous track is dropped.
  useEffect(() => {
    setArtwork(null);
    const location = currentTrack?.location;
    if (!location) { return; }
    let current = true;
    window.electronAPI.getTrackArtwork?.(location)
      .then((url) => { if (current) { setArtwork(url); } })
      .catch(() => undefined);
    return () => { current = false; };
  }, [currentTrack?.location]);

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
      // Dark, so it stands apart from the page it plays over. (It was light while
      // a fixed footer squeezed it; the footer is part of the layout now.)
      className={`flex-shrink-0 bg-te-grey-800 border-t-2 border-te-grey-700 px-4 py-2 ${currentTrack ? '' : 'hidden'}`}
    >
      <MediaController audio className="w-full" style={{
          '--media-background-color': 'transparent',
          '--media-control-background': 'transparent',
          '--media-control-hover-background': 'transparent',
          '--media-icon-color': '#f4f4f5',
          '--media-range-track-color': '#52525b',
          '--media-range-bar-color': '#f97316',
          '--media-range-thumb-color': '#f97316',
          '--media-text-color': '#d4d4d8',
        } as React.CSSProperties}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- music preview, captions not applicable */}
        <audio slot="media" ref={audioRef} />
        <div className="flex items-center gap-3">
          <MediaPlayButton className="w-9 h-9 flex-shrink-0 rounded-te bg-te-orange hover:bg-te-orange/90 transition-colors" />
          <div className="w-10 h-10 flex-shrink-0 rounded-te overflow-hidden bg-te-grey-700 flex items-center justify-center">
            {artwork
              ? <img src={artwork} alt="" className="w-full h-full object-cover" />
              : <Music size={16} className="text-te-grey-500" />}
          </div>
          <div className="min-w-0 w-56 flex-shrink-0">
            <p className="text-xs font-te-mono text-te-cream truncate">{currentTrack?.name}</p>
            <p className="text-[10px] font-te-mono text-te-grey-400 truncate normal-case">
              {currentTrack?.artist?.trim() || 'Unknown artist'}
            </p>
          </div>
          <MediaTimeRange className="flex-1 min-w-0 h-9" />
          <MediaTimeDisplay
            showDuration
            className="text-[10px] font-te-mono text-te-grey-300 flex-shrink-0 tabular-nums"
          />
          <MediaMuteButton className="w-8 h-8 flex-shrink-0" />
          <MediaVolumeRange className="w-24 h-9 flex-shrink-0" />
          <button
            onClick={() => audioController.stop()}
            className="p-1.5 flex-shrink-0 text-te-grey-400 hover:text-te-orange transition-colors"
            title="Stop and close player"
          >
            <X size={14} />
          </button>
        </div>
      </MediaController>
    </div>
  );
};
