import { contextBridge, ipcRenderer } from 'electron';
import type {
  TrackPayload, ScanOptionsPayload, ScanProgressPayload, DuplicateSet, MergePlanPayload,
  RelocationPayload, RelocateProgressPayload, FilterRulePayload, OperationProgress,
} from './ipcContract';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectRekordboxXML: () => ipcRenderer.invoke('select-rekordbox-xml'),
  checkFileAccessible: (path: string) => ipcRenderer.invoke('file-exists', path),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  parseRekordboxLibrary: (xmlPath: string) =>
    ipcRenderer.invoke('parse-rekordbox-library', xmlPath),
  findDuplicates: (options: ScanOptionsPayload) =>
    ipcRenderer.invoke('find-duplicates', options),
  detectRekordboxDb: () => ipcRenderer.invoke('detect-rekordbox-db'),
  scanForLibraries: () => ipcRenderer.invoke('scan-for-libraries'),
  isRekordboxRunning: () => ipcRenderer.invoke('is-rekordbox-running'),
  showSystemNotification: (data: { type: string; message: string }) =>
    ipcRenderer.invoke('show-system-notification', data),
  mergeDuplicatesInDb: (data: { dbPath: string; key: string; plans: MergePlanPayload[] }) =>
    ipcRenderer.invoke('merge-duplicates-in-db', data),
  findBrokenEntries: (args: { tracks: TrackPayload[]; includeMissing?: boolean }) =>
    ipcRenderer.invoke('find-broken-entries', args),
  removeEntriesInDb: (data: { dbPath: string; key: string; trackIds: string[] }) =>
    ipcRenderer.invoke('remove-entries-in-db', data),
  removeBrokenEntries: (data: { libraryPath: string; trackIds: string[] }) =>
    ipcRenderer.invoke('remove-broken-entries', data),
  listBackups: (libraryPath: string) => ipcRenderer.invoke('list-backups', libraryPath),
  restoreBackup: (args: { backupPath: string; libraryPath: string }) =>
    ipcRenderer.invoke('restore-backup', args),
  deleteBackup: (backupPath: string) => ipcRenderer.invoke('delete-backup', backupPath),
  parseRekordboxDb: (args: { dbPath: string; key: string }) =>
    ipcRenderer.invoke('parse-rekordbox-db', args),
  cancelDuplicateScan: (operationId: string) =>
    ipcRenderer.invoke('cancel-duplicate-scan', operationId),
  onDuplicateScanProgress: (callback: (progress: ScanProgressPayload) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: ScanProgressPayload) => callback(progress);
    ipcRenderer.on('duplicate-scan-progress', handler);
    return () => ipcRenderer.removeListener('duplicate-scan-progress', handler);
  },
  onDuplicateScanSet: (callback: (payload: { set: DuplicateSet }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: { set: DuplicateSet }) => callback(payload);
    ipcRenderer.on('duplicate-scan-set', handler);
    return () => ipcRenderer.removeListener('duplicate-scan-set', handler);
  },
  resolveDuplicates: (resolution: {
    libraryPath: string;
    duplicates: DuplicateSet[];
    strategy: string;
    pathPreferences?: string[];
    preferLossless?: boolean;
    deleteFromDisk?: boolean;
  }) =>
    ipcRenderer.invoke('resolve-duplicates', resolution),
  saveRekordboxXML: (data: { outputPath: string; libraryData: unknown }) =>
    ipcRenderer.invoke('save-rekordbox-xml', data),
  getLogsInfo: () => ipcRenderer.invoke('get-logs-info'),
  showFileInFolder: (filePath: string) =>
    ipcRenderer.invoke('show-file-in-folder', filePath),

  // Track Relocation APIs
  findMissingTracks: (tracks: Record<string, TrackPayload>) =>
    ipcRenderer.invoke('find-missing-tracks', tracks),
  resetTrackLocations: (trackIds: string[]) =>
    ipcRenderer.invoke('reset-track-locations', trackIds),
  autoRelocateTracks: (data: {
    tracks: TrackPayload[]; options: Record<string, unknown>; libraryPath: string; dbKey?: string;
  }) =>
    ipcRenderer.invoke('auto-relocate-tracks', data),
  cancelAutoRelocate: (operationId: string) =>
    ipcRenderer.invoke('cancel-auto-relocate', operationId),
  onAutoRelocateProgress: (callback: (progress: RelocateProgressPayload) => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: RelocateProgressPayload) => callback(progress);
    ipcRenderer.on('auto-relocate-progress', handler);
    return () => {
      ipcRenderer.removeListener('auto-relocate-progress', handler);
    };
  },
  findRelocationCandidates: (track: TrackPayload, options: Record<string, unknown>) =>
    ipcRenderer.invoke('find-relocation-candidates', track, options),
  relocateTrack: (trackId: string, oldLocation: string, newLocation: string) =>
    ipcRenderer.invoke('relocate-track', trackId, oldLocation, newLocation),
  batchRelocateTracks: (data: {
    libraryPath: string; relocations: RelocationPayload[]; dbKey?: string;
  }) =>
    ipcRenderer.invoke('batch-relocate-tracks', data),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Open external URLs with validation
  openExternal: (url: string) => {
    // Validate URL scheme for security
    const allowedSchemes = /^https?:\/\//i;
    const mailtoScheme = /^mailto:/i;
    
    if (!allowedSchemes.test(url) && !mailtoScheme.test(url)) {
      return Promise.resolve({ success: false, error: 'Invalid URL scheme' });
    }
    
    return ipcRenderer.invoke('open-external', url);
  },

  // Event listeners for menu actions
  onShowAbout: (callback: () => void) => {
    ipcRenderer.on('show-about', callback);
    return () => ipcRenderer.removeListener('show-about', callback);
  },
  onShowTutorial: (callback: () => void) => {
    ipcRenderer.on('show-tutorial', callback);
    return () => ipcRenderer.removeListener('show-tutorial', callback);
  },

  // File operations
  saveDroppedFile: (data: { content: string, fileName: string }) =>
    ipcRenderer.invoke('save-dropped-file', data),
  openFileDialog: (options?: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('open-file-dialog', options),

  // Consolidate Library
  consolidatePreview: (data: { tracks: TrackPayload[]; destination: string }) =>
    ipcRenderer.invoke('consolidate-preview', data),
  consolidateLibrary: (data: {
    operationId: string; tracks: TrackPayload[]; libraryPath: string;
    options: Record<string, unknown>;
  }) =>
    ipcRenderer.invoke('consolidate-library', data),
  cancelConsolidate: (operationId: string) =>
    ipcRenderer.invoke('cancel-consolidate', operationId),
  onConsolidateProgress: (callback: (progress: OperationProgress) => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: OperationProgress) => callback(progress);
    ipcRenderer.on('consolidate-progress', handler);
    return () => { ipcRenderer.removeListener('consolidate-progress', handler); };
  },

  // Filter & Move/Copy
  filterPreview: (data: {
    tracks: TrackPayload[]; filters: FilterRulePayload[]; destination: string;
  }) =>
    ipcRenderer.invoke('filter-preview', data),
  filterLibrary: (data: {
    operationId: string; tracks: TrackPayload[]; libraryPath: string;
    filters: FilterRulePayload[]; options: Record<string, unknown>;
  }) =>
    ipcRenderer.invoke('filter-library', data),
  cancelFilter: (operationId: string) =>
    ipcRenderer.invoke('cancel-filter', operationId),
  onFilterProgress: (callback: (progress: OperationProgress) => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: OperationProgress) => callback(progress);
    ipcRenderer.on('filter-progress', handler);
    return () => { ipcRenderer.removeListener('filter-progress', handler); };
  },

  // Native drag-and-drop
  handleNativeDrop: (filePaths: string[]) => ipcRenderer.invoke('handle-native-drop', filePaths),
  onNativeFileDrop: (callback: (filePaths: string[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, filePaths: string[]) => callback(filePaths);
    ipcRenderer.on('native-file-dropped', handler);
    return () => ipcRenderer.removeListener('native-file-dropped', handler);
  }
});

export {};
