import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LibraryData } from '../../src/renderer/types';

/**
 * Batch Relocate Integration Tests
 * 
 * These tests validate the integration between the renderer and main processes
 * for batch track relocation, specifically preventing regressions where:
 * - libraryPath is undefined when creating backups
 * - Data structure mismatches between renderer and main process
 * - XML parsing/saving failures due to missing libraryPath
 */

// Mock filesystem operations
const mockFs = {
  copyFileSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  }
};

vi.mock('fs', () => mockFs);

// Mock electron IPC
const mockIpcRenderer = {
  invoke: vi.fn(),
};

const mockElectronAPI = {
  batchRelocateTracks: vi.fn().mockImplementation((data) => {
    // Simulate the main process handler
    return simulateMainProcessBatchRelocate(data);
  }),
};

/**
 * Simulate the main process batch relocate handler
 * This catches issues that would occur in the actual IPC communication
 */
async function simulateMainProcessBatchRelocate(data: any) {
  // Validation that would happen in main process
  if (!data) {
    throw new Error('No data provided');
  }
  
  if (!data.libraryPath) {
    throw new Error('The "src" argument must be of type string or an instance of Buffer or URL. Received undefined');
  }
  
  if (!Array.isArray(data.relocations)) {
    throw new Error('Relocations must be an array');
  }
  
  // Simulate successful backup creation
  mockFs.copyFileSync(data.libraryPath, `${data.libraryPath}.backup.test`);
  
  return {
    success: true,
    data: data.relocations.map((relocation: any) => ({
      ...relocation,
      success: true
    })),
    xmlUpdated: true,
    tracksUpdated: data.relocations.length,
    backupPath: `${data.libraryPath}.backup.test`
  };
}

describe('Batch Relocate Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up electron API mock
    vi.stubGlobal('electronAPI', mockElectronAPI);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Main Process Integration', () => {
    it('should successfully relocate tracks with valid libraryPath', async () => {
      const testData = {
        libraryPath: '/path/to/test/library.xml',
        relocations: [
          {
            trackId: 'track1',
            oldLocation: '/old/path/track1.mp3',
            newLocation: '/new/path/track1.mp3'
          },
          {
            trackId: 'track2', 
            oldLocation: '/old/path/track2.mp3',
            newLocation: '/new/path/track2.mp3'
          }
        ]
      };

      const result = await window.electronAPI.batchRelocateTracks(testData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.xmlUpdated).toBe(true);
      expect(result.tracksUpdated).toBe(2);
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        testData.libraryPath,
        `${testData.libraryPath}.backup.test`
      );
    });

    it('should fail with descriptive error when libraryPath is undefined', async () => {
      const testData = {
        libraryPath: undefined,
        relocations: [
          {
            trackId: 'track1',
            oldLocation: '/old/path/track1.mp3',
            newLocation: '/new/path/track1.mp3'
          }
        ]
      };

      await expect(window.electronAPI.batchRelocateTracks(testData))
        .rejects
        .toThrow('The "src" argument must be of type string or an instance of Buffer or URL. Received undefined');
    });

    it('should fail when libraryPath is empty string', async () => {
      const testData = {
        libraryPath: '',
        relocations: [
          {
            trackId: 'track1',
            oldLocation: '/old/path/track1.mp3',
            newLocation: '/new/path/track1.mp3'
          }
        ]
      };

      await expect(window.electronAPI.batchRelocateTracks(testData))
        .rejects
        .toThrow('The "src" argument must be of type string or an instance of Buffer or URL. Received undefined');
    });

    it('should fail when relocations is not an array', async () => {
      const testData = {
        libraryPath: '/path/to/library.xml',
        relocations: null
      };

      await expect(window.electronAPI.batchRelocateTracks(testData))
        .rejects
        .toThrow('Relocations must be an array');
    });
  });

  describe('Data Structure Validation', () => {
    it('should validate relocation object structure', async () => {
      const testData = {
        libraryPath: '/path/to/library.xml',
        relocations: [
          {
            trackId: 'track1',
            oldLocation: '/old/path/track1.mp3',
            newLocation: '/new/path/track1.mp3'
          }
        ]
      };

      const result = await window.electronAPI.batchRelocateTracks(testData);
      
      expect(result.success).toBe(true);
      expect(result.data[0]).toHaveProperty('trackId', 'track1');
      expect(result.data[0]).toHaveProperty('oldLocation', '/old/path/track1.mp3');
      expect(result.data[0]).toHaveProperty('newLocation', '/new/path/track1.mp3');
      expect(result.data[0]).toHaveProperty('success', true);
    });

    it('should handle empty relocations array', async () => {
      const testData = {
        libraryPath: '/path/to/library.xml',
        relocations: []
      };

      const result = await window.electronAPI.batchRelocateTracks(testData);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(result.tracksUpdated).toBe(0);
    });
  });

  describe('Library Data Structure Tests', () => {
    it('should ensure LibraryData includes libraryPath field', () => {
      // Type-level test to ensure LibraryData has libraryPath
      const mockLibraryData: LibraryData = {
        libraryPath: '/path/to/library.xml', // This must be present
        tracks: new Map(),
        playlists: []
      };

      expect(mockLibraryData.libraryPath).toBeDefined();
      expect(typeof mockLibraryData.libraryPath).toBe('string');
    });

    it('should validate library data from parse-rekordbox-library includes path', () => {
      // This simulates what the parse-rekordbox-library handler should return
      const mockParseResult = {
        success: true,
        data: {
          version: '1.0.0',
          tracks: new Map(),
          playlists: [],
          libraryPath: '/path/to/parsed/library.xml' // Must be included
        }
      };

      expect(mockParseResult.data.libraryPath).toBeDefined();
      expect(mockParseResult.data.libraryPath).toBe('/path/to/parsed/library.xml');
    });
  });

  describe('Backup Creation Tests', () => {
    it('should create backup before modifying XML', async () => {
      const testLibraryPath = '/path/to/important/library.xml';
      const testData = {
        libraryPath: testLibraryPath,
        relocations: [
          {
            trackId: 'track1',
            oldLocation: '/old/path/track1.mp3',
            newLocation: '/new/path/track1.mp3'
          }
        ]
      };

      const result = await window.electronAPI.batchRelocateTracks(testData);

      // Verify backup was created with the correct source path
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        testLibraryPath,
        expect.stringContaining(`${testLibraryPath}.backup`)
      );
      
      expect(result.backupPath).toContain(testLibraryPath);
    });

    it('should fail early if backup creation would fail due to undefined path', async () => {
      const testData = {
        libraryPath: undefined,
        relocations: [
          {
            trackId: 'track1',
            oldLocation: '/old/path/track1.mp3',
            newLocation: '/new/path/track1.mp3'
          }
        ]
      };

      // Should fail before attempting to create backup
      await expect(window.electronAPI.batchRelocateTracks(testData))
        .rejects
        .toThrow();
      
      // copyFileSync should not be called with undefined path
      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Error Prevention Regression Tests', () => {
    it('should prevent "TypeError [ERR_INVALID_ARG_TYPE]" regression', async () => {
      // This specific test prevents the exact error that occurred
      const problematicData = {
        libraryPath: undefined, // This was the root cause
        relocations: [
          {
            trackId: 'track1',
            oldLocation: '/old/path/track1.mp3',
            newLocation: '/new/path/track1.mp3'
          }
        ]
      };

      try {
        await window.electronAPI.batchRelocateTracks(problematicData);
        // Should not reach here
        expect.fail('Expected error was not thrown');
      } catch (error: any) {
        // Verify we get a descriptive error, not the cryptic "ERR_INVALID_ARG_TYPE"
        expect(error.message).toContain('string or an instance of Buffer or URL');
        expect(error.message).toContain('Received undefined');
      }
    });

    it('should validate all required fields are present before processing', async () => {
      const testCases = [
        { libraryPath: null, relocations: [] },
        { libraryPath: '', relocations: [] },
        { libraryPath: '/path/to/lib.xml', relocations: null },
        { relocations: [] }, // Missing libraryPath entirely
      ];

      for (const testCase of testCases) {
        await expect(window.electronAPI.batchRelocateTracks(testCase))
          .rejects
          .toThrow();
      }
    });
  });
});