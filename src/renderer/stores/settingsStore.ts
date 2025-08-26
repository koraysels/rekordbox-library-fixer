import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScanOptions, ResolutionStrategy } from '../types';

interface SettingsState {
  // Settings
  scanOptions: ScanOptions;
  resolutionStrategy: ResolutionStrategy;
  
  // Actions
  setScanOptions: (options: ScanOptions) => void;
  setResolutionStrategy: (strategy: ResolutionStrategy) => void;
  updateScanOption: <K extends keyof ScanOptions>(key: K, value: ScanOptions[K]) => void;
  addPathPreference: (path: string) => void;
  removePathPreference: (index: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      scanOptions: {
        useFingerprint: true,
        useMetadata: false,
        metadataFields: ['artist', 'title', 'duration'],
        pathPreferences: []
      },
      resolutionStrategy: 'keep-highest-quality',

      // Actions
      setScanOptions: (options) => {
        console.log('🔧 Zustand: Setting scan options:', options);
        set({ scanOptions: options });
      },

      setResolutionStrategy: (strategy) => {
        console.log('🎯 Zustand: Setting resolution strategy:', strategy);
        set({ resolutionStrategy: strategy });
      },

      updateScanOption: (key, value) => {
        console.log(`🔧 Zustand: Updating scan option ${key}:`, value);
        set((state) => ({
          scanOptions: {
            ...state.scanOptions,
            [key]: value
          }
        }));
      },

      addPathPreference: (path) => {
        const trimmedPath = path.trim();
        if (!trimmedPath) return;
        
        set((state) => {
          if (state.scanOptions.pathPreferences.includes(trimmedPath)) {
            return state; // Already exists, no change
          }
          
          console.log('📁 Zustand: Adding path preference:', trimmedPath);
          return {
            scanOptions: {
              ...state.scanOptions,
              pathPreferences: [...state.scanOptions.pathPreferences, trimmedPath]
            }
          };
        });
      },

      removePathPreference: (index) => {
        console.log('🗑️ Zustand: Removing path preference at index:', index);
        set((state) => ({
          scanOptions: {
            ...state.scanOptions,
            pathPreferences: state.scanOptions.pathPreferences.filter((_, i) => i !== index)
          }
        }));
      }
    }),
    {
      name: 'rekordbox-settings', // localStorage key
      version: 1,
      onRehydrateStorage: () => (state) => {
        console.log('✅ Zustand: Settings rehydrated from localStorage:', state);
      }
    }
  )
);