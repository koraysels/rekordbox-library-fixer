import { useState, useCallback, useMemo } from 'react';
import type { 
  MissingTrack, 
  RelocationCandidate, 
  RelocationOptions, 
  RelocationResult,
  CloudSyncIssue,
  CloudSyncFix,
  OwnershipIssue,
  OwnershipFix,
  LibraryData,
  NotificationType
} from '../types';

interface UseTrackRelocatorState {
  // Missing tracks state
  missingTracks: MissingTrack[];
  isScanning: boolean;
  hasScanCompleted: boolean;
  
  // Relocation candidates state
  selectedTrack: MissingTrack | null;
  candidates: RelocationCandidate[];
  isFindingCandidates: boolean;
  
  // Relocation operations state
  relocations: Map<string, string>; // trackId -> newLocation
  isRelocating: boolean;
  relocationResults: RelocationResult[];
  
  // Cloud sync state
  cloudSyncIssues: CloudSyncIssue[];
  isDetectingCloudIssues: boolean;
  isFixingCloudIssues: boolean;
  cloudSyncResults: CloudSyncFix[];
  
  // Ownership issues state
  ownershipIssues: OwnershipIssue[];
  isDetectingOwnershipIssues: boolean;
  isFixingOwnershipIssues: boolean;
  ownershipResults: OwnershipFix[];
  
  // Configuration
  searchOptions: RelocationOptions;
  dropboxConnected: boolean;
}

const defaultSearchOptions: RelocationOptions = {
  searchPaths: [],
  searchDepth: 3,
  matchThreshold: 0.7,
  includeSubdirectories: true,
  fileExtensions: ['.mp3', '.m4a', '.wav', '.flac', '.aiff', '.aif', '.ogg']
};

