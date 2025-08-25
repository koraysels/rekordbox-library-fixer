// Global types and interfaces

export type TabType = 'duplicates' | 'import' | 'relocate' | 'maintenance';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  type: NotificationType;
  message: string;
}

export interface LibraryData {
  tracks: Map<string, any>;
  playlists: any[];
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
    };
  }
}