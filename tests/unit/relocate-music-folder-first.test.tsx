import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrackRelocator } from '@renderer/hooks/useTrackRelocator';
import { useSettingsStore } from '@renderer/stores/settingsStore';
import { withMusicFolderFirst } from '../../src/main/searchPaths';
import type { MissingTrack, RelocationOptions } from '@renderer/types';

const track: MissingTrack = { id: '1', name: 'Song', artist: 'A', originalLocation: '/old/Song.mp3' } as MissingTrack;
const options = (searchPaths: string[]): RelocationOptions => ({
  searchPaths, searchDepth: 8, matchThreshold: 0.7, includeSubdirectories: true, fileExtensions: ['.mp3'],
});
const find = () => window.electronAPI.findRelocationCandidates as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  find().mockResolvedValue({ success: true, data: [] });
});

describe('withMusicFolderFirst', () => {
  it('puts the music folder first and lists each folder once, whatever its spelling', () => {
    expect(withMusicFolderFirst('/Music/Björk', ['/Downloads', '/music/björk', '/Downloads']))
      .toEqual(['/Music/Björk', '/Downloads']);
  });

  it('leaves the list alone without a music folder', () => {
    expect(withMusicFolderFirst('', ['/Downloads'])).toEqual(['/Downloads']);
  });
});

describe('the Relocate page and the music folder', () => {
  it('searches the music folder first', async () => {
    useSettingsStore.setState({ musicFolder: '/Volumes/SSD/Music' });
    const notify = vi.fn();
    const { result } = renderHook(() => useTrackRelocator(null, '', notify, vi.fn(), options(['/Users/dj/Downloads'])));
    await act(async () => { await result.current.findRelocationCandidates(track); });
    expect(find()).toHaveBeenCalledWith(track, expect.objectContaining({
      searchPaths: ['/Volumes/SSD/Music', '/Users/dj/Downloads'],
    }));
  });

  it('counts a music folder as somewhere to search when no search paths are set', async () => {
    useSettingsStore.setState({ musicFolder: '/Volumes/SSD/Music' });
    const notify = vi.fn();
    const { result } = renderHook(() => useTrackRelocator(null, '', notify, vi.fn(), options([])));
    expect(result.current.stats.hasSearchPaths).toBe(true);
    await act(async () => { await result.current.findRelocationCandidates(track); });
    expect(notify).not.toHaveBeenCalledWith('error', 'Please configure search paths first');
    expect(find()).toHaveBeenCalledWith(track, expect.objectContaining({ searchPaths: ['/Volumes/SSD/Music'] }));
  });

  it('still asks for a search path with neither', async () => {
    useSettingsStore.setState({ musicFolder: '' });
    const notify = vi.fn();
    const { result } = renderHook(() => useTrackRelocator(null, '', notify, vi.fn(), options([])));
    await act(async () => { await result.current.findRelocationCandidates(track); });
    expect(notify).toHaveBeenCalledWith('error', 'Please configure search paths first');
    expect(find()).not.toHaveBeenCalled();
  });
});
