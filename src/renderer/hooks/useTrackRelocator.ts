import { useState, useCallback, useMemo, useEffect } from 'react';
import { relocationStorage, cloudSyncStorage, ownershipStorage } from '../db/relocationsDb';
import { historyStorage } from '../db/historyDb';
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
  libraryPath: string,
  showNotification: (type: NotificationType, message: string) => void,
  setLibraryData: (data: LibraryData) => void
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
  
  const [relocationCandidatesCache, setRelocationCandidatesCache] = useState<Map<string, RelocationCandidate[]>>(new Map());

  // Load cached results when library data changes
  useEffect(() => {
    if (!libraryData?.libraryPath) return;
    
    const loadCachedResults = async () => {
      try {
        // Load relocation results
        const relocationResult = await relocationStorage.getRelocationResult(libraryData.libraryPath);
        if (relocationResult) {
          setState(prev => ({
            ...prev,
            missingTracks: relocationResult.missingTracks || [],
            relocations: relocationResult.relocations || new Map(),
            relocationResults: relocationResult.relocationResults || [],
            searchOptions: relocationResult.searchOptions || { ...defaultSearchOptions },
            hasScanCompleted: relocationResult.hasScanCompleted || false
          }));
          setRelocationCandidatesCache(relocationResult.relocationCandidates || new Map());
        }
        
        // Load cloud sync results
        const cloudResult = await cloudSyncStorage.getCloudSyncResult(libraryData.libraryPath);
        if (cloudResult) {
          setState(prev => ({
            ...prev,
            cloudSyncIssues: cloudResult.issues || [],
            cloudSyncResults: cloudResult.fixes || []
          }));
        }
        
        // Load ownership results
        const ownershipResult = await ownershipStorage.getOwnershipResult(libraryData.libraryPath);
        if (ownershipResult) {
          setState(prev => ({
            ...prev,
            ownershipIssues: ownershipResult.issues || [],
            ownershipResults: ownershipResult.fixes || []
          }));
        }
      } catch (error) {
        console.error('Failed to load cached results:', error);
      }
    };
    
    loadCachedResults();
  }, [libraryData?.libraryPath]);

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
        
        // Save to cache
        if (libraryData?.libraryPath) {
          try {
            await relocationStorage.saveRelocationResult({
              libraryPath: libraryData.libraryPath,
              missingTracks: result.data,
              relocationCandidates: relocationCandidatesCache,
              relocations: state.relocations,
              relocationResults: state.relocationResults,
              searchOptions: state.searchOptions,
              hasScanCompleted: true
            });
          } catch (cacheError) {
            console.error('Failed to cache scan results:', cacheError);
          }
        }
        
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

    // Check cache first
    const cachedCandidates = relocationCandidatesCache.get(track.id);
    if (cachedCandidates) {
      setState(prev => ({
        ...prev,
        selectedTrack: track,
        candidates: cachedCandidates,
        isFindingCandidates: false
      }));
      showNotification('info', `Loaded ${cachedCandidates.length} cached candidates`);
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
        // Cache the candidates
        const newCandidatesCache = new Map(relocationCandidatesCache);
        newCandidatesCache.set(track.id, result.data);
        setRelocationCandidatesCache(newCandidatesCache);
        
        // Save to database
        if (libraryData?.libraryPath) {
          try {
            await relocationStorage.saveRelocationResult({
              libraryPath: libraryData.libraryPath,
              missingTracks: state.missingTracks,
              relocationCandidates: newCandidatesCache,
              relocations: state.relocations,
              relocationResults: state.relocationResults,
              searchOptions: state.searchOptions,
              hasScanCompleted: state.hasScanCompleted
            });
          } catch (cacheError) {
            console.error('Failed to cache candidates:', cacheError);
          }
        }
        
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
  }, [state.searchOptions, state.missingTracks, state.relocations, state.relocationResults, state.hasScanCompleted, relocationCandidatesCache, libraryData?.libraryPath, showNotification]);

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

      // Debug logging to understand the issue
      console.log('🔍 executeRelocations - libraryData:', libraryData);
      console.log('🔍 executeRelocations - libraryData.libraryPath:', libraryData?.libraryPath);
      console.log('🔍 executeRelocations - libraryPath param:', libraryPath);
      
      // Use libraryPath from libraryData if available, otherwise use the separate libraryPath parameter
      const effectiveLibraryPath = libraryData?.libraryPath || libraryPath;
      
      if (!effectiveLibraryPath) {
        throw new Error('Library path is not available. Please reload the library.');
      }
      
      const result = await window.electronAPI.batchRelocateTracks({
        libraryPath: effectiveLibraryPath,
        relocations: relocationsArray
      });

      if (result.success) {
        // Get list of successfully relocated track IDs
        const successfulTrackIds = result.data
          .filter((r: RelocationResult) => r.success)
          .map((r: RelocationResult) => r.trackId);
        
        // Update the main library data with new track locations
        if (libraryData && result.xmlUpdated) {
          const updatedLibraryData = { ...libraryData };
          const updatedTracks = new Map(libraryData.tracks);
          
          // Update track locations in the library data
          result.data.forEach((relocation: RelocationResult) => {
            if (relocation.success && relocation.newLocation) {
              const track = updatedTracks.get(relocation.trackId);
              if (track) {
                updatedTracks.set(relocation.trackId, {
                  ...track,
                  location: relocation.newLocation
                });
              }
            }
          });
          
          updatedLibraryData.tracks = updatedTracks;
          setLibraryData(updatedLibraryData);
          
          console.log(`🔄 Updated ${result.tracksUpdated} track locations in library data`);
        }
        
        // Update state to remove successfully relocated tracks from missing tracks list
        // and clear their relocations from the map
        setState(prev => {
          const newRelocations = new Map(prev.relocations);
          successfulTrackIds.forEach(trackId => {
            newRelocations.delete(trackId);
          });
          
          const newMissingTracks = prev.missingTracks.filter(track => 
            !successfulTrackIds.includes(track.id)
          );
          
          return {
            ...prev,
            relocationResults: result.data,
            missingTracks: newMissingTracks,
            relocations: newRelocations,
            selectedTrack: successfulTrackIds.includes(prev.selectedTrack?.id || '') ? null : prev.selectedTrack,
            candidates: successfulTrackIds.includes(prev.selectedTrack?.id || '') ? [] : prev.candidates,
            isRelocating: false
          };
        });
        
        // Update candidates cache to remove relocated tracks
        setRelocationCandidatesCache(prev => {
          const newCache = new Map(prev);
          successfulTrackIds.forEach(trackId => {
            newCache.delete(trackId);
          });
          return newCache;
        });
        
        const successCount = result.data.filter((r: RelocationResult) => r.success).length;
        
        // Save successful relocations to history
        console.log(`🔍 History check: effectiveLibraryPath="${effectiveLibraryPath}", successCount=${successCount}`);
        
        if (effectiveLibraryPath && successCount > 0) {
          const successfulRelocations = result.data.filter((r: RelocationResult) => r.success);
          console.log(`📝 Saving ${successfulRelocations.length} relocations to history`);
          
          try {
            for (const relocation of successfulRelocations) {
              const track = state.missingTracks.find(t => t.id === relocation.trackId);
              if (track) {
                await historyStorage.addRelocationEntry({
                  libraryPath: effectiveLibraryPath,
                  trackId: relocation.trackId,
                  trackName: track.name,
                  trackArtist: track.artist,
                  originalLocation: relocation.oldLocation,
                  newLocation: relocation.newLocation,
                  relocationMethod: 'manual' as const,
                  timestamp: new Date(),
                  xmlUpdated: result.xmlUpdated,
                  backupCreated: !!result.backupPath
                });
              }
            }
            console.log(`✅ History saved: ${successfulRelocations.length} entries`);
          } catch (historyError) {
            console.error('❌ Failed to save relocation history:', historyError);
          }
        } else {
          console.log(`❌ No history saved - libraryPath: ${effectiveLibraryPath}, successCount: ${successCount}`);
        }
        
        // Show success notification with XML update info
        const xmlUpdateMessage = result.xmlUpdated 
          ? `\n📄 XML updated with ${result.tracksUpdated} track${result.tracksUpdated > 1 ? 's' : ''}\n💾 Backup created: ${result.backupPath?.split('/').pop()}`
          : '';
        
        showNotification('success', 
          `✅ Successfully relocated ${successCount}/${relocationsArray.length} tracks${xmlUpdateMessage}`
        );
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
        
        // Save to cache
        if (libraryData?.libraryPath) {
          try {
            await cloudSyncStorage.saveCloudSyncResult({
              libraryPath: libraryData.libraryPath,
              issues: result.data,
              fixes: state.cloudSyncResults
            });
          } catch (cacheError) {
            console.error('Failed to cache cloud sync issues:', cacheError);
          }
        }
        
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
        
        // Save to cache
        if (libraryData?.libraryPath) {
          try {
            await ownershipStorage.saveOwnershipResult({
              libraryPath: libraryData.libraryPath,
              issues: result.data,
              fixes: state.ownershipResults
            });
          } catch (cacheError) {
            console.error('Failed to cache ownership issues:', cacheError);
          }
        }
        
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
  const clearResults = useCallback(async () => {
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
    
    setRelocationCandidatesCache(new Map());
    
    // Clear cache from database
    if (libraryData?.libraryPath) {
      try {
        await relocationStorage.deleteRelocationResult(libraryData.libraryPath);
        await cloudSyncStorage.deleteCloudSyncResult(libraryData.libraryPath);
        await ownershipStorage.deleteOwnershipResult(libraryData.libraryPath);
      } catch (error) {
        console.error('Failed to clear cached results:', error);
      }
    }
  }, [libraryData?.libraryPath]);

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