import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/duplicatesDb';
import { relocationsDb } from '../db/relocationsDb';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Hook to fetch data based on current route
 * Uses Dexie's useLiveQuery for reactive data
 */
export function useRouteData(route: string, libraryPath?: string) {
  // Get settings from Zustand
  const settings = useSettingsStore();
  
  // Fetch cached duplicate results
  const duplicateResults = useLiveQuery(
    async () => {
      if (route === '/' && libraryPath) {
        return await db.getDuplicateResult(libraryPath);
      }
      return null;
    },
    [route, libraryPath]
  );
  
  // Fetch cached relocation results
  const relocationResults = useLiveQuery(
    async () => {
      if (route === '/relocate' && libraryPath) {
        const result = await relocationsDb.relocationResults
          .where('libraryPath')
          .equals(libraryPath)
          .first();
        
        if (result) {
          // Convert arrays back to Maps
          return {
            ...result,
            relocationCandidates: new Map(result.relocationCandidates as any),
            relocations: new Map(result.relocations as any)
          };
        }
      }
      return null;
    },
    [route, libraryPath]
  );
  
  // Return loading state and data
  return {
    isLoading: duplicateResults === undefined || relocationResults === undefined,
    duplicateResults,
    relocationResults,
    settings
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
      await db.getDuplicateResult(libraryPath);
    },
    
    prefetchRelocations: async (libraryPath: string) => {
      // Trigger Dexie query to warm cache
      await relocationsDb.relocationResults
        .where('libraryPath')
        .equals(libraryPath)
        .first();
    }
  };
}