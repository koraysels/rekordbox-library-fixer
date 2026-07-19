import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/renderer/audio/resolveAudioSrc', () => ({
  resolveAudioSrc: vi.fn(async (location: string) => ({ src: `resolved:${location}`, revoke: null })),
  mediaUrl: (l: string) => `media:///${encodeURIComponent(l)}`,
}));

import { usePlayerStore } from '../../src/renderer/stores/playerStore';
import { audioController } from '../../src/renderer/audio/audioController';
import { resolveAudioSrc } from '../../src/renderer/audio/resolveAudioSrc';

/** Minimal fake HTMLAudioElement — jsdom's play() is unimplemented. */
function fakeAudioEl() {
  const listeners: Record<string, (() => void)[]> = {};
  const el = {
    src: '', volume: 1, muted: false, paused: true, currentTime: 0,
    play: vi.fn(function (this: any) { el.paused = false; emit('playing'); return Promise.resolve(); }),
    pause: vi.fn(function (this: any) { el.paused = true; emit('pause'); }),
    load: vi.fn(),
    removeAttribute: vi.fn(function (attr: string) { if (attr === 'src') { el.src = ''; } }),
    addEventListener: (t: string, fn: () => void) => { (listeners[t] ??= []).push(fn); },
    removeEventListener: (t: string, fn: () => void) => { listeners[t] = (listeners[t] ?? []).filter(f => f !== fn); },
  };
  const emit = (t: string) => { for (const fn of listeners[t] ?? []) { fn(); } };
  return { el: el as unknown as HTMLAudioElement, emit };
}

const TRACK = { id: 't1', name: 'Track One', artist: 'DJ', location: '/music/one.mp3' };

describe('playerStore + audioController', () => {
  let fake: ReturnType<typeof fakeAudioEl>;
  let unregister: () => void;

  beforeEach(() => {
    usePlayerStore.setState({ currentTrack: null, status: 'idle', errorMessage: null, volume: 0.8, muted: false });
    vi.clearAllMocks();
    fake = fakeAudioEl();
    unregister = audioController.register(fake.el);
  });

  it('playTrack resolves src, sets element src, plays, and reaches playing state', async () => {
    await audioController.playTrack(TRACK);
    expect(resolveAudioSrc).toHaveBeenCalledWith('/music/one.mp3');
    expect(fake.el.src).toBe('resolved:/music/one.mp3');
    expect(fake.el.play).toHaveBeenCalled();
    expect(usePlayerStore.getState().status).toBe('playing');
    expect(usePlayerStore.getState().currentTrack).toEqual(TRACK);
  });

  it('toggle pauses and resumes', async () => {
    await audioController.playTrack(TRACK);
    audioController.toggle();
    expect(usePlayerStore.getState().status).toBe('paused');
    audioController.toggle();
    expect(usePlayerStore.getState().status).toBe('playing');
  });

  it('ended → paused at position 0, track stays loaded', async () => {
    await audioController.playTrack(TRACK);
    fake.el.currentTime = 180;
    (fake.el as any).paused = true;
    fake.emit('ended');
    expect(usePlayerStore.getState().status).toBe('paused');
    expect(fake.el.currentTime).toBe(0);
    expect(usePlayerStore.getState().currentTrack).toEqual(TRACK);
  });

  it('stop clears src and returns to idle', async () => {
    await audioController.playTrack(TRACK);
    audioController.stop();
    const s = usePlayerStore.getState();
    expect(s.status).toBe('idle');
    expect(s.currentTrack).toBeNull();
    expect(fake.el.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('resolve failure → error status with message', async () => {
    vi.mocked(resolveAudioSrc).mockRejectedValueOnce(new Error('File missing or unreadable'));
    await audioController.playTrack(TRACK);
    const s = usePlayerStore.getState();
    expect(s.status).toBe('error');
    expect(s.errorMessage).toBe('File missing or unreadable');
  });

  it('element error event → error status', async () => {
    await audioController.playTrack(TRACK);
    fake.emit('error');
    expect(usePlayerStore.getState().status).toBe('error');
  });

  it('register applies persisted volume and muted to the element', () => {
    usePlayerStore.setState({ volume: 0.3, muted: true });
    const second = fakeAudioEl();
    audioController.register(second.el);
    expect(second.el.volume).toBe(0.3);
    expect(second.el.muted).toBe(true);
  });

  it('playing a second track revokes the previous blob URL', async () => {
    const revoke = vi.fn();
    vi.mocked(resolveAudioSrc).mockResolvedValueOnce({ src: 'blob:one', revoke });
    await audioController.playTrack({ ...TRACK, location: '/music/one.aiff' });
    await audioController.playTrack({ ...TRACK, id: 't2', location: '/music/two.mp3' });
    expect(revoke).toHaveBeenCalled();
  });

  it('late async pause event after stop does not overwrite idle', async () => {
    await audioController.playTrack(TRACK);
    audioController.stop();
    expect(usePlayerStore.getState().status).toBe('idle');
    // real HTMLMediaElement fires 'pause' as a queued task — simulate it arriving late
    fake.emit('pause');
    expect(usePlayerStore.getState().status).toBe('idle');
  });

  it('toggle() sets error status when play() rejects', async () => {
    await audioController.playTrack(TRACK);
    audioController.toggle(); // pause
    expect(usePlayerStore.getState().status).toBe('paused');
    vi.mocked(fake.el.play).mockRejectedValueOnce(new Error('boom'));
    audioController.toggle(); // resume -> rejected play()
    await vi.waitFor(() => expect(usePlayerStore.getState().status).toBe('error'));
    expect(usePlayerStore.getState().errorMessage).toBe('Playback failed');
  });
});
