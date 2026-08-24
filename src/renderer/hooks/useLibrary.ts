import { useState, useEffect, useCallback } from 'react';
import type { LibraryData, ShowNotification } from '../types';
import { useSettingsStore } from '../stores/settingsStore';

export const useLibrary = (showNotification: ShowNotification) => {
  const [libraryPath, setLibraryPath] = useState<string>('');
  const [libraryData, setLibraryData] = useState<LibraryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startupComplete, setStartupComplete] = useState(false);

  const loadLibrary = useCallback(async (path: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      setLibraryData(null);
      setLibraryPath(path);

      const result = await window.electronAPI.parseRekordboxLibrary(path);
      if (result.success) {
        setLibraryData(result.data);
        showNotification('success', `Loaded ${result.data.tracks.size} tracks from library`);
        return true;
      }
      showNotification('error', result.error || 'Failed to parse library');
      setLibraryPath('');
      return false;
    } catch {
      showNotification('error', 'Failed to load library');
      setLibraryPath('');
      return false;
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

  // Persist library path whenever it changes
  useEffect(() => {
    if (libraryPath) {
      localStorage.setItem('rekordboxLibraryPath', libraryPath);
    }
  }, [libraryPath]);

  /**
   * Load straight from Rekordbox's own database instead of an exported XML.
   * Read-only: the app copies master.db and never writes to it.
   */
  const loadFromDb = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const detected = await window.electronAPI.detectRekordboxDb();
      if (!detected.found || !detected.dbPath) {
        showNotification('error', 'No rekordbox database found on this machine — use XML import instead.');
        return false;
      }

      const key = useSettingsStore.getState().rekordboxDbKey;
      if (!key.trim()) {
        showNotification('error', 'The rekordbox database needs its key — click the database entry on the load screen to paste it.');
        return false;
      }

      setLibraryData(null);
      const result = await window.electronAPI.parseRekordboxDb({ dbPath: detected.dbPath, key });
      if (result.success && result.data) {
        setLibraryPath(detected.dbPath);
        setLibraryData(result.data);
        showNotification('success', `Loaded ${result.data.tracks.size} tracks from the rekordbox database`);
        return true;
      }
      showNotification('error', result.error || 'Could not read the rekordbox database');
      return false;
    } catch {
      showNotification('error', 'Could not read the rekordbox database');
      return false;
    } finally {
      setIsLoading(false);
    }
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
          // A .db path is rekordbox's own database, not an XML export: sending
          // it through the XML parser failed while the message still claimed
          // the library had been reopened.
          const reopened = savedPath.toLowerCase().endsWith('.db')
            ? await loadFromDb()
            : await loadLibrary(savedPath);
          if (reopened) {
            // Say so: restoring the last library silently made it easy to act
            // on a different one than you thought was open.
            showNotification('info', `Reopened your last library: ${savedPath}`);
          }
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

  return {
    libraryPath,
    libraryData,
    isLoading,
    startupComplete,
    selectLibrary,
    loadLibrary,
    loadFromDb,
    clearStoredData,
    setLibraryData,
  };
};
