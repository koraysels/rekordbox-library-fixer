// Global types and interfaces

export type TabType = 'duplicates' | 'import' | 'relocate' | 'maintenance';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  type: NotificationType;
  message: string;
}

export interface Playlist {
  name: string;
  tracks: string[]; // Track IDs
  type: 'FOLDER' | 'PLAYLIST';
  children?: Playlist[];
}

export interface LibraryData {
  tracks: Map<string, any>;
  playlists: Playlist[];
}

export interface DuplicateItem {
  id: string;
  tracks: Track[];
  matchType: string;
  confidence: number;
  pathPreferences?: string[];
}

export interface Track {
  id: string;
  name: string;
  artist: string;
  album?: string;
  location: string;
  duration?: number;
  bitrate?: number;
  size?: number;
  dateAdded?: string;
  dateModified?: string;
  rating?: number;
  cues?: any[];
  loops?: any[];
}

export interface ScanOptions {
  useFingerprint: boolean;
  useMetadata: boolean;
  metadataFields: string[];
  pathPreferences: string[];
}

export type ResolutionStrategy = 
  | 'keep-highest-quality' 
  | 'keep-newest' 
  | 'keep-oldest' 
  | 'keep-preferred-path' 
  | 'manual';

// Track Relocation types
export interface MissingTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  originalLocation: string;
  size?: number;
  duration?: number;
  dateAdded?: string;
}

export interface RelocationCandidate {
  path: string;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'metadata' | 'size';
  confidence: number;
}

export interface RelocationOptions {
  searchPaths: string[];
  searchDepth: number;
  matchThreshold: number;
  includeSubdirectories: boolean;
  fileExtensions: string[];
}

export interface RelocationResult {
  trackId: string;
  oldLocation: string;
  newLocation?: string;
  success: boolean;
  candidates?: RelocationCandidate[];
  error?: string;
}

// Cloud Sync types
export interface CloudSyncIssue {
  trackId: string;
  trackName: string;
  originalLocation: string;
  issueType: 'online-only' | 'path-mismatch' | 'missing-local' | 'sync-conflict';
  cloudPath?: string;
  localPath?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CloudSyncFix {
  trackId: string;
  originalLocation: string;
  fixedLocation?: string;
  success: boolean;
  action: 'download' | 'path-update' | 'local-copy' | 'manual-required';
  error?: string;
}

// Track Ownership types
export interface OwnershipIssue {
  trackId: string;
  trackName: string;
  trackLocation: string;
  currentOwner?: string;
  expectedOwner?: string;
  issueType: 'grey-track' | 'wrong-owner' | 'missing-owner';
  severity: 'low' | 'medium' | 'high';
}

export interface OwnershipFix {
  trackId: string;
  originalOwner?: string;
  newOwner: string;
  success: boolean;
  action: 'ownership-transfer' | 'owner-assignment' | 'uuid-update';
  error?: string;
}

// Electron API types
declare global {
  interface Window {
    electronAPI: {
      selectRekordboxXML: () => Promise<string | null>;
      parseRekordboxLibrary: (xmlPath: string) => Promise<any>;
      findDuplicates: (options: any) => Promise<any>;
      resolveDuplicates: (resolution: any) => Promise<any>;
      saveRekordboxXML: (data: any) => Promise<any>;
      showFileInFolder: (filePath: string) => Promise<any>;
      saveDuplicateResults: (data: any) => Promise<any>;
      getDuplicateResults: (libraryPath: string) => Promise<any>;
      deleteDuplicateResults: (libraryPath: string) => Promise<any>;
      // Track Relocation APIs
      findMissingTracks: (tracks: any) => Promise<any>;
      resetTrackLocations: (trackIds: string[]) => Promise<any>;
      autoRelocateTracks: (tracks: any[], options: any) => Promise<any>;
      findRelocationCandidates: (track: MissingTrack, options: RelocationOptions) => Promise<any>;
      relocateTrack: (trackId: string, oldLocation: string, newLocation: string) => Promise<any>;
      batchRelocateTracks: (relocations: any[]) => Promise<any>;
      // Cloud Sync APIs
      detectCloudSyncIssues: (tracks: any) => Promise<any>;
      fixCloudSyncIssue: (issue: CloudSyncIssue) => Promise<any>;
      batchFixCloudSyncIssues: (issues: CloudSyncIssue[]) => Promise<any>;
      initializeDropboxAPI: (config: any) => Promise<any>;
      // Track Ownership APIs
      detectOwnershipIssues: (tracks: any, computers: any) => Promise<any>;
      fixTrackOwnership: (issue: OwnershipIssue) => Promise<any>;
      batchFixOwnership: (issues: OwnershipIssue[]) => Promise<any>;
      updateLibraryOwnership: (library: any, fixes: OwnershipFix[]) => Promise<any>;
    };
  }
}