import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLibrary } from '../../src/renderer/hooks/useLibrary';

describe('useLibrary startup auto-load', () => {
  const mockShowNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('sets startupComplete=true immediately when no saved path', async () => {
    localStorage.removeItem('rekordboxLibraryPath');

    const { result } = renderHook(() => useLibrary(mockShowNotification));

    await waitFor(() => expect(result.current.startupComplete).toBe(true));
    expect(result.current.libraryPath).toBe('');
    expect(result.current.libraryData).toBeNull();
    expect(window.electronAPI.checkFileAccessible).not.toHaveBeenCalled();
  });

  it('auto-loads library when saved path is accessible', async () => {
    localStorage.setItem('rekordboxLibraryPath', '/path/to/library.xml');
    window.electronAPI.checkFileAccessible.mockResolvedValue({ accessible: true });
    window.electronAPI.parseRekordboxLibrary.mockResolvedValue({
      success: true,
      data: { libraryPath: '/path/to/library.xml', tracks: new Map(), playlists: [] },
    });

    const { result } = renderHook(() => useLibrary(mockShowNotification));

    await waitFor(() => expect(result.current.startupComplete).toBe(true));
    expect(window.electronAPI.checkFileAccessible).toHaveBeenCalledWith('/path/to/library.xml');
    expect(window.electronAPI.parseRekordboxLibrary).toHaveBeenCalledWith('/path/to/library.xml');
    expect(result.current.libraryPath).toBe('/path/to/library.xml');
    expect(result.current.libraryData).not.toBeNull();
  });

  it('clears saved path and shows import page when file is not accessible', async () => {
    localStorage.setItem('rekordboxLibraryPath', '/missing/library.xml');
    window.electronAPI.checkFileAccessible.mockResolvedValue({ accessible: false });

    const { result } = renderHook(() => useLibrary(mockShowNotification));

    await waitFor(() => expect(result.current.startupComplete).toBe(true));
    expect(window.electronAPI.parseRekordboxLibrary).not.toHaveBeenCalled();
    expect(result.current.libraryPath).toBe('');
    expect(result.current.libraryData).toBeNull();
    expect(localStorage.getItem('rekordboxLibraryPath')).toBeNull();
  });

  it('clears path when file is accessible but XML parse fails', async () => {
    localStorage.setItem('rekordboxLibraryPath', '/corrupt/library.xml');
    window.electronAPI.checkFileAccessible.mockResolvedValue({ accessible: true });
    window.electronAPI.parseRekordboxLibrary.mockResolvedValue({
      success: false,
      error: 'Not a valid Rekordbox XML file',
    });

    const { result } = renderHook(() => useLibrary(mockShowNotification));

    await waitFor(() => expect(result.current.startupComplete).toBe(true));
    expect(result.current.libraryPath).toBe('');
    expect(result.current.libraryData).toBeNull();
    expect(mockShowNotification).toHaveBeenCalledWith('error', expect.any(String));
  });
});
