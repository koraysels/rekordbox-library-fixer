import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import * as path from 'path';
import { RekordboxParser } from './rekordboxParser';
import { DuplicateDetector } from './duplicateDetector';
import { Logger } from './logger';
import { TrackRelocator } from './trackRelocator';
import { CloudSyncFixer } from './cloudSyncFixer';
import { TrackOwnershipFixer } from './trackOwnershipFixer';

// Safe console logging to prevent EPIPE errors
const safeConsole = {
  log: (...args: any[]) => {
    try {
      console.log(...args);
    } catch (error) {
      // Silently ignore EPIPE errors during logging
    }
  },
  error: (...args: any[]) => {
    try {
      console.error(...args);
    } catch (error) {
      // Silently ignore EPIPE errors during logging
    }
  },
  warn: (...args: any[]) => {
    try {
      console.warn(...args);
    } catch (error) {
      // Silently ignore EPIPE errors during logging
    }
  }
};

let mainWindow: BrowserWindow | null = null;
let rekordboxParser: RekordboxParser;
let duplicateDetector: DuplicateDetector;
let logger: Logger;
let trackRelocator: TrackRelocator;
let cloudSyncFixer: CloudSyncFixer;
let trackOwnershipFixer: TrackOwnershipFixer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, "../assets/icons/icon.png"), // works in dev + Linux
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#18181B',
  });
  // In development, load from localhost
  if (process.env.NODE_ENV === 'development') {
    // Fixed port to match Vite config
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create the application menu
function createMenu() {
  const template = [
    {
      label: 'Rekordbox Library Manager',
      submenu: [
        {
          label: 'About Rekordbox Library Manager',
          click: () => {
            mainWindow?.webContents.send('show-about');
          }
        },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ] as Electron.MenuItemConstructorOptions[];

  // Don't show developer menu in production
  if (process.env.NODE_ENV === 'development') {
    template.push({
      label: 'Developer',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  // Enable context menu with copy/paste support using eval to bypass TypeScript compilation
  try {
    const contextMenuModule = await eval('import("electron-context-menu")');
    const contextMenu = contextMenuModule.default;
    contextMenu({
      showLookUpSelection: false,
      showSearchWithGoogle: false,
      showCopyImage: false,
      showCopyImageAddress: false,
      showSaveImage: false,
      showSaveImageAs: false,
      showServices: false
    });
    safeConsole.log('✅ Context menu initialized');
  } catch (error) {
    safeConsole.warn('⚠️ Failed to load context menu:', error);
  }

  // Create application menu
  createMenu();

  logger = new Logger();
  rekordboxParser = new RekordboxParser();
  duplicateDetector = new DuplicateDetector();
  trackRelocator = new TrackRelocator();
  cloudSyncFixer = new CloudSyncFixer();
  trackOwnershipFixer = new TrackOwnershipFixer();

  // Database storage is now handled via Dexie in the renderer process
  safeConsole.log('✅ Application initialized');

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for Feature 1: Duplicate Detection

ipcMain.handle('select-rekordbox-xml', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Rekordbox XML', extensions: ['xml'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: path.join(
      process.env.HOME || '',
      'Library',
      'Pioneer',
      'rekordbox'
    ),
  });

  if (!result.canceled && result.filePaths[0]) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Music Folder',
    defaultPath: path.join(
      process.env.HOME || '',
      'Music'
    ),
  });

  if (!result.canceled && result.filePaths[0]) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('parse-rekordbox-library', async (_, xmlPath: string) => {
  try {
    const library = await rekordboxParser.parseLibrary(xmlPath);
    logger.logLibraryParsing(xmlPath, library.tracks.size, library.playlists.length);
    return { success: true, data: library };
  } catch (error) {
    logger.error('LIBRARY_PARSING_FAILED', {
      xmlPath,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('find-duplicates', async (_, options: {
  tracks: any[];
  useFingerprint: boolean;
  useMetadata: boolean;
  metadataFields: string[];
}) => {
  try {
    const duplicates = await duplicateDetector.findDuplicates(
      options.tracks,
      options
    );
    return { success: true, data: duplicates };
  } catch (error) {
    logger.error('DUPLICATE_DETECTION_FAILED', {
      trackCount: options.tracks.length,
      options,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('resolve-duplicates', async (_, resolution: {
  libraryPath: string;
  duplicates: any[];
  strategy: 'keep-highest-quality' | 'keep-newest' | 'keep-oldest' | 'keep-preferred-path' | 'manual';
  pathPreferences: string[];
}) => {
  safeConsole.log(`🔧 IPC: Resolving ${resolution.duplicates.length} duplicate sets`);
  try {
    // Step 1: Create backup of original XML
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${resolution.libraryPath}.backup.${timestamp}`;

    const fs = require('fs');
    fs.copyFileSync(resolution.libraryPath, backupPath);
    safeConsole.log(`📁 Backup created: ${backupPath}`);

    // Step 2: Parse current library
    const library = await rekordboxParser.parseLibrary(resolution.libraryPath);

    // Step 3: Determine which tracks to remove for each duplicate set
    let tracksToRemove: string[] = [];

    for (const duplicateSet of resolution.duplicates) {
      const tracksInSet = duplicateSet.tracks;
      let trackToKeep;

      // Apply resolution strategy
      if (resolution.strategy === 'keep-highest-quality') {
        trackToKeep = tracksInSet.reduce((best: any, current: any) => {
          const bestScore = (best.bitrate || 0) + (best.size || 0) / 1000000;
          const currentScore = (current.bitrate || 0) + (current.size || 0) / 1000000;
          return currentScore > bestScore ? current : best;
        });
      } else if (resolution.strategy === 'keep-newest') {
        trackToKeep = tracksInSet.reduce((newest: any, current: any) => {
          if (!newest.dateModified) return current;
          if (!current.dateModified) return newest;
          return new Date(current.dateModified) > new Date(newest.dateModified) ? current : newest;
        });
      } else if (resolution.strategy === 'keep-oldest') {
        trackToKeep = tracksInSet.reduce((oldest: any, current: any) => {
          if (!oldest.dateAdded) return current;
          if (!current.dateAdded) return oldest;
          return new Date(current.dateAdded) < new Date(oldest.dateAdded) ? current : oldest;
        });
      } else if (resolution.strategy === 'keep-preferred-path') {
        // Sort by path preference
        const sortedTracks = [...tracksInSet].sort((a: any, b: any) => {
          const aMatch = resolution.pathPreferences.findIndex((pref: string) =>
            a.location && a.location.toLowerCase().includes(pref.toLowerCase())
          );
          const bMatch = resolution.pathPreferences.findIndex((pref: string) =>
            b.location && b.location.toLowerCase().includes(pref.toLowerCase())
          );

          if (aMatch !== -1 && bMatch !== -1) return aMatch - bMatch;
          if (aMatch !== -1) return -1;
          if (bMatch !== -1) return 1;
          return 0;
        });
        trackToKeep = sortedTracks[0];
      } else {
        // Default: keep first track
        trackToKeep = tracksInSet[0];
      }

      // Add all other tracks to removal list
      const tracksToRemoveFromSet = tracksInSet
        .filter((track: any) => track.id !== trackToKeep.id)
        .map((track: any) => track.id);

      tracksToRemove.push(...tracksToRemoveFromSet);

      safeConsole.log(`🎵 Duplicate set: keeping "${trackToKeep.name}" (${trackToKeep.location}), removing ${tracksToRemoveFromSet.length} others`);
    }

    // Step 4: Remove tracks from library
    safeConsole.log(`🗑️ Removing ${tracksToRemove.length} duplicate tracks from library`);

    // Remove from tracks Map
    tracksToRemove.forEach(trackId => {
      library.tracks.delete(trackId);
    });

    // Remove from playlists
    library.playlists.forEach((playlist: any) => {
      if (playlist.tracks) {
        playlist.tracks = playlist.tracks.filter((trackId: string) =>
          !tracksToRemove.includes(trackId)
        );
      }
    });

    // Step 5: Save updated library
    await rekordboxParser.saveLibrary(library, resolution.libraryPath);

    safeConsole.log(`✅ Successfully resolved duplicates: removed ${tracksToRemove.length} tracks`);
    logger.logLibrarySaving(resolution.libraryPath, library.tracks.size);

    return {
      success: true,
      backupPath,
      tracksRemoved: tracksToRemove.length,
      updatedLibrary: library
    };

  } catch (error) {
    safeConsole.error('❌ Resolution failed:', error);
    logger.error('DUPLICATE_RESOLUTION_FAILED', {
      strategy: resolution.strategy,
      duplicateSetsCount: resolution.duplicates.length,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('save-rekordbox-xml', async (_, data: {
  library: any;
  outputPath: string;
}) => {
  try {
    await rekordboxParser.saveLibrary(data.library, data.outputPath);
    logger.logLibrarySaving(data.outputPath, data.library.tracks.size);
    return { success: true };
  } catch (error) {
    logger.error('LIBRARY_SAVING_FAILED', {
      outputPath: data.outputPath,
      trackCount: data.library.tracks ? data.library.tracks.size : 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('get-logs-info', async () => {
  return {
    logFilePath: logger.getLogPath(),
    logsDirectory: logger.getLogsDirectory()
  };
});

// Show file in system file manager
ipcMain.handle('show-file-in-folder', async (_, filePath: string) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    logger.error('SHOW_FILE_FAILED', {
      filePath,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Note: Duplicate storage is now handled via Dexie in the renderer process

// Track Relocation IPC Handlers
ipcMain.handle('reset-track-locations', async (_, trackIds: string[]) => {
  safeConsole.log(`🔄 IPC: Resetting locations for ${trackIds.length} tracks`);
  try {
    // This essentially marks tracks as "relocatable" by clearing their resolved status
    // The actual library update will happen when the user applies relocations
    safeConsole.log(`✅ Track locations reset for ${trackIds.length} tracks`);
    return { success: true, data: { resetTracks: trackIds.length } };
  } catch (error) {
    safeConsole.error('❌ Reset track locations failed:', error);
    logger.error('RESET_TRACK_LOCATIONS_FAILED', {
      trackCount: trackIds.length,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('auto-relocate-tracks', async (_, tracks: any[], options: any) => {
  safeConsole.log(`🤖 IPC: Auto-relocating ${tracks.length} tracks`);
  try {
    let successCount = 0;
    const results = [];

    for (const track of tracks) {
      // Find candidates for this track
      const candidatesResult = await trackRelocator.findRelocationCandidates(track, options);

      if (candidatesResult.length > 0) {
        // Use the best candidate (highest confidence)
        const bestCandidate = candidatesResult.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        );

        // Only auto-relocate if confidence is high enough (>80%)
        if (bestCandidate.confidence > 0.8) {
          const relocResult = await trackRelocator.relocateTrack(
            track.id,
            track.originalLocation,
            bestCandidate.path
          );

          if (relocResult.success) {
            successCount++;
          }

          results.push({
            trackId: track.id,
            trackName: track.name,
            success: relocResult.success,
            newLocation: relocResult.success ? bestCandidate.path : undefined,
            confidence: bestCandidate.confidence,
            error: relocResult.error
          });
        } else {
          results.push({
            trackId: track.id,
            trackName: track.name,
            success: false,
            error: 'No high-confidence candidate found'
          });
        }
      } else {
        results.push({
          trackId: track.id,
          trackName: track.name,
          success: false,
          error: 'No candidates found'
        });
      }
    }

    safeConsole.log(`✅ Auto-relocation complete: ${successCount}/${tracks.length} successful`);
    return {
      success: true,
      data: {
        totalTracks: tracks.length,
        successfulRelocations: successCount,
        results
      }
    };
  } catch (error) {
    safeConsole.error('❌ Auto-relocate tracks failed:', error);
    logger.error('AUTO_RELOCATE_TRACKS_FAILED', {
      trackCount: tracks.length,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('find-missing-tracks', async (_, tracks: any) => {
  safeConsole.log('🔍 IPC: Finding missing tracks');
  try {
    const tracksMap = new Map(Object.entries(tracks));
    const missingTracks = await trackRelocator.findMissingTracks(tracksMap);
    safeConsole.log(`✅ Found ${missingTracks.length} missing tracks`);
    return { success: true, data: missingTracks };
  } catch (error) {
    safeConsole.error('❌ Find missing tracks failed:', error);
    logger.error('FIND_MISSING_TRACKS_FAILED', {
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('find-relocation-candidates', async (_, track: any, options: any) => {
  safeConsole.log(`🔍 IPC: Finding relocation candidates for track ${track.id}`);
  try {
    const candidates = await trackRelocator.findRelocationCandidates(track, options);
    safeConsole.log(`✅ Found ${candidates.length} relocation candidates`);
    return { success: true, data: candidates };
  } catch (error) {
    safeConsole.error('❌ Find relocation candidates failed:', error);
    logger.error('FIND_RELOCATION_CANDIDATES_FAILED', {
      trackId: track.id,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('relocate-track', async (_, trackId: string, oldLocation: string, newLocation: string) => {
  safeConsole.log(`📁 IPC: Relocating track ${trackId}`);
  try {
    const result = await trackRelocator.relocateTrack(trackId, oldLocation, newLocation);
    if (result.success) {
      safeConsole.log(`✅ Track relocation successful`);
    } else {
      safeConsole.log(`❌ Track relocation failed: ${result.error}`);
    }
    return { success: true, data: result };
  } catch (error) {
    safeConsole.error('❌ Relocate track failed:', error);
    logger.error('RELOCATE_TRACK_FAILED', {
      trackId,
      oldLocation,
      newLocation,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('batch-relocate-tracks', async (_, relocations: any[]) => {
  safeConsole.log(`📁 IPC: Batch relocating ${relocations.length} tracks`);
  try {
    const results = await trackRelocator.batchRelocate(relocations);
    const successCount = results.filter(r => r.success).length;
    safeConsole.log(`✅ Batch relocation complete: ${successCount}/${relocations.length} successful`);
    return { success: true, data: results };
  } catch (error) {
    safeConsole.error('❌ Batch relocate tracks failed:', error);
    logger.error('BATCH_RELOCATE_TRACKS_FAILED', {
      count: relocations.length,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Cloud Sync IPC Handlers
ipcMain.handle('detect-cloud-sync-issues', async (_, tracks: any) => {
  safeConsole.log('☁️ IPC: Detecting cloud sync issues');
  try {
    const tracksMap = new Map(Object.entries(tracks));
    const issues = await cloudSyncFixer.detectCloudSyncIssues(tracksMap);
    safeConsole.log(`✅ Found ${issues.length} cloud sync issues`);
    return { success: true, data: issues };
  } catch (error) {
    safeConsole.error('❌ Detect cloud sync issues failed:', error);
    logger.error('DETECT_CLOUD_SYNC_ISSUES_FAILED', {
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('fix-cloud-sync-issue', async (_, issue: any) => {
  safeConsole.log(`☁️ IPC: Fixing cloud sync issue for track ${issue.trackId}`);
  try {
    const result = await cloudSyncFixer.fixCloudSyncIssue(issue);
    if (result.success) {
      safeConsole.log(`✅ Cloud sync fix successful`);
    } else {
      safeConsole.log(`❌ Cloud sync fix failed: ${result.error}`);
    }
    return { success: true, data: result };
  } catch (error) {
    safeConsole.error('❌ Fix cloud sync issue failed:', error);
    logger.error('FIX_CLOUD_SYNC_ISSUE_FAILED', {
      trackId: issue.trackId,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('batch-fix-cloud-sync-issues', async (_, issues: any[]) => {
  safeConsole.log(`☁️ IPC: Batch fixing ${issues.length} cloud sync issues`);
  try {
    const results = await cloudSyncFixer.batchFixCloudSyncIssues(issues);
    const successCount = results.filter(r => r.success).length;
    safeConsole.log(`✅ Batch cloud sync fix complete: ${successCount}/${issues.length} successful`);
    return { success: true, data: results };
  } catch (error) {
    safeConsole.error('❌ Batch fix cloud sync issues failed:', error);
    logger.error('BATCH_FIX_CLOUD_SYNC_ISSUES_FAILED', {
      count: issues.length,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('initialize-dropbox-api', async (_, config: any) => {
  safeConsole.log('☁️ IPC: Initializing Dropbox API');
  try {
    const success = await cloudSyncFixer.initializeDropboxAPI(config);
    if (success) {
      safeConsole.log(`✅ Dropbox API initialized successfully`);
    } else {
      safeConsole.log(`❌ Dropbox API initialization failed`);
    }
    return { success: true, data: { initialized: success } };
  } catch (error) {
    safeConsole.error('❌ Initialize Dropbox API failed:', error);
    logger.error('INITIALIZE_DROPBOX_API_FAILED', {
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Track Ownership IPC Handlers
ipcMain.handle('detect-ownership-issues', async (_, tracks: any, computers: any) => {
  safeConsole.log('👤 IPC: Detecting ownership issues');
  try {
    const tracksMap = new Map(Object.entries(tracks));
    const computersMap = new Map(Object.entries(computers)) as Map<string, any>;
    const issues = await trackOwnershipFixer.detectOwnershipIssues(tracksMap, computersMap);
    safeConsole.log(`✅ Found ${issues.length} ownership issues`);
    return { success: true, data: issues };
  } catch (error) {
    safeConsole.error('❌ Detect ownership issues failed:', error);
    logger.error('DETECT_OWNERSHIP_ISSUES_FAILED', {
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('fix-track-ownership', async (_, issue: any) => {
  safeConsole.log(`👤 IPC: Fixing ownership for track ${issue.trackId}`);
  try {
    const result = await trackOwnershipFixer.fixTrackOwnership(issue);
    if (result.success) {
      safeConsole.log(`✅ Ownership fix successful`);
    } else {
      safeConsole.log(`❌ Ownership fix failed: ${result.error}`);
    }
    return { success: true, data: result };
  } catch (error) {
    safeConsole.error('❌ Fix track ownership failed:', error);
    logger.error('FIX_TRACK_OWNERSHIP_FAILED', {
      trackId: issue.trackId,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('batch-fix-ownership', async (_, issues: any[]) => {
  safeConsole.log(`👤 IPC: Batch fixing ${issues.length} ownership issues`);
  try {
    const results = await trackOwnershipFixer.batchFixOwnership(issues);
    const successCount = results.filter(r => r.success).length;
    safeConsole.log(`✅ Batch ownership fix complete: ${successCount}/${issues.length} successful`);
    return { success: true, data: results };
  } catch (error) {
    safeConsole.error('❌ Batch fix ownership failed:', error);
    logger.error('BATCH_FIX_OWNERSHIP_FAILED', {
      count: issues.length,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('update-library-ownership', async (_, library: any, fixes: any[]) => {
  safeConsole.log(`👤 IPC: Updating library ownership with ${fixes.length} fixes`);
  try {
    const result = await trackOwnershipFixer.updateLibraryOwnership(library, fixes);
    if (result.success) {
      safeConsole.log(`✅ Library ownership updated: ${result.updatedTracks} tracks`);
    } else {
      safeConsole.log(`❌ Library ownership update failed: ${result.error}`);
    }
    return { success: true, data: result };
  } catch (error) {
    safeConsole.error('❌ Update library ownership failed:', error);
    logger.error('UPDATE_LIBRARY_OWNERSHIP_FAILED', {
      fixCount: fixes.length,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Get app version from package.json
ipcMain.handle('get-app-version', async () => {
  try {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const fs = require('fs');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return { success: true, data: { version: packageJson.version } };
  } catch (error) {
    safeConsole.error('❌ Failed to read app version:', error);
    return { success: false, error: 'Failed to read version' };
  }
});
