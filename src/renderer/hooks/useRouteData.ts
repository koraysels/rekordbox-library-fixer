import { useLiveQuery } from 'dexie-react-hooks';
import { duplicateStorage } from '../db/duplicatesDb';
import { relocationStorage } from '../db/relocationsDb';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Hook to fetch data based on current route
 * Uses Dexie's useLiveQuery for reactive data
 */
export function useRouteData(route: string, libraryPath?: string) {
  // Get settings from Zustand - currently unused, commented for performance
  // const settings = useSettingsStore();
  
  // Fetch cached duplicate results
  const duplicateResults = useLiveQuery(
    async () => {
      if (route === '/' && libraryPath) {
        return await duplicateStorage.getDuplicateResult(libraryPath);
      }
      return null;
    },
    [route, libraryPath]
  );
  
  // Fetch cached relocation results
  const relocationResults = useLiveQuery(
    async () => {
      if (route === '/relocate' && libraryPath) {
        return await relocationStorage.getRelocationResult(libraryPath);
      }
      return null;
    },
    [route, libraryPath]
  );
  
  // Return loading state and data
  return {
    isLoading: duplicateResults === undefined || relocationResults === undefined,
    duplicateResults,
    relocationResults
    // settings // Commented out for performance - currently unused
  };
}

/**
 * Hook to prefetch data for a route
 * Called on hover/focus for optimistic loading
 */
export function usePrefetchRouteData() {
  return {
    prefetchDuplicates: async (libraryPath: string) => {
      // Trigger Dexie query to warm cache
      await duplicateStorage.getDuplicateResult(libraryPath);
    },
    
    prefetchRelocations: async (libraryPath: string) => {
      // Trigger Dexie query to warm cache
      await relocationStorage.getRelocationResult(libraryPath);
    }
  };
}