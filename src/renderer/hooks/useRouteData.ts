import { useLiveQuery } from 'dexie-react-hooks';
import { duplicateStorage } from '../db/duplicatesDb';
import { relocationStorage } from '../db/relocationsDb';

/**
 * Hook to fetch data based on current route
 * Uses Dexie's useLiveQuery for reactive data
 */
export function useRouteData(route: string, libraryPath?: string) {
  const wantsDuplicates = route === '/' && !!libraryPath;
  const wantsRelocations = route === '/relocate' && !!libraryPath;

  // Each query depends only on whether ITS route is active. Keying on the raw
  // route made both queries re-run on every navigation, and a pending
  // useLiveQuery is `undefined` — which used to flip isLoading and replace the
  // page with a skeleton on every tab switch, re-reading the whole duplicate
  // cache even for tabs that never use it.
  const duplicateResults = useLiveQuery(
    async () => (wantsDuplicates ? await duplicateStorage.getDuplicateResult(libraryPath!) : null),
    [wantsDuplicates, libraryPath]
  );

  const relocationResults = useLiveQuery(
    async () => (wantsRelocations ? await relocationStorage.getRelocationResult(libraryPath!) : null),
    [wantsRelocations, libraryPath]
  );

  // Only the data this route actually needs may hold up rendering.
  const isLoading =
    (wantsDuplicates && duplicateResults === undefined) ||
    (wantsRelocations && relocationResults === undefined);

  return { isLoading, duplicateResults, relocationResults };
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