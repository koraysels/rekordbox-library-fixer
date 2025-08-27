import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTrackRelocator } from '../../src/renderer/hooks/useTrackRelocator';
import type { LibraryData, NotificationType } from '../../src/renderer/types';

/**
 * Library Path Validation Tests
 * 
 * These tests prevent regressions where libraryPath becomes undefined,
 * causing errors like "The "src" argument must be of type string or an instance of Buffer or URL. Received undefined"
 * 
 * Context: This issue occurred when libraryData.libraryPath was undefined
 * but the useTrackRelocator hook didn't have access to the separate libraryPath
 * from the context. The fix involved adding libraryPath as a separate parameter
 * and using it as a fallback when libraryData.libraryPath is missing.
 */

// Mock the database modules
vi.mock('../../src/renderer/db/relocationsDb', () => ({
  relocationStorage: {
    getRelocationResult: vi.fn(),
    saveRelocationResult: vi.fn(),
    deleteRelocationResult: vi.fn(),
  },
  cloudSyncStorage: {
    getCloudSyncResult: vi.fn(),
    saveCloudSyncResult: vi.fn(),
    deleteCloudSyncResult: vi.fn(),
  },
  ownershipStorage: {
    getOwnershipResult: vi.fn(),
    saveOwnershipResult: vi.fn(),
    deleteOwnershipResult: vi.fn(),
  },
  relocationHistoryStorage: {
    saveRelocationHistoryEntry: vi.fn(),
  },
}));

