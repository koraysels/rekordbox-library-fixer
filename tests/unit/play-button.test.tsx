import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../src/renderer/audio/audioController', () => ({
  audioController: { playTrack: vi.fn(), toggle: vi.fn(), stop: vi.fn(), register: vi.fn() },
}));

import { PlayButton } from '../../src/renderer/components/ui/PlayButton';
import { usePlayerStore } from '../../src/renderer/stores/playerStore';
import { audioController } from '../../src/renderer/audio/audioController';

const TRACK = { id: 't1', name: 'One', artist: 'DJ', location: '/music/one.mp3' };
const OTHER = { id: 't2', name: 'Two', artist: 'DJ', location: '/music/two.mp3' };

beforeEach(() => {
  vi.clearAllMocks();
  usePlayerStore.setState({ currentTrack: null, status: 'idle', errorMessage: null, volume: 0.8, muted: false });
});

describe('PlayButton', () => {
  it('idle: shows play and starts the track on click', () => {
    render(<PlayButton track={TRACK} />);
    const btn = screen.getByRole('button', { name: /play/i });
    fireEvent.click(btn);
    expect(audioController.playTrack).toHaveBeenCalledWith(TRACK);
  });

  it('this track playing: shows pause and toggles on click', () => {
    usePlayerStore.setState({ currentTrack: TRACK, status: 'playing' });
    render(<PlayButton track={TRACK} />);
    const btn = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(btn);
    expect(audioController.toggle).toHaveBeenCalled();
    expect(audioController.playTrack).not.toHaveBeenCalled();
  });

  it('this track paused: shows play and resumes via toggle', () => {
    usePlayerStore.setState({ currentTrack: TRACK, status: 'paused' });
    render(<PlayButton track={TRACK} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(audioController.toggle).toHaveBeenCalled();
    expect(audioController.playTrack).not.toHaveBeenCalled();
  });

  it('another track playing: shows play and switches tracks on click', () => {
    usePlayerStore.setState({ currentTrack: OTHER, status: 'playing' });
    render(<PlayButton track={TRACK} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(audioController.playTrack).toHaveBeenCalledWith(TRACK);
  });

  it('this track loading: shows spinner, click does nothing', () => {
    usePlayerStore.setState({ currentTrack: TRACK, status: 'loading' });
    render(<PlayButton track={TRACK} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(audioController.playTrack).not.toHaveBeenCalled();
    expect(audioController.toggle).not.toHaveBeenCalled();
  });

  it('stops click propagation (rows have their own click handlers)', () => {
    const rowClick = vi.fn();
    render(<div onClick={rowClick}><PlayButton track={TRACK} /></div>);
    fireEvent.click(screen.getByRole('button'));
    expect(rowClick).not.toHaveBeenCalled();
  });
});