export function useTrackRelocator(
  libraryData: LibraryData | null,
  showNotification: (type: NotificationType, message: string) => void
) {
  const [state, setState] = useState<UseTrackRelocatorState>({
    missingTracks: [],
    isScanning: false,
    hasScanCompleted: false,
    selectedTrack: null,
    candidates: [],
    isFindingCandidates: false,
    relocations: new Map(),
    isRelocating: false,
    relocationResults: [],
    cloudSyncIssues: [],
    isDetectingCloudIssues: false,
    isFixingCloudIssues: false,
    cloudSyncResults: [],
    ownershipIssues: [],
    isDetectingOwnershipIssues: false,
    isFixingOwnershipIssues: false,
    ownershipResults: [],
    searchOptions: { ...defaultSearchOptions },
    dropboxConnected: false
  });

  // Find missing tracks
  const scanForMissingTracks = useCallback(async () => {
    if (!libraryData) {
      showNotification('error', 'No library data available');
      return;
    }

    setState(prev => ({ ...prev, isScanning: true, hasScanCompleted: false }));

    try {
      const tracks = Object.fromEntries(libraryData.tracks.entries());
      const result = await window.electronAPI.findMissingTracks(tracks);

      if (result.success) {
        setState(prev => ({
          ...prev,
          missingTracks: result.data,
          isScanning: false,
          hasScanCompleted: true
        }));
        showNotification('success', `Found ${result.data.length} missing tracks`);
      } else {
        setState(prev => ({ ...prev, isScanning: false }));
        showNotification('error', `Failed to scan: ${result.error}`);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isScanning: false }));
      showNotification('error', 'Failed to scan for missing tracks');
    }
  }, [libraryData, showNotification]);

  // Find relocation candidates for a track
  const findRelocationCandidates = useCallback(async (track: MissingTrack) => {
    if (state.searchOptions.searchPaths.length === 0) {
      showNotification('error', 'Please configure search paths first');
      return;
    }

    setState(prev => ({
      ...prev,
      selectedTrack: track,
      isFindingCandidates: true,
      candidates: []
    }));

    try {
      const result = await window.electronAPI.findRelocationCandidates(track, state.searchOptions);

      if (result.success) {
        setState(prev => ({
          ...prev,
          candidates: result.data,
          isFindingCandidates: false
        }));
        showNotification('success', `Found ${result.data.length} potential matches`);
      } else {
        setState(prev => ({ ...prev, isFindingCandidates: false }));
        showNotification('error', `Failed to find candidates: ${result.error}`);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isFindingCandidates: false }));
      showNotification('error', 'Failed to find relocation candidates');
    }
  }, [state.searchOptions, showNotification]);

  // Add a relocation mapping
  const addRelocation = useCallback((trackId: string, newLocation: string) => {
    setState(prev => ({
      ...prev,
      relocations: new Map(prev.relocations).set(trackId, newLocation)
    }));
  }, []);

  // Remove a relocation mapping
  const removeRelocation = useCallback((trackId: string) => {
    setState(prev => {
      const newRelocations = new Map(prev.relocations);
      newRelocations.delete(trackId);
      return { ...prev, relocations: newRelocations };
    });
  }, []);

  // Execute relocations
  const executeRelocations = useCallback(async () => {
    if (state.relocations.size === 0) {
      showNotification('error', 'No relocations configured');
      return;
    }

    setState(prev => ({ ...prev, isRelocating: true }));

    try {
      const relocationsArray = Array.from(state.relocations.entries()).map(([trackId, newLocation]) => {
        const track = state.missingTracks.find(t => t.id === trackId);
        return {
          trackId,
          oldLocation: track?.originalLocation || '',
          newLocation
        };
      });

      const result = await window.electronAPI.batchRelocateTracks(relocationsArray);

      if (result.success) {
        setState(prev => ({
          ...prev,
          relocationResults: result.data,
          isRelocating: false
        }));
        
        const successCount = result.data.filter((r: RelocationResult) => r.success).length;
        showNotification('success', `Successfully relocated ${successCount}/${relocationsArray.length} tracks`);
      } else {
        setState(prev => ({ ...prev, isRelocating: false }));
        showNotification('error', `Relocation failed: ${result.error}`);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isRelocating: false }));
      showNotification('error', 'Failed to execute relocations');
    }
  }, [state.relocations, state.missingTracks, showNotification]);

  // Detect cloud sync issues
  const detectCloudSyncIssues = useCallback(async () => {
    if (!libraryData) {
      showNotification('error', 'No library data available');
      return;
    }

    setState(prev => ({ ...prev, isDetectingCloudIssues: true }));

    try {
      const tracks = Object.fromEntries(libraryData.tracks.entries());
      const result = await window.electronAPI.detectCloudSyncIssues(tracks);

      if (result.success) {
        setState(prev => ({
          ...prev,
          cloudSyncIssues: result.data,
          isDetectingCloudIssues: false
        }));
        showNotification('success', `Found ${result.data.length} cloud sync issues`);
      } else {
        setState(prev => ({ ...prev, isDetectingCloudIssues: false }));
        showNotification('error', `Failed to detect cloud issues: ${result.error}`);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isDetectingCloudIssues: false }));
      showNotification('error', 'Failed to detect cloud sync issues');
    }
  }, [libraryData, showNotification]);

  // Fix cloud sync issues
  const fixCloudSyncIssues = useCallback(async (issues: CloudSyncIssue[]) => {
    setState(prev => ({ ...prev, isFixingCloudIssues: true }));

    try {
      const result = await window.electronAPI.batchFixCloudSyncIssues(issues);

      if (result.success) {
        setState(prev => ({
          ...prev,
          cloudSyncResults: result.data,
          isFixingCloudIssues: false
        }));
        
        const successCount = result.data.filter((r: CloudSyncFix) => r.success).length;
        showNotification('success', `Fixed ${successCount}/${issues.length} cloud sync issues`);
      } else {
        setState(prev => ({ ...prev, isFixingCloudIssues: false }));
        showNotification('error', `Cloud sync fix failed: ${result.error}`);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isFixingCloudIssues: false }));
      showNotification('error', 'Failed to fix cloud sync issues');
    }
  }, [showNotification]);

  // Initialize Dropbox API
  const initializeDropboxAPI = useCallback(async (config: { accessToken: string }) => {
    try {
      const result = await window.electronAPI.initializeDropboxAPI(config);

      if (result.success && result.data.initialized) {
        setState(prev => ({ ...prev, dropboxConnected: true }));
        showNotification('success', 'Dropbox connected successfully');
      } else {
        showNotification('error', 'Failed to connect to Dropbox');
      }
    } catch (error) {
      showNotification('error', 'Failed to initialize Dropbox API');
    }
  }, [showNotification]);

  // Detect ownership issues
  const detectOwnershipIssues = useCallback(async () => {
    if (!libraryData) {
      showNotification('error', 'No library data available');
      return;
    }

    setState(prev => ({ ...prev, isDetectingOwnershipIssues: true }));

    try {
      const tracks = Object.fromEntries(libraryData.tracks.entries());
      const computers = {}; // TODO: Get computers data from library
      const result = await window.electronAPI.detectOwnershipIssues(tracks, computers);

      if (result.success) {
        setState(prev => ({
          ...prev,
          ownershipIssues: result.data,
          isDetectingOwnershipIssues: false
        }));
        showNotification('success', `Found ${result.data.length} ownership issues`);
      } else {
        setState(prev => ({ ...prev, isDetectingOwnershipIssues: false }));
        showNotification('error', `Failed to detect ownership issues: ${result.error}`);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isDetectingOwnershipIssues: false }));
      showNotification('error', 'Failed to detect ownership issues');
    }
  }, [libraryData, showNotification]);

  // Fix ownership issues
  const fixOwnershipIssues = useCallback(async (issues: OwnershipIssue[]) => {
    setState(prev => ({ ...prev, isFixingOwnershipIssues: true }));

    try {
      const result = await window.electronAPI.batchFixOwnership(issues);

      if (result.success) {
        setState(prev => ({
          ...prev,
          ownershipResults: result.data,
          isFixingOwnershipIssues: false
        }));
        
        const successCount = result.data.filter((r: OwnershipFix) => r.success).length;
        showNotification('success', `Fixed ${successCount}/${issues.length} ownership issues`);
      } else {
        setState(prev => ({ ...prev, isFixingOwnershipIssues: false }));
        showNotification('error', `Ownership fix failed: ${result.error}`);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isFixingOwnershipIssues: false }));
      showNotification('error', 'Failed to fix ownership issues');
    }
  }, [showNotification]);

  // Update search options
  const updateSearchOptions = useCallback((options: Partial<RelocationOptions>) => {
    setState(prev => ({
      ...prev,
      searchOptions: { ...prev.searchOptions, ...options }
    }));
  }, []);

  // Clear all results
  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      missingTracks: [],
      hasScanCompleted: false,
      selectedTrack: null,
      candidates: [],
      relocations: new Map(),
      relocationResults: [],
      cloudSyncIssues: [],
      cloudSyncResults: [],
      ownershipIssues: [],
      ownershipResults: []
    }));
  }, []);

  // Computed values
  const stats = useMemo(() => ({
    totalMissingTracks: state.missingTracks.length,
    configuredRelocations: state.relocations.size,
    successfulRelocations: state.relocationResults.filter(r => r.success).length,
    cloudSyncIssues: state.cloudSyncIssues.length,
    ownershipIssues: state.ownershipIssues.length,
    hasSearchPaths: state.searchOptions.searchPaths.length > 0
  }), [state.missingTracks, state.relocations, state.relocationResults, state.cloudSyncIssues, state.ownershipIssues, state.searchOptions]);

  return {
    // State
    ...state,
    
    // Actions
    scanForMissingTracks,
    findRelocationCandidates,
    addRelocation,
    removeRelocation,
    executeRelocations,
    detectCloudSyncIssues,
    fixCloudSyncIssues,
    initializeDropboxAPI,
    detectOwnershipIssues,
    fixOwnershipIssues,
    updateSearchOptions,
    clearResults,
    
    // Computed
    stats
  };
}