import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectRekordboxXML: () => ipcRenderer.invoke('select-rekordbox-xml'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  parseRekordboxLibrary: (xmlPath: string) =>
    ipcRenderer.invoke('parse-rekordbox-library', xmlPath),
  findDuplicates: (options: any) =>
    ipcRenderer.invoke('find-duplicates', options),
  resolveDuplicates: (resolution: any) =>
    ipcRenderer.invoke('resolve-duplicates', resolution),
  saveRekordboxXML: (data: any) =>
    ipcRenderer.invoke('save-rekordbox-xml', data),
  getLogsInfo: () => ipcRenderer.invoke('get-logs-info'),
  showFileInFolder: (filePath: string) =>
    ipcRenderer.invoke('show-file-in-folder', filePath),

  // Track Relocation APIs
  findMissingTracks: (tracks: any) =>
    ipcRenderer.invoke('find-missing-tracks', tracks),
  resetTrackLocations: (trackIds: string[]) =>
    ipcRenderer.invoke('reset-track-locations', trackIds),
  autoRelocateTracks: (data: { tracks: any[], options: any, libraryPath: string }) =>
    ipcRenderer.invoke('auto-relocate-tracks', data),
  cancelAutoRelocate: (operationId: string) =>
    ipcRenderer.invoke('cancel-auto-relocate', operationId),
  onAutoRelocateProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('auto-relocate-progress', (_, progress) => callback(progress));
    return () => {
      ipcRenderer.removeAllListeners('auto-relocate-progress');
    };
  },
  findRelocationCandidates: (track: any, options: any) =>
    ipcRenderer.invoke('find-relocation-candidates', track, options),
  relocateTrack: (trackId: string, oldLocation: string, newLocation: string) =>
    ipcRenderer.invoke('relocate-track', trackId, oldLocation, newLocation),
  batchRelocateTracks: (relocations: any[]) =>
    ipcRenderer.invoke('batch-relocate-tracks', relocations),

  // Cloud Sync APIs
  detectCloudSyncIssues: (tracks: any) =>
    ipcRenderer.invoke('detect-cloud-sync-issues', tracks),
  fixCloudSyncIssue: (issue: any) =>
    ipcRenderer.invoke('fix-cloud-sync-issue', issue),
  batchFixCloudSyncIssues: (issues: any[]) =>
    ipcRenderer.invoke('batch-fix-cloud-sync-issues', issues),
  initializeDropboxAPI: (config: any) =>
    ipcRenderer.invoke('initialize-dropbox-api', config),

  // Track Ownership APIs
  detectOwnershipIssues: (tracks: any, computers: any) =>
    ipcRenderer.invoke('detect-ownership-issues', tracks, computers),
  fixTrackOwnership: (issue: any) =>
    ipcRenderer.invoke('fix-track-ownership', issue),
  batchFixOwnership: (issues: any[]) =>
    ipcRenderer.invoke('batch-fix-ownership', issues),
  updateLibraryOwnership: (library: any, fixes: any[]) =>
    ipcRenderer.invoke('update-library-ownership', library, fixes),

  // Get app version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Open external URLs
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

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
  openFileDialog: (options?: any) => ipcRenderer.invoke('open-file-dialog', options),

  // Native drag-and-drop
  handleNativeDrop: (filePaths: string[]) => ipcRenderer.invoke('handle-native-drop', filePaths),
  onNativeFileDrop: (callback: (filePaths: string[]) => void) => {
    const handler = (_: any, filePaths: string[]) => callback(filePaths);
    ipcRenderer.on('native-file-dropped', handler);
    return () => ipcRenderer.removeListener('native-file-dropped', handler);
  }
});

export {};