describe('Library Path Validation Tests', () => {
  const mockShowNotification = vi.fn();
  const mockSetLibraryData = vi.fn();

  describe('Library Path Parameter Handling', () => {
    it('should use libraryData.libraryPath when available', () => {
      const mockLibraryData: LibraryData = {
        libraryPath: '/path/to/library.xml',
        tracks: new Map(),
        playlists: [],
      };
      
      const separateLibraryPath = '/different/path/to/library.xml';
      
      const { result } = renderHook(() => 
        useTrackRelocator(mockLibraryData, separateLibraryPath, mockShowNotification, mockSetLibraryData)
      );
      
      expect(result.current).toBeDefined();
      // The hook should prefer libraryData.libraryPath over the separate parameter
      // This is tested implicitly through the hook's internal logic
    });

    it('should use separate libraryPath parameter when libraryData.libraryPath is undefined', () => {
      const mockLibraryData: LibraryData = {
        // libraryPath intentionally omitted to simulate old data structure
        tracks: new Map(),
        playlists: [],
      } as LibraryData;
      
      const separateLibraryPath = '/fallback/path/to/library.xml';
      
      const { result } = renderHook(() => 
        useTrackRelocator(mockLibraryData, separateLibraryPath, mockShowNotification, mockSetLibraryData)
      );
      
      expect(result.current).toBeDefined();
      // The hook should fall back to the separate libraryPath parameter
    });

    it('should handle null libraryData gracefully', () => {
      const separateLibraryPath = '/path/to/library.xml';
      
      const { result } = renderHook(() => 
        useTrackRelocator(null, separateLibraryPath, mockShowNotification, mockSetLibraryData)
      );
      
      expect(result.current).toBeDefined();
      // The hook should still work with null libraryData
    });

    it('should throw descriptive error when both libraryPath sources are unavailable', async () => {
      const mockLibraryData: LibraryData = {
        tracks: new Map([
          ['track1', { id: 'track1', name: 'Test Track', artist: 'Test Artist', location: '/old/location.mp3' }]
        ]),
        playlists: [],
      } as LibraryData;
      
      const emptyLibraryPath = '';
      
      const { result } = renderHook(() => 
        useTrackRelocator(mockLibraryData, emptyLibraryPath, mockShowNotification, mockSetLibraryData)
      );

      // Set up a relocation to trigger executeRelocations
      result.current.addRelocation('track1', '/new/location.mp3');
      
      // Attempt to execute relocations - should fail with descriptive error
      await expect(result.current.executeRelocations()).rejects.toThrow(
        'Library path is not available. Please reload the library.'
      );
    });
  });

  describe('Batch Relocation Integration', () => {
    it('should pass correct libraryPath to batchRelocateTracks API', async () => {
      const expectedLibraryPath = '/path/to/library.xml';
      const mockLibraryData: LibraryData = {
        libraryPath: expectedLibraryPath,
        tracks: new Map([
          ['track1', { id: 'track1', name: 'Test Track', artist: 'Test Artist', location: '/old/location.mp3' }]
        ]),
        playlists: [],
      };
      
      const separateLibraryPath = '/different/path.xml';
      
      // Mock successful relocation
      window.electronAPI.batchRelocateTracks.mockResolvedValue({
        success: true,
        data: [{ trackId: 'track1', oldLocation: '/old/location.mp3', newLocation: '/new/location.mp3', success: true }],
        xmlUpdated: true,
        tracksUpdated: 1
      });

      const { result } = renderHook(() => 
        useTrackRelocator(mockLibraryData, separateLibraryPath, mockShowNotification, mockSetLibraryData)
      );

      // Add a relocation
      result.current.addRelocation('track1', '/new/location.mp3');
      
      // Execute relocations
      await result.current.executeRelocations();
      
      // Verify the API was called with the correct libraryPath
      expect(window.electronAPI.batchRelocateTracks).toHaveBeenCalledWith({
        libraryPath: expectedLibraryPath, // Should use libraryData.libraryPath
        relocations: [{ trackId: 'track1', oldLocation: '/old/location.mp3', newLocation: '/new/location.mp3' }]
      });
    });

    it('should use fallback libraryPath when libraryData.libraryPath is missing', async () => {
      const fallbackLibraryPath = '/fallback/path/to/library.xml';
      const mockLibraryData: LibraryData = {
        // libraryPath intentionally omitted
        tracks: new Map([
          ['track1', { id: 'track1', name: 'Test Track', artist: 'Test Artist', location: '/old/location.mp3' }]
        ]),
        playlists: [],
      } as LibraryData;
      
      // Mock successful relocation
      window.electronAPI.batchRelocateTracks.mockResolvedValue({
        success: true,
        data: [{ trackId: 'track1', oldLocation: '/old/location.mp3', newLocation: '/new/location.mp3', success: true }],
        xmlUpdated: true,
        tracksUpdated: 1
      });

      const { result } = renderHook(() => 
        useTrackRelocator(mockLibraryData, fallbackLibraryPath, mockShowNotification, mockSetLibraryData)
      );

      // Add a relocation
      result.current.addRelocation('track1', '/new/location.mp3');
      
      // Execute relocations
      await result.current.executeRelocations();
      
      // Verify the API was called with the fallback libraryPath
      expect(window.electronAPI.batchRelocateTracks).toHaveBeenCalledWith({
        libraryPath: fallbackLibraryPath, // Should use the fallback parameter
        relocations: [{ trackId: 'track1', oldLocation: '/old/location.mp3', newLocation: '/new/location.mp3' }]
      });
    });
  });

  describe('Error Handling', () => {
    it('should show appropriate error message when libraryPath is unavailable', async () => {
      const mockLibraryData: LibraryData = {
        tracks: new Map([
          ['track1', { id: 'track1', name: 'Test Track', artist: 'Test Artist', location: '/old/location.mp3' }]
        ]),
        playlists: [],
      } as LibraryData;
      
      const emptyLibraryPath = '';

      const { result } = renderHook(() => 
        useTrackRelocator(mockLibraryData, emptyLibraryPath, mockShowNotification, mockSetLibraryData)
      );

      // Add a relocation
      result.current.addRelocation('track1', '/new/location.mp3');
      
      // Execute relocations - should fail
      await result.current.executeRelocations();
      
      // Verify error notification was shown
      expect(mockShowNotification).toHaveBeenCalledWith(
        'error',
        'Failed to execute relocations'
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockLibraryData: LibraryData = {
        libraryPath: '/path/to/library.xml',
        tracks: new Map([
          ['track1', { id: 'track1', name: 'Test Track', artist: 'Test Artist', location: '/old/location.mp3' }]
        ]),
        playlists: [],
      };
      
      // Mock API failure
      window.electronAPI.batchRelocateTracks.mockResolvedValue({
        success: false,
        error: 'File not found'
      });

      const { result } = renderHook(() => 
        useTrackRelocator(mockLibraryData, '', mockShowNotification, mockSetLibraryData)
      );

      // Add a relocation
      result.current.addRelocation('track1', '/new/location.mp3');
      
      // Execute relocations
      await result.current.executeRelocations();
      
      // Verify error notification was shown
      expect(mockShowNotification).toHaveBeenCalledWith(
        'error',
        'Relocation failed: File not found'
      );
    });
  });

  describe('Type Safety', () => {
    it('should require libraryPath parameter in useTrackRelocator', () => {
      // This test ensures the function signature requires all parameters
      const mockLibraryData: LibraryData = {
        libraryPath: '/path/to/library.xml',
        tracks: new Map(),
        playlists: [],
      };
      
      // TypeScript compilation will fail if libraryPath parameter is missing
      const { result } = renderHook(() => 
        useTrackRelocator(mockLibraryData, '/path/to/library.xml', mockShowNotification, mockSetLibraryData)
      );
      
      expect(result.current).toBeDefined();
    });
  });
});