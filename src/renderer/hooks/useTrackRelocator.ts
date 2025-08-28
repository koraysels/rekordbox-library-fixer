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

// Import the modular logger
import { rendererLogger as logger } from '../utils/logger';

// Helper function to get effective library path with consistent fallback logic
const getEffectiveLibraryPath = (libraryData: LibraryData | null, libraryPath?: string): string => {
  const effectivePath = libraryData?.libraryPath || libraryPath;
  if (!effectivePath) {
    throw new Error('Library path is not available. Please reload the library.');
  }
  return effectivePath;
};

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
  searchDepth: 8,
  matchThreshold: 0.7,
  includeSubdirectories: true,
  fileExtensions: ['.mp3', '.m4a', '.wav', '.flac', '.aiff', '.aif', '.ogg']
};

export function useTrackRelocator(
  libraryData: LibraryData | null,
  libraryPath: string,
  showNotification: (type: NotificationType, message: string) => void,
  setLibraryData: (data: LibraryData) => void,
  initialSearchOptions?: RelocationOptions
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
    searchOptions: initialSearchOptions || { ...defaultSearchOptions },
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

      // Debug logging for development
      logger.debug('🔍 executeRelocations - libraryData:', libraryData);
      logger.debug('🔍 executeRelocations - libraryData.libraryPath:', libraryData?.libraryPath);
      logger.debug('🔍 executeRelocations - libraryPath param:', libraryPath);
      
      const effectiveLibraryPath = getEffectiveLibraryPath(libraryData, libraryPath);
      
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
          
          logger.info(`🔄 Updated ${result.tracksUpdated} track locations in library data`);
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
        logger.debug(`🔍 History check: effectiveLibraryPath="${effectiveLibraryPath}", successCount=${successCount}`);
        
        if (effectiveLibraryPath && successCount > 0) {
          const successfulRelocations = result.data.filter((r: RelocationResult) => r.success);
          logger.info(`📝 Saving ${successfulRelocations.length} relocations to history`);
          
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
            logger.info(`✅ History saved: ${successfulRelocations.length} entries`);
          } catch (historyError) {
            console.error('❌ Failed to save relocation history:', historyError);
          }
        } else {
          logger.warn(`❌ No history saved - libraryPath: ${effectiveLibraryPath}, successCount: ${successCount}`);
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

  // Auto-relocate tracks with high confidence matches
  const autoRelocateTracks = useCallback(async (tracks: MissingTrack[]) => {
    if (tracks.length === 0) {
      showNotification('error', 'No tracks selected for auto-relocation');
      return;
    }

    if (state.searchOptions.searchPaths.length === 0) {
      showNotification('error', 'Please configure search paths first');
      return;
    }

    setState(prev => ({ ...prev, isRelocating: true }));

    try {
      const effectiveLibraryPath = getEffectiveLibraryPath(libraryData, libraryPath);

      const result = await window.electronAPI.autoRelocateTracks({
        tracks,
        options: state.searchOptions,
        libraryPath: effectiveLibraryPath
      });

      logger.debug('🔍 Auto-relocate result:', result);

      if (result.success) {
        const { results, xmlUpdated, tracksUpdated, backupPath } = result.data;
        
        // Get list of successfully relocated track IDs
        const successfulTrackIds = results
          .filter((r: any) => r.success)
          .map((r: any) => r.trackId);
          
        // Get list of failed track IDs to mark as unlocatable
        const failedTrackIds = results
          .filter((r: any) => !r.success)
          .map((r: any) => r.trackId);
        
        // Update the main library data with new track locations
        if (libraryData && xmlUpdated) {
          const updatedLibraryData = { ...libraryData };
          const updatedTracks = new Map(libraryData.tracks);
          
          // Update track locations in the library data
          results.forEach((relocation: any) => {
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
          
          logger.info(`🔄 Updated ${successfulTrackIds.length} track locations in library data`);
        }
        
        // Update state: remove successfully relocated tracks and mark failed tracks as unlocatable
        setState(prev => {
          const newRelocations = new Map(prev.relocations);
          successfulTrackIds.forEach((trackId: string) => {
            newRelocations.delete(trackId);
          });
          
          // Remove successfully relocated tracks from missing tracks list
          const filteredTracks = prev.missingTracks.filter(track => 
            !successfulTrackIds.includes(track.id)
          );
          
          // Mark failed tracks as unlocatable (keep them in the list but flag them)
          const newMissingTracks = filteredTracks.map(track => {
            if (failedTrackIds.includes(track.id)) {
              return { ...track, isUnlocatable: true };
            }
            return track;
          });
          
          return {
            ...prev,
            relocationResults: results,
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
          successfulTrackIds.forEach((trackId: string) => {
            newCache.delete(trackId);
          });
          return newCache;
        });
        
        const successCount = results.filter((r: any) => r.success).length;
        const failureCount = results.filter((r: any) => !r.success).length;
        
        // Save successful relocations to history
        if (effectiveLibraryPath && successCount > 0) {
          const successfulRelocations = results.filter((r: any) => r.success);
          logger.info(`📝 Saving ${successfulRelocations.length} auto-relocations to history`);
          
          try {
            for (const relocation of successfulRelocations) {
              const track = tracks.find(t => t.id === relocation.trackId);
              if (track) {
                await historyStorage.addRelocationEntry({
                  libraryPath: effectiveLibraryPath,
                  trackId: relocation.trackId,
                  trackName: relocation.trackName || track.name,
                  trackArtist: track.artist,
                  originalLocation: relocation.oldLocation,
                  newLocation: relocation.newLocation,
                  relocationMethod: 'auto' as const,
                  timestamp: new Date(),
                  xmlUpdated: xmlUpdated,
                  backupCreated: !!backupPath
                });
              }
            }
            // Notify history panel to auto-refresh
            historyEvents.notifyHistoryUpdate(effectiveLibraryPath);
            logger.info(`✅ Auto-relocation history saved: ${successfulRelocations.length} entries`);
          } catch (historyError) {
            console.error('❌ Failed to save auto-relocation history:', historyError);
          }
        }
        
        // Show notification with detailed results
        const xmlUpdateMessage = xmlUpdated 
          ? `\n📄 XML updated with ${tracksUpdated} track${tracksUpdated > 1 ? 's' : ''}\n💾 Backup created: ${backupPath?.split('/').pop()}`
          : '';
        
        const failureMessage = failureCount > 0 
          ? `\n⚠️ ${failureCount} track${failureCount > 1 ? 's' : ''} marked as unlocatable`
          : '';
        
        const notificationType = failureCount > 0 && successCount === 0 ? 'error' : 
                               failureCount > 0 ? 'info' : 'success';
        
        showNotification(notificationType, 
          `✅ Auto-relocated ${successCount}/${tracks.length} tracks${failureMessage}${xmlUpdateMessage}`
        );
      } else {
        setState(prev => ({ ...prev, isRelocating: false }));
        showNotification('error', `Auto-relocation failed: ${result.error}`);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isRelocating: false }));
      console.error('❌ Auto-relocate error:', error);
      showNotification('error', `Failed to auto-relocate tracks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [state.searchOptions, state.missingTracks, libraryData, libraryPath, showNotification, setLibraryData]);

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

  // Clear unlocatable status from tracks (allow retry)
  const clearUnlocatableStatus = useCallback((trackIds: string[]) => {
    setState(prev => ({
      ...prev,
      missingTracks: prev.missingTracks.map(track => {
        if (trackIds.includes(track.id)) {
          const { isUnlocatable, ...trackWithoutFlag } = track;
          return trackWithoutFlag as MissingTrack;
        }
        return track;
      })
    }));
    
    showNotification('info', `Cleared unlocatable status from ${trackIds.length} track${trackIds.length > 1 ? 's' : ''}`);
  }, [showNotification]);

  // Computed values
  const stats = useMemo(() => ({
    totalMissingTracks: state.missingTracks.length,
    unlocatableTracks: state.missingTracks.filter(track => track.isUnlocatable).length,
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
    autoRelocateTracks,
    detectCloudSyncIssues,
    fixCloudSyncIssues,
    initializeDropboxAPI,
    detectOwnershipIssues,
    fixOwnershipIssues,
    updateSearchOptions,
    clearResults,
    clearUnlocatableStatus,
    
    // Computed
    stats
  };
}
