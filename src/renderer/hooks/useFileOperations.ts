import { useCallback } from 'react';

/**
 * Custom hook for file operations
 * Centralizes file-related functionality to avoid duplication
 */
export const useFileOperations = () => {
  const openFileLocation = useCallback(async (filePath: string): Promise<string | undefined> => {
    console.log('🗂️ Opening file location:', filePath);
    try {
      if (window.electronAPI?.showFileInFolder) {
        const result = await window.electronAPI.showFileInFolder(filePath);
        // A missing file makes the reveal a no-op, which reads as a dead
        // button; hand the reason back so the caller can say something.
        if (!result?.success) { return result?.error ?? 'Could not open that location.'; }
      } else {
        console.error('❌ showFileInFolder API not available');
        alert('File manager integration not available');
      }
    } catch (error) {
      console.error('❌ Failed to open file location:', error);
      alert(`Failed to open file location: ${error}`);
    }
  }, []);

  return {
    openFileLocation
  };
};