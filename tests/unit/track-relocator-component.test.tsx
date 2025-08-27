import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TrackRelocator } from '../../src/renderer/components/TrackRelocator';
import type { LibraryData } from '../../src/renderer/types';

/**
 * TrackRelocator Component Tests
 * 
 * These tests validate that the TrackRelocator component properly passes
 * the libraryPath parameter to the useTrackRelocator hook, preventing
 * regressions where libraryPath becomes undefined.
 */

// Mock the useTrackRelocator hook
const mockUseTrackRelocator = vi.fn();
vi.mock('../../src/renderer/hooks/useTrackRelocator', () => ({
  useTrackRelocator: mockUseTrackRelocator
}));

// Mock other dependencies
vi.mock('../../src/renderer/stores/settingsStore', () => ({
  useSettingsStore: vi.fn(() => ({
    relocationOptions: {
      searchPaths: [],
      searchDepth: 3,
      matchThreshold: 0.7,
      includeSubdirectories: true,
      fileExtensions: ['.mp3', '.m4a']
    },
    setRelocationOptions: vi.fn(),
    addRelocationSearchPath: vi.fn(),
    removeRelocationSearchPath: vi.fn()
  }))
}));

vi.mock('../../src/renderer/db/relocationsDb', () => ({
  relocationHistoryStorage: {
    getRelocationHistory: vi.fn(() => Promise.resolve([])),
    getRelocationStats: vi.fn(() => Promise.resolve({
      totalRelocations: 0,
      autoRelocations: 0,
      manualRelocations: 0,
      averageConfidence: 0,
      recentRelocations: 0
    }))
  }
}));

// Mock the AppContext
const mockAppContextValue = {
  libraryData: null as LibraryData | null,
  libraryPath: '',
  showNotification: vi.fn(),
  setLibraryData: vi.fn(),
};

vi.mock('../../src/renderer/AppWithRouter', () => ({
  useAppContext: () => mockAppContextValue
}));

// Default mock implementation for useTrackRelocator
const mockHookReturn = {
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
    matchThreshold: 0.7,
    includeSubdirectories: true,
    fileExtensions: ['.mp3', '.m4a']
  },
  stats: {
    totalMissingTracks: 0,
    configuredRelocations: 0,
    successfulRelocations: 0,
    hasSearchPaths: false
  },
  scanForMissingTracks: vi.fn(),
  findRelocationCandidates: vi.fn(),
  addRelocation: vi.fn(),
  removeRelocation: vi.fn(),
  executeRelocations: vi.fn(),
  updateSearchOptions: vi.fn(),
  clearResults: vi.fn(),
};

describe('TrackRelocator Component Library Path Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTrackRelocator.mockReturnValue(mockHookReturn);
  });

  const renderTrackRelocator = () => {
    return render(
      <MemoryRouter>
        <TrackRelocator />
      </MemoryRouter>
    );
  };

  describe('Library Path Parameter Passing', () => {
    it('should pass both libraryData and libraryPath to useTrackRelocator hook', () => {
      const testLibraryData: LibraryData = {
        libraryPath: '/path/to/library.xml',
        tracks: new Map(),
        playlists: [],
      };
      
      const testLibraryPath = '/separate/path/to/library.xml';
      
      // Update mock context
      mockAppContextValue.libraryData = testLibraryData;
      mockAppContextValue.libraryPath = testLibraryPath;

      renderTrackRelocator();

      // Verify useTrackRelocator was called with correct parameters
      expect(mockUseTrackRelocator).toHaveBeenCalledWith(
        testLibraryData,
        testLibraryPath,
        expect.any(Function) // showNotification
      );
    });

    it('should pass empty string libraryPath when not available', () => {
      const testLibraryData: LibraryData = {
        libraryPath: '/path/in/library/data.xml',
        tracks: new Map(),
        playlists: [],
      };
      
      // Update mock context with empty libraryPath
      mockAppContextValue.libraryData = testLibraryData;
      mockAppContextValue.libraryPath = '';

      renderTrackRelocator();

      // Verify useTrackRelocator was called with empty string for libraryPath
      expect(mockUseTrackRelocator).toHaveBeenCalledWith(
        testLibraryData,
        '', // Empty string libraryPath
        expect.any(Function)
      );
    });

    it('should pass null libraryData and libraryPath when no library is loaded', () => {
      // Update mock context with null/empty values
      mockAppContextValue.libraryData = null;
      mockAppContextValue.libraryPath = '';

      renderTrackRelocator();

      // Verify useTrackRelocator was called with null/empty values
      expect(mockUseTrackRelocator).toHaveBeenCalledWith(
        null,
        '',
        expect.any(Function)
      );
    });
  });

  describe('Component Rendering with Different Library States', () => {
    it('should render "No Library Loaded" state when libraryData is null', () => {
      mockAppContextValue.libraryData = null;
      mockAppContextValue.libraryPath = '';

      renderTrackRelocator();

      expect(screen.getByText('No Library Loaded')).toBeDefined();
      expect(screen.getByText('Please load a Rekordbox library to use the track relocator.')).toBeDefined();
    });

    it('should render main interface when library is loaded', () => {
      const testLibraryData: LibraryData = {
        libraryPath: '/path/to/library.xml',
        tracks: new Map(),
        playlists: [],
      };

      mockAppContextValue.libraryData = testLibraryData;
      mockAppContextValue.libraryPath = '/path/to/library.xml';

      renderTrackRelocator();

      // Should render the main track relocator interface
      expect(screen.getByText('Track Relocator')).toBeDefined();
    });
  });

  describe('Hook Parameter Validation', () => {
    it('should ensure useTrackRelocator receives exactly 4 parameters', () => {
      const testLibraryData: LibraryData = {
        libraryPath: '/test/path.xml',
        tracks: new Map(),
        playlists: [],
      };

      mockAppContextValue.libraryData = testLibraryData;
      mockAppContextValue.libraryPath = '/test/path.xml';

      renderTrackRelocator();

      // Verify the hook was called with exactly the expected number of parameters
      expect(mockUseTrackRelocator).toHaveBeenCalledTimes(1);
      const callArgs = mockUseTrackRelocator.mock.calls[0];
      expect(callArgs).toHaveLength(4);
      
      // Verify parameter types
      expect(callArgs[0]).toBe(testLibraryData); // LibraryData
      expect(typeof callArgs[1]).toBe('string'); // libraryPath
      expect(typeof callArgs[2]).toBe('function'); // showNotification
      expect(typeof callArgs[3]).toBe('function'); // setLibraryData
    });

    it('should pass consistent libraryPath across re-renders', () => {
      const testLibraryData: LibraryData = {
        libraryPath: '/consistent/path.xml',
        tracks: new Map(),
        playlists: [],
      };

      mockAppContextValue.libraryData = testLibraryData;
      mockAppContextValue.libraryPath = '/consistent/path.xml';

      const { rerender } = renderTrackRelocator();
      
      // Clear call history and re-render
      mockUseTrackRelocator.mockClear();
      rerender(
        <MemoryRouter>
          <TrackRelocator />
        </MemoryRouter>
      );

      // Verify the same libraryPath is passed on re-render
      expect(mockUseTrackRelocator).toHaveBeenCalledWith(
        testLibraryData,
        '/consistent/path.xml',
        expect.any(Function)
      );
    });
  });

  describe('Regression Prevention', () => {
    it('should prevent regression where libraryPath parameter was missing', () => {
      // This test ensures the component always passes the libraryPath parameter
      // to prevent the "libraryPath undefined" regression
      
      const testLibraryData: LibraryData = {
        // Simulate old data structure without libraryPath
        tracks: new Map(),
        playlists: [],
      } as LibraryData;

      const fallbackLibraryPath = '/fallback/path.xml';
      mockAppContextValue.libraryData = testLibraryData;
      mockAppContextValue.libraryPath = fallbackLibraryPath;

      renderTrackRelocator();

      // Verify the component passes the fallback libraryPath
      const callArgs = mockUseTrackRelocator.mock.calls[0];
      expect(callArgs[1]).toBe(fallbackLibraryPath);
    });

    it('should maintain backward compatibility with legacy library data', () => {
      // Simulate legacy library data that might not have libraryPath
      const legacyLibraryData = {
        tracks: new Map(),
        playlists: [],
        // Note: libraryPath field is missing (legacy data)
      } as LibraryData;

      const contextLibraryPath = '/context/library/path.xml';
      mockAppContextValue.libraryData = legacyLibraryData;
      mockAppContextValue.libraryPath = contextLibraryPath;

      renderTrackRelocator();

      // The hook should receive both the legacy data and the separate path
      expect(mockUseTrackRelocator).toHaveBeenCalledWith(
        legacyLibraryData,
        contextLibraryPath, // This provides the missing path information
        expect.any(Function)
      );
    });
  });
});