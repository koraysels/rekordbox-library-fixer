import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MiniPlayer } from '../../src/renderer/components/ui/MiniPlayer';
import { usePlayerStore } from '../../src/renderer/stores/playerStore';

// jsdom's media element methods are unimplemented — stub them
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  usePlayerStore.setState({ currentTrack: null, status: 'idle', errorMessage: null, volume: 0.8, muted: false });
});

const TRACK = { id: 't1', name: 'Track One', artist: 'DJ', location: '/music/one.mp3' };

describe('MiniPlayer', () => {
  it('is hidden when idle but keeps the audio element mounted', () => {
    const { container } = render(<MiniPlayer showNotification={vi.fn()} />);
    const bar = container.querySelector('[data-testid="mini-player"]') as HTMLElement;
    expect(bar.className).toContain('hidden');
    expect(container.querySelector('audio')).not.toBeNull();
  });

  it('shows track name and artist when a track is loaded', () => {
    usePlayerStore.setState({ currentTrack: TRACK, status: 'playing' });
    render(<MiniPlayer showNotification={vi.fn()} />);
    expect(screen.getByText('Track One')).toBeInTheDocument();
    expect(screen.getByText('DJ')).toBeInTheDocument();
  });

  it('fires an error toast when status turns error', () => {
    const notify = vi.fn();
    render(<MiniPlayer showNotification={notify} />);
    usePlayerStore.setState({ currentTrack: TRACK, status: 'error', errorMessage: 'File missing or unreadable' });
    // toast effect runs on state change
    return vi.waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'File missing or unreadable'));
  });
});
