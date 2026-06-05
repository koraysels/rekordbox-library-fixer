import { useState, useEffect, useCallback } from 'react';
import type { LibraryData, NotificationType } from '../types';

export const useLibrary = (showNotification: (type: NotificationType, message: string) => void) => {
  const [libraryPath, setLibraryPath] = useState<string>('');
  const [libraryData, setLibraryData] = useState<LibraryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startupComplete, setStartupComplete] = useState(false);

  const loadLibrary = useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      setLibraryData(null);
      setLibraryPath(path);

      const result = await window.electronAPI.parseRekordboxLibrary(path);
      if (result.success) {
        setLibraryData(result.data);
        showNotification('success', `Loaded ${result.data.tracks.size} tracks from library`);
      } else {
        showNotification('error', result.error || 'Failed to parse library');
        setLibraryPath('');
      }
    } catch {
      showNotification('error', 'Failed to load library');
      setLibraryPath('');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  const selectLibrary = useCallback(async () => {
    try {
      const path = await window.electronAPI.selectRekordboxXML();
      if (path) {
        await loadLibrary(path);
      }
    } catch {
      showNotification('error', 'Failed to select library file');
    }
  }, [loadLibrary, showNotification]);

  const clearStoredData = useCallback(() => {
    localStorage.removeItem('rekordboxLibraryPath');
    setLibraryPath('');
    setLibraryData(null);
    showNotification('info', 'Library data cleared');
  }, [showNotification]);

  // Startup: auto-load last library if the file is still reachable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const run = async () => {
      const savedPath = localStorage.getItem('rekordboxLibraryPath');

      if (!savedPath) {
        setStartupComplete(true);
        return;
      }

      try {
        const { accessible } = await window.electronAPI.checkFileAccessible(savedPath);

        if (accessible) {
          await loadLibrary(savedPath);
        } else {
          localStorage.removeItem('rekordboxLibraryPath');
        }
      } catch (err) {
        console.error('Startup auto-load failed:', err);
        localStorage.removeItem('rekordboxLibraryPath');
      } finally {
        setStartupComplete(true);
      }
    };

    run();
  }, []); // intentionally empty — runs once on mount only

  // Persist library path whenever it changes
  useEffect(() => {
    if (libraryPath) {
      localStorage.setItem('rekordboxLibraryPath', libraryPath);
    }
  }, [libraryPath]);

  return {
    libraryPath,
    libraryData,
    isLoading,
    startupComplete,
    selectLibrary,
    loadLibrary,
    clearStoredData,
    setLibraryData,
  };
};
