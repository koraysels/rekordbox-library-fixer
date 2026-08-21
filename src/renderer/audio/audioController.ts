import { usePlayerStore, type PlayerTrack, type PlayerStatus } from '../stores/playerStore';
import { resolveAudioSrc } from './resolveAudioSrc';

/**
 * Singleton owner of the app's one <audio> element.
 * Commands flow UI → controller → element; element events flow back
 * into playerStore. The controller is the only writer of playback status.
 */
let audio: HTMLAudioElement | null = null;
let revokeCurrent: (() => void) | null = null;
let loadSeq = 0; // guards against out-of-order async loads

type SyncPartial = Partial<{ currentTrack: PlayerTrack | null; status: PlayerStatus; errorMessage: string | null }>;
const sync = (p: SyncPartial) => usePlayerStore.getState()._sync(p);

function cleanupSrc() {
  if (revokeCurrent) { revokeCurrent(); revokeCurrent = null; }
}

export const audioController = {
  /** MiniPlayer registers its <audio> element; returns an unregister fn. */
  register(el: HTMLAudioElement): () => void {
    audio = el;
    const { volume, muted } = usePlayerStore.getState();
    el.volume = volume;
    el.muted = muted;

    const onPlaying = () => sync({ status: 'playing' });
    const onPause = () => {
      // 'pause' also fires during stop/unload; only report real pauses
      if (usePlayerStore.getState().status === 'playing') { sync({ status: 'paused' }); }
    };
    const onEnded = () => { el.currentTime = 0; sync({ status: 'paused' }); };
    const onError = () => sync({ status: 'error', errorMessage: 'File missing or unreadable' });
    const onVolumeChange = () => {
      usePlayerStore.getState().setVolume(el.volume);
      usePlayerStore.getState().setMuted(el.muted);
    };

    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('volumechange', onVolumeChange);
    return () => {
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('volumechange', onVolumeChange);
      if (audio === el) { audio = null; }
    };
  },

  async playTrack(track: PlayerTrack): Promise<void> {
    if (!audio) { return; }
    const seq = ++loadSeq;
    sync({ currentTrack: track, status: 'loading', errorMessage: null });
    try {
      const { src, revoke } = await resolveAudioSrc(track.location);
      if (seq !== loadSeq || !audio) { revoke?.(); return; } // superseded meanwhile
      cleanupSrc();
      revokeCurrent = revoke;
      audio.src = src;
      await audio.play();
    } catch (err) {
      if (seq !== loadSeq) { return; }
      sync({ status: 'error', errorMessage: err instanceof Error ? err.message : 'Playback failed' });
    }
  },

  toggle(): void {
    if (!audio) { return; }
    if (audio.paused) {
      audio.play().catch(() => sync({ status: 'error', errorMessage: 'Playback failed' }));
    } else {
      audio.pause();
    }
  },

  stop(): void {
    loadSeq++;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    cleanupSrc();
    sync({ currentTrack: null, status: 'idle', errorMessage: null });
  },
};
