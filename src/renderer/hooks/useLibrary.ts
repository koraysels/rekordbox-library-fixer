import { useState, useEffect, useCallback } from 'react';
import type { LibraryData, NotificationType } from '../types';

export const useLibrary = (showNotification: (type: NotificationType, message: string) => void) => {
  const [libraryPath, setLibraryPath] = useState<string>('');
  const [libraryData, setLibraryData] = useState<LibraryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectLibrary = useCallback(async () => {
    try {
      const path = await window.electronAPI.selectRekordboxXML();
      if (path) {
        // Clear previous library data when selecting new library
        setLibraryData(null);
        setLibraryPath(path);
        await loadLibrary(path);
      }
    } catch (error) {
      showNotification('error', 'Failed to select library file');
    }
  }, [showNotification]);

  const loadLibrary = useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.parseRekordboxLibrary(path);
      if (result.success) {
        setLibraryData(result.data);
        showNotification('success', `Loaded ${result.data.tracks.size} tracks from library`);
      } else {
        showNotification('error', result.error || 'Failed to parse library');
      }
    } catch (error) {
      showNotification('error', 'Failed to load library');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  const clearStoredData = useCallback(() => {
    localStorage.removeItem('rekordboxLibraryPath');
    localStorage.removeItem('rekordboxLibraryData');
    setLibraryPath('');
    setLibraryData(null);
    showNotification('info', 'Library data cleared');
  }, [showNotification]);

  // Load persisted library data on mount
  useEffect(() => {
    const savedLibraryPath = localStorage.getItem('rekordboxLibraryPath');
    const savedLibraryData = localStorage.getItem('rekordboxLibraryData');

    if (savedLibraryPath) {
      setLibraryPath(savedLibraryPath);
    }

    if (savedLibraryData) {
      try {
        const parsedData = JSON.parse(savedLibraryData);
        // Convert tracks array back to Map
        if (parsedData && parsedData.tracks && Array.isArray(parsedData.tracks)) {
          parsedData.tracks = new Map(parsedData.tracks);
          setLibraryData(parsedData);
        }
      } catch (error) {
        console.warn('Failed to load saved library data:', error);
        localStorage.removeItem('rekordboxLibraryData');
      }
    }
  }, []);

  // Save library data whenever it changes
  useEffect(() => {
    if (libraryData) {
      try {
        // Convert Map to array for JSON serialization
        const dataToSave = {
          ...libraryData,
          tracks: Array.from(libraryData.tracks.entries())
        };
        localStorage.setItem('rekordboxLibraryData', JSON.stringify(dataToSave));
      } catch (error) {
        console.warn('Failed to save library data:', error);
      }
    }
  }, [libraryData]);

  // Save library path whenever it changes
  useEffect(() => {
    if (libraryPath) {
      localStorage.setItem('rekordboxLibraryPath', libraryPath);
    }
  }, [libraryPath]);

  return {
    libraryPath,
    libraryData,
    isLoading,
    selectLibrary,
    loadLibrary,
    clearStoredData,
    setLibraryData
  };
};