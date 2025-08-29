declare global {
  interface Window {
    electronAPI: {
      openExternal(url: string): Promise<{ success: boolean; error?: string }>;
      onShowTutorial(cb: () => void): () => void;
      onShowAbout(cb: () => void): () => void;
      
      // Library operations
      selectRekordboxXML(): Promise<any>;
      selectFolder(): Promise<any>;
      parseRekordboxLibrary(xmlPath: string): Promise<any>;
      findDuplicates(options: any): Promise<any>;
      resolveDuplicates(resolution: any): Promise<any>;
      saveRekordboxXML(data: any): Promise<any>;
      getLogsInfo(): Promise<any>;
      showFileInFolder(filePath: string): Promise<any>;
      
      // Track relocation
      findMissingTracks(tracks: any): Promise<any>;
      resetTrackLocations(trackIds: string[]): Promise<any>;
      autoRelocateTracks(data: { tracks: any[], options: any, libraryPath: string }): Promise<any>;
      cancelAutoRelocate(operationId: string): Promise<any>;
      onAutoRelocateProgress(callback: (progress: any) => void): () => void;
      findRelocationCandidates(track: any, options: any): Promise<any>;
      relocateTrack(trackId: string, oldLocation: string, newLocation: string): Promise<any>;
      batchRelocateTracks(relocations: any[]): Promise<any>;
      
      // Cloud sync
      detectCloudSyncIssues(tracks: any): Promise<any>;
      fixCloudSyncIssue(issue: any): Promise<any>;
      batchFixCloudSyncIssues(issues: any[]): Promise<any>;
      initializeDropboxAPI(config: any): Promise<any>;
      
      // Track ownership
      detectOwnershipIssues(tracks: any, computers: any): Promise<any>;
      fixTrackOwnership(issue: any): Promise<any>;
      batchFixOwnership(issues: any[]): Promise<any>;
      updateLibraryOwnership(library: any, fixes: any[]): Promise<any>;
      
      // App info
      getAppVersion(): Promise<any>;
      
      // File operations
      saveDroppedFile(data: { content: string, fileName: string }): Promise<any>;
      openFileDialog(options?: any): Promise<any>;
      handleNativeDrop(filePaths: string[]): Promise<any>;
      onNativeFileDrop(callback: (filePaths: string[]) => void): () => void;
    };
  }
}

export {};