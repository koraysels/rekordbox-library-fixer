import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

/**
 * Component Rendering Tests
 * 
 * These tests ensure that all our major components can render without 
 * throwing runtime errors, especially after refactoring.
 * This catches issues like missing imports, undefined functions, etc.
 */

// Mock all external dependencies that components might need
vi.mock('../../src/renderer/hooks/useDuplicates', () => ({
  useDuplicates: () => ({
    duplicates: [],
    setDuplicates: vi.fn(),
    isScanning: false,
    setIsScanning: vi.fn(),
    hasScanned: false,
    setHasScanned: vi.fn(),
    selectedDuplicates: new Set(),
    scanOptions: {
      useFingerprint: true,
      useMetadata: false,
      metadataFields: ['artist', 'title'],
      pathPreferences: []
    },
    setScanOptions: vi.fn(),
    resolutionStrategy: 'keep-highest-quality',
    setResolutionStrategy: vi.fn(),
    currentLibraryPath: '',
    setCurrentLibraryPath: vi.fn(),
    toggleDuplicateSelection: vi.fn(),
    selectAll: vi.fn(),
    clearAll: vi.fn(),
    setSelections: vi.fn(),
    isResolveDisabled: false,
    searchFilter: '',
    setSearchFilter: vi.fn(),
    isSearching: false,
    filteredDuplicates: []
  })
}));

vi.mock('../../src/renderer/hooks/useTrackRelocator', () => ({
  useTrackRelocator: () => ({
    missingTracks: [],
    isScanning: false,
    hasScanCompleted: false,
    selectedTrack: null,
    candidates: [],
    isFindingCandidates: false,
    relocations: new Map(),
    isRelocating: false,
    searchOptions: { 
      searchPaths: [], 
      searchDepth: 3, 
      matchThreshold: 0.8, 
      fileExtensions: ['.mp3', '.wav', '.flac', '.aac'] 
    },
    stats: {
      totalMissingTracks: 0,
      configuredRelocations: 0,
      hasSearchPaths: false
    },
    scanForMissingTracks: vi.fn(),
    findRelocationCandidates: vi.fn(),
    addRelocation: vi.fn(),
    removeRelocation: vi.fn(),
    executeRelocations: vi.fn(),
    updateSearchOptions: vi.fn(),
    clearResults: vi.fn()
  })
}));

vi.mock('../../src/renderer/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    scanOptions: {
      useFingerprint: true,
      useMetadata: false,
      metadataFields: ['artist', 'title'],
      pathPreferences: []
    },
    setScanOptions: vi.fn(),
    resolutionStrategy: 'keep-highest-quality',
    setResolutionStrategy: vi.fn(),
    addPathPreference: vi.fn(),
    removePathPreference: vi.fn(),
    relocationOptions: { 
      searchPaths: [], 
      searchDepth: 3, 
      matchThreshold: 0.8, 
      fileExtensions: ['.mp3', '.wav', '.flac', '.aac'] 
    },
    addRelocationSearchPath: vi.fn(),
    removeRelocationSearchPath: vi.fn()
  })
}));

// Mock window.electronAPI if it doesn't exist
if (!window.electronAPI) {
  Object.defineProperty(window, 'electronAPI', {
    value: {
      showFileInFolder: vi.fn(),
      getDuplicateResults: vi.fn().mockResolvedValue({ success: false }),
      saveDuplicateResults: vi.fn().mockResolvedValue({ success: true }),
      selectFolder: vi.fn().mockResolvedValue('/test/folder')
    },
    writable: true
  });
} else {
  // If it exists, mock all the methods we need
  window.electronAPI.showFileInFolder = vi.fn();
  window.electronAPI.getDuplicateResults = vi.fn().mockResolvedValue({ success: false });
  window.electronAPI.saveDuplicateResults = vi.fn().mockResolvedValue({ success: true });
  window.electronAPI.selectFolder = vi.fn().mockResolvedValue('/test/folder');
}

describe('Component Rendering Tests', () => {
  describe('DuplicateItem', () => {
    it('should render without crashing', async () => {
      const DuplicateItem = (await import('../../src/renderer/components/DuplicateItem')).default;
      
      const mockDuplicate = {
        id: '1',
        tracks: [
          {
            id: '1',
            name: 'Test Track',
            artist: 'Test Artist',
            album: 'Test Album',
            location: '/test/path.mp3',
            bitrate: 320,
            size: 5000000,
            duration: 240,
            rating: 5
          }
        ],
        confidence: 95,
        matchType: 'metadata'
      };

      expect(() => {
        render(
          <DuplicateItem
            duplicate={mockDuplicate}
            isSelected={false}
            onToggleSelection={vi.fn()}
            resolutionStrategy="keep-highest-quality"
          />
        );
      }).not.toThrow();

      expect(screen.getByText('Test Artist - Test Track')).toBeInTheDocument();
      expect(screen.getByText('1 duplicates')).toBeInTheDocument();
    });

    it('should handle missing track data gracefully', async () => {
      const DuplicateItem = (await import('../../src/renderer/components/DuplicateItem')).default;
      
      const mockDuplicate = {
        id: '1',
        tracks: [
          {
            id: '1',
            name: 'Test Track',
            artist: 'Test Artist'
            // Missing other properties
          }
        ],
        confidence: 50,
        matchType: 'metadata'
      };

      expect(() => {
        render(
          <DuplicateItem
            duplicate={mockDuplicate}
            isSelected={false}
            onToggleSelection={vi.fn()}
            resolutionStrategy="manual"
          />
        );
      }).not.toThrow();
    });
  });

  describe('DuplicateDetector', () => {
    it('should render without crashing', async () => {
      const DuplicateDetector = (await import('../../src/renderer/components/DuplicateDetector')).default;
      
      const mockLibraryData = {
        tracks: new Map(),
        playlists: []
      };

      await act(async () => {
        render(
          <DuplicateDetector
            libraryData={mockLibraryData}
            libraryPath="/test/path.xml"
            onUpdate={vi.fn()}
            showNotification={vi.fn()}
          />
        );
      });

      expect(screen.getByText('Duplicate Detection')).toBeInTheDocument();
    });
  });

  describe('TrackRelocator', () => {
    it('should render without crashing', async () => {
      const TrackRelocator = (await import('../../src/renderer/components/TrackRelocator')).TrackRelocator;
      
      const mockLibraryData = {
        tracks: new Map(),
        playlists: []
      };

      expect(() => {
        render(
          <TrackRelocator
            libraryData={mockLibraryData}
            showNotification={vi.fn()}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('Track Relocator')).toBeInTheDocument();
    });

    it('should handle null library data', async () => {
      const TrackRelocator = (await import('../../src/renderer/components/TrackRelocator')).TrackRelocator;

      expect(() => {
        render(
          <TrackRelocator
            libraryData={null}
            showNotification={vi.fn()}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('No Library Loaded')).toBeInTheDocument();
    });
  });

  describe('TrackDetails', () => {
    it('should render without crashing', async () => {
      const TrackDetails = (await import('../../src/renderer/components/TrackDetails')).default;
      
      const mockTrack = {
        name: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 240,
        size: 5000000,
        bitrate: 320,
        rating: 5,
        bpm: 128,
        key: 'C major',
        genre: 'House',
        playCount: 10
      };

      expect(() => {
        render(<TrackDetails track={mockTrack} />);
      }).not.toThrow();

      expect(screen.getByText('Test Artist')).toBeInTheDocument();
      expect(screen.getByText('Test Album')).toBeInTheDocument();
    });

    it('should handle missing track properties', async () => {
      const TrackDetails = (await import('../../src/renderer/components/TrackDetails')).default;
      
      const mockTrack = {
        name: 'Test Track',
        artist: 'Test Artist'
        // Missing most properties
      };

      expect(() => {
        render(<TrackDetails track={mockTrack} />);
      }).not.toThrow();

      expect(screen.getByText('Test Artist')).toBeInTheDocument();
      // Should show N/A for missing data
      expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
    });
  });

  describe('Shared UI Components', () => {
    it('should render PopoverButton without crashing', async () => {
      const { PopoverButton } = await import('../../src/renderer/components/ui');
      
      // Mock icon component
      const MockIcon = () => <span>Icon</span>;

      expect(() => {
        render(
          <PopoverButton
            onClick={vi.fn()}
            icon={MockIcon}
            title="Test Button"
            description="Test description"
          >
            Click me
          </PopoverButton>
        );
      }).not.toThrow();

      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should render ConfidenceBadge without crashing', async () => {
      const { ConfidenceBadge } = await import('../../src/renderer/components/ui');

      expect(() => {
        render(<ConfidenceBadge confidence={95} />);
      }).not.toThrow();

      expect(screen.getByText('High')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('should verify all components use shared utilities correctly', async () => {
      // Test that components can use shared utilities without errors
      const { formatFileSize, formatDuration } = await import('../../src/renderer/utils');
      
      expect(formatFileSize(5000000)).toBe('4.8 MB');
      expect(formatDuration(240)).toBe('4:00');
      
      // These should not throw errors
      expect(() => formatFileSize(undefined)).not.toThrow();
      expect(() => formatDuration(undefined)).not.toThrow();
    });

    it('should verify all components can use shared hooks', async () => {
      const { useFileOperations } = await import('../../src/renderer/hooks');
      
      expect(useFileOperations).toBeDefined();
      expect(typeof useFileOperations).toBe('function');
    });
  });

  describe('Error Boundaries', () => {
    it('should handle component errors gracefully', async () => {
      // Test that components handle undefined props gracefully
      const { ConfidenceBadge } = await import('../../src/renderer/components/ui');

      expect(() => {
        render(<ConfidenceBadge confidence={NaN} />);
      }).not.toThrow();
    });
  });
});