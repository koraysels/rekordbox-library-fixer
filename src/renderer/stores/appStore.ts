import { create } from 'zustand';

interface AppState {
  version: string;
  isVersionLoaded: boolean;
  loadVersion: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  version: '0.0.2', // Default fallback version
  isVersionLoaded: false,

  loadVersion: async () => {
    const state = get();

    // Only load version if not already loaded
    if (state.isVersionLoaded) {
      return;
    }

    try {
      const result = await window.electronAPI.getAppVersion();
      if (result && result.success && result.data && typeof result.data.version === 'string') {
        set({
          version: result.data.version,
          isVersionLoaded: true
        });
      } else {
        // Mark as loaded even if failed to avoid retry loops
        set({ isVersionLoaded: true });
      }
    } catch (error) {
      console.error('Failed to load app version:', error);
      // Mark as loaded even if failed to avoid retry loops
      set({ isVersionLoaded: true });
    }
  },
}));