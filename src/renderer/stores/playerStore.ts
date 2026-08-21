import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PlayerTrack {
  id: string;
  name: string;
  artist: string;
  location: string;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlayerState {
  currentTrack: PlayerTrack | null;
  status: PlayerStatus;
  errorMessage: string | null;
  volume: number;
  muted: boolean;

  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  /** Controller-only: syncs playback state from the audio element. */
  _sync: (partial: Partial<Pick<PlayerState, 'currentTrack' | 'status' | 'errorMessage'>>) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      currentTrack: null,
      status: 'idle',
      errorMessage: null,
      volume: 0.8,
      muted: false,

      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
      _sync: (partial) => set(partial),
    }),
    {
      name: 'rekordbox-player',
      version: 1,
      partialize: (state) => ({ volume: state.volume, muted: state.muted }),
    }
  )
);
