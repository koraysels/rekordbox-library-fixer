import { useCallback } from 'react';

/**
 * Custom hook for file operations
 * Centralizes file-related functionality to avoid duplication
 */
export const useFileOperations = () => {
  const openFileLocation = useCallback(async (filePath: string) => {
    console.log('🗂️ Opening file location:', filePath);
    try {
      if (window.electronAPI?.showFileInFolder) {
        const result = await window.electronAPI.showFileInFolder(filePath);
        console.log('✅ File location opened:', result);
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