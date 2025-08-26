import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettingsStore } from '@renderer/stores/settingsStore';
import type { ScanOptions, ResolutionStrategy } from '@renderer/types';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Zustand persist
vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual('zustand/middleware');
  return {
    ...actual,
    persist: (config: any, options: any) => {
      // Simple mock that still allows state changes but doesn't actually persist
      return config;
    }
  };
});

describe('Settings Persistence', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  afterEach(() => {
    // Reset store state
    act(() => {
      useSettingsStore.setState({
        scanOptions: {
          useFingerprint: true,
          useMetadata: false,
          metadataFields: ['artist', 'title', 'duration'],
          pathPreferences: []
        },
        resolutionStrategy: 'keep-highest-quality'
      });
    });
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    expect(result.current.scanOptions).toEqual({
      useFingerprint: true,
      useMetadata: false,
      metadataFields: ['artist', 'title', 'duration'],
      pathPreferences: []
    });
    
    expect(result.current.resolutionStrategy).toBe('keep-highest-quality');
  });

  it('updates scan options correctly', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    const newOptions: ScanOptions = {
      useFingerprint: false,
      useMetadata: true,
      metadataFields: ['artist', 'title', 'album'],
      pathPreferences: ['/path/to/music']
    };
    
    act(() => {
      result.current.setScanOptions(newOptions);
    });
    
    expect(result.current.scanOptions).toEqual(newOptions);
  });

  it('updates resolution strategy correctly', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    const newStrategy: ResolutionStrategy = 'keep-newest';
    
    act(() => {
      result.current.setResolutionStrategy(newStrategy);
    });
    
    expect(result.current.resolutionStrategy).toBe(newStrategy);
  });

  it('updates individual scan option correctly', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.updateScanOption('useMetadata', true);
    });
    
    expect(result.current.scanOptions.useMetadata).toBe(true);
    expect(result.current.scanOptions.useFingerprint).toBe(true); // Should remain unchanged
  });

  it('adds path preference correctly', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.addPathPreference('/path/to/music');
    });
    
    expect(result.current.scanOptions.pathPreferences).toContain('/path/to/music');
  });

  it('does not add duplicate path preferences', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.addPathPreference('/path/to/music');
      result.current.addPathPreference('/path/to/music'); // Duplicate
    });
    
    expect(result.current.scanOptions.pathPreferences).toEqual(['/path/to/music']);
  });

  it('removes path preference correctly', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.addPathPreference('/path/1');
      result.current.addPathPreference('/path/2');
      result.current.addPathPreference('/path/3');
    });
    
    act(() => {
      result.current.removePathPreference(1); // Remove '/path/2'
    });
    
    expect(result.current.scanOptions.pathPreferences).toEqual(['/path/1', '/path/3']);
  });

  it('ignores empty path preferences', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.addPathPreference('');
      result.current.addPathPreference('   '); // Only whitespace
    });
    
    expect(result.current.scanOptions.pathPreferences).toEqual([]);
  });

  it('trims path preferences', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.addPathPreference('  /path/to/music  ');
    });
    
    expect(result.current.scanOptions.pathPreferences).toEqual(['/path/to/music']);
  });
});

describe('Settings Store Integration', () => {
  it('maintains state consistency across multiple updates', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      // Update multiple settings
      result.current.setScanOptions({
        useFingerprint: false,
        useMetadata: true,
        metadataFields: ['artist', 'title', 'album', 'duration', 'bpm'],
        pathPreferences: ['/music/main', '/music/backup']
      });
      
      result.current.setResolutionStrategy('keep-preferred-path');
    });
    
    // Verify all changes are applied correctly
    expect(result.current.scanOptions.useFingerprint).toBe(false);
    expect(result.current.scanOptions.useMetadata).toBe(true);
    expect(result.current.scanOptions.metadataFields).toHaveLength(5);
    expect(result.current.scanOptions.pathPreferences).toHaveLength(2);
    expect(result.current.resolutionStrategy).toBe('keep-preferred-path');
  });

  it('handles rapid consecutive updates correctly', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    // Reset to initial state first
    act(() => {
      result.current.setScanOptions({
        useFingerprint: true,
        useMetadata: false,
        metadataFields: ['artist', 'title', 'duration'],
        pathPreferences: []
      });
    });
    
    act(() => {
      // Rapid updates
      result.current.updateScanOption('useFingerprint', false);
      result.current.updateScanOption('useMetadata', true);
      result.current.addPathPreference('/path/1');
      result.current.addPathPreference('/path/2');
      result.current.setResolutionStrategy('manual');
    });
    
    // All updates should be applied
    expect(result.current.scanOptions.useFingerprint).toBe(false);
    expect(result.current.scanOptions.useMetadata).toBe(true);
    expect(result.current.scanOptions.pathPreferences).toEqual(['/path/1', '/path/2']);
    expect(result.current.resolutionStrategy).toBe('manual');
  });
});