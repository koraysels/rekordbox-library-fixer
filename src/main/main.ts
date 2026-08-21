import * as path from 'path';
import { app, BrowserWindow, ipcMain, dialog, shell, Menu, protocol, net } from 'electron';
import { pathToFileURL } from 'url';
import { mediaUrlToFilePath, isAllowedMediaPath } from './mediaProtocol';
import { RekordboxParser } from './rekordboxParser';
import { DuplicateDetector } from './duplicateDetector';
import { substitutePlaylistTrackIds } from './playlistSubstitution';
import { computeDeletablePaths } from './safeDeletePaths';
import { Logger } from './logger';
import { TrackRelocator } from './trackRelocator';
import { isLossless } from './audioQuality';
import { LibraryConsolidator } from './libraryConsolidator';
import { CloudSyncFixer } from './cloudSyncFixer';
import { TrackOwnershipFixer } from './trackOwnershipFixer';
import { mainLogger as appLogger } from './appLogger';

// Must run before app ready — grants media:// streaming + fetch privileges.
// corsEnabled is required for renderer fetch() (the AIFF rewrap path); without
// it Chromium refuses cross-origin fetches to the custom scheme entirely.
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { stream: true, supportFetchAPI: true, corsEnabled: true } }
]);

const libraryConsolidator = new LibraryConsolidator();

// Safe console logging to prevent EPIPE errors
const safeConsole = {
  log: (...args: any[]) => {
    try {
      console.log(...args);
    } catch {
      // Silently ignore EPIPE errors during logging
    }
  },
  error: (...args: any[]) => {
    try {
      console.error(...args);
    } catch {
      // Silently ignore EPIPE errors during logging
    }
  },
  warn: (...args: any[]) => {
    try {
      console.warn(...args);
    } catch {
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
    icon: path.join(__dirname, '../assets/icons/icon.png'), // works in dev + Linux
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

  // Handle navigation for security
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
    }
  });

  // Enable native drag-and-drop handling in main process
  mainWindow.webContents.on('dom-ready', () => {
    // Override the default file drag behavior to capture native paths
    mainWindow?.webContents.executeJavaScript(`
      // Remove any existing listeners
      document.removeEventListener('dragover', window.__electronDragOver);
      document.removeEventListener('drop', window.__electronDrop);
      
      // Add new listeners that capture native file paths
      window.__electronDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      
      window.__electronDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const files = Array.from(e.dataTransfer.files);
        console.log('Native drop detected, files:', files.length);
        
        // Extract native file paths
        const filePaths = files.map(file => {
          console.log('File object:', {
            name: file.name,
            path: file.path,
            size: file.size,
            type: file.type
          });
          return file.path;
        }).filter(path => path && path.length > 0);
        
        if (filePaths.length > 0) {
          console.log('Sending native paths to main process:', filePaths);
          window.electronAPI?.handleNativeDrop?.(filePaths);
        }
      };
      
      document.addEventListener('dragover', window.__electronDragOver);
      document.addEventListener('drop', window.__electronDrop);
      
      console.log('✅ Native drag-and-drop handlers installed');
    `);
  });
}

// Create the application menu
function createMenu() {
  const template = [
    {
      label: 'Rekordbox Library Fixer',
      submenu: [
        {
          label: 'About Rekordbox Library Fixer',
          click: () => {
            mainWindow?.webContents.send('show-about');
          }
        },
        {
          label: 'XML Export & Import Tutorial',
          click: () => {
            mainWindow?.webContents.send('show-tutorial');
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
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { role: 'delete' }
      ]
    },
    {
      label: 'View',
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
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Log File',
          click: () => {
            const logPath = logger.getLogPath();
            shell.openPath(logPath).catch(err => {
              appLogger.error('Failed to open log file:', err);
            });
          }
        },
        {
          label: 'Open Logs Directory',
          click: () => {
            const logsDir = logger.getLogsDirectory();
            shell.openPath(logsDir).catch(err => {
              appLogger.error('Failed to open logs directory:', err);
            });
          }
        },
        { type: 'separator' },
        {
          label: 'XML Export & Import Tutorial',
          click: () => {
            mainWindow?.webContents.send('show-tutorial');
          }
        },
        { type: 'separator' },
        {
          label: 'About Rekordbox Library Fixer',
          click: () => {
            mainWindow?.webContents.send('show-about');
          }
        }
      ]
    }
  ] as Electron.MenuItemConstructorOptions[];

  // Add developer menu in development only
  if (process.env.NODE_ENV === 'development') {
    // Find View menu and add separator + dev tools if not already there
    const viewMenu = template.find(menu => menu.label === 'View');
    if (viewMenu && viewMenu.submenu && Array.isArray(viewMenu.submenu)) {
      // Dev tools already added above in View menu for consistency
    }
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  protocol.handle('media', async (request) => {
    try {
      const filePath = mediaUrlToFilePath(request.url);
      if (!isAllowedMediaPath(filePath)) {
        return new Response('Forbidden', { status: 403 });
      }
      const res = await net.fetch(pathToFileURL(filePath).toString(), { headers: request.headers });
      // CORS-enabled scheme: renderer fetch() needs an explicit allow header
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    } catch {
      return new Response('Bad media URL', { status: 400 });
    }
  });

  // Enable context menu with copy/paste support using eval to bypass TypeScript compilation
  try {
    // electron-context-menu is ESM-only; TypeScript compiles import() to require()
    // in CommonJS mode, so we use Function to get a real dynamic ESM import.
    const esmImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    const contextMenuModule = await esmImport('electron-context-menu');
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

// File reachability check — used by startup auto-load
ipcMain.handle('file-exists', async (_, path: string) => {
  const fs = require('fs');
  try {
    await fs.promises.access(path, fs.constants.R_OK);
    return { accessible: true };
  } catch {
    return { accessible: false };
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

    // Include the libraryPath in the returned data to match LibraryData interface
    const libraryData = {
      ...library,
      libraryPath: xmlPath
    };

    return { success: true, data: libraryData };
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
  preferLossless?: boolean;
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
  preferLossless?: boolean;
  deleteFromDisk?: boolean;
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
    const tracksToRemove: string[] = [];
    // removedTrackId -> keptTrackId, so playlist references can be re-pointed
    // (not dropped) and playlists stay complete.
    const replacement = new Map<string, string>();

    for (const duplicateSet of resolution.duplicates) {
      const tracksInSet = duplicateSet.tracks;
      let trackToKeep;

      // Apply resolution strategy
      if (resolution.strategy === 'keep-highest-quality') {
        const qualityScore = (t: any) => (t.bitrate || 0) + (t.size || 0) / 1000000;
        trackToKeep = tracksInSet.reduce((best: any, current: any) => {
          if (resolution.preferLossless) {
            const bestLossless = isLossless(best.location || '');
            const currentLossless = isLossless(current.location || '');
            if (currentLossless && !bestLossless) return current;
            if (!currentLossless && bestLossless) return best;
          }
          return qualityScore(current) > qualityScore(best) ? current : best;
        });
      } else if (resolution.strategy === 'keep-newest') {
        trackToKeep = tracksInSet.reduce((newest: any, current: any) => {
          if (!newest.dateModified) {return current;}
          if (!current.dateModified) {return newest;}
          return new Date(current.dateModified) > new Date(newest.dateModified) ? current : newest;
        });
      } else if (resolution.strategy === 'keep-oldest') {
        trackToKeep = tracksInSet.reduce((oldest: any, current: any) => {
          if (!oldest.dateAdded) {return current;}
          if (!current.dateAdded) {return oldest;}
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

          if (aMatch !== -1 && bMatch !== -1) {return aMatch - bMatch;}
          if (aMatch !== -1) {return -1;}
          if (bMatch !== -1) {return 1;}
          return 0;
        });
        trackToKeep = sortedTracks[0];
      } else {
        // Default: keep first track
        trackToKeep = tracksInSet[0];
      }

      // Add all other tracks to removal list
      const tracksToRemoveFromSet = tracksInSet
        .filter((track: any) => track.id !== trackToKeep.id);

      tracksToRemove.push(...tracksToRemoveFromSet.map((t: any) => t.id));
      tracksToRemoveFromSet.forEach((t: any) => replacement.set(t.id, trackToKeep.id));

      safeConsole.log(`🎵 Duplicate set: keeping "${trackToKeep.name}" (${trackToKeep.location}), removing ${tracksToRemoveFromSet.length} others`);
    }

    // Step 4: Remove tracks from library
    safeConsole.log(`🗑️ Removing ${tracksToRemove.length} duplicate tracks from library`);

    // Collect file locations before deleting from the Map
    const locationsToDelete: string[] = resolution.deleteFromDisk
      ? tracksToRemove
          .map(trackId => library.tracks.get(trackId)?.location)
          .filter((loc): loc is string => !!loc)
      : [];

    // Remove from tracks Map
    tracksToRemove.forEach(trackId => {
      library.tracks.delete(trackId);
    });

    // Re-point playlist references from each removed track to the kept track,
    // so playlists stay complete (a song that lived only in the removed
    // duplicate is preserved, now pointing at the kept file) and no playlist
    // gains a duplicate entry.
    substitutePlaylistTrackIds(library.playlists, replacement);

    // Step 5: Save updated library
    await rekordboxParser.saveLibrary(library, resolution.libraryPath);

    safeConsole.log(`✅ Successfully resolved duplicates: removed ${tracksToRemove.length} tracks`);
    logger.logLibrarySaving(resolution.libraryPath, library.tracks.size);

    // Step 6 (optional): Delete files from disk.
    // Several rekordbox entries can point at the SAME file. Only delete a path
    // that no remaining track still references, or we would destroy the audio
    // belonging to a track the user chose to keep.
    const remainingLocations = Array.from(library.tracks.values())
      .map((t: any) => t?.location)
      .filter((loc: any): loc is string => typeof loc === 'string' && loc.length > 0);
    const deletablePaths = computeDeletablePaths(locationsToDelete, remainingLocations);
    const skippedStillReferenced = locationsToDelete.length - deletablePaths.length;
    if (skippedStillReferenced > 0) {
      safeConsole.log(`🛡️ Skipped ${skippedStillReferenced} path(s) still referenced by kept tracks or duplicated in the delete list`);
    }

    const deleteResults = { deleted: 0, failed: [] as { file: string; error: string }[] };
    if (resolution.deleteFromDisk && deletablePaths.length > 0) {
      for (const loc of deletablePaths) {
        try {
          // Move to the OS trash rather than unlinking, so a wrong call is
          // recoverable by the user instead of destroying audio permanently.
          await shell.trashItem(loc);
          deleteResults.deleted++;
          safeConsole.log(`🗑️ Moved to trash: ${loc}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          deleteResults.failed.push({ file: loc, error: msg });
          safeConsole.error(`❌ Failed to trash ${loc}: ${msg}`);
        }
      }
    }

    return {
      success: true,
      backupPath,
      tracksRemoved: tracksToRemove.length,
      filesDeleted: deleteResults.deleted,
      deleteErrors: deleteResults.failed,
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

// Store active operations for cancellation
const activeOperations = new Map<string, { cancelled: boolean }>();

ipcMain.handle('auto-relocate-tracks', async (_event, data: {
  tracks: any[];
  options: any;
  libraryPath: string;
}) => {
  appLogger.info(`🤖 IPC: Auto-relocating ${data.tracks.length} tracks using manual logic`);

  const operationId = Date.now().toString();
  const cancelToken = { cancelled: false };
  activeOperations.set(operationId, cancelToken);

  try {
    let successCount = 0;
    const results: any[] = [];
    const successfulRelocations: Array<{
      trackId: string;
      oldLocation: string;
      newLocation: string;
    }> = [];

    // Send initial progress
    if (mainWindow) {
      mainWindow.webContents.send('auto-relocate-progress', {
        operationId,
        type: 'start',
        total: data.tracks.length,
        current: 0,
        message: 'Starting auto-relocation...'
      });
    }

    // Build the filesystem index ONCE up front so 5000 tracks reuse it
    // instead of re-globbing the whole tree per track (was the crash cause).
    await trackRelocator.beginRelocationRun(data.options);

    // Process tracks sequentially using the SAME logic as manual relocation
    for (let i = 0; i < data.tracks.length; i++) {
      // Check if cancelled
      if (cancelToken.cancelled) {
        appLogger.info('⚠️ Auto-relocation cancelled by user');
        if (mainWindow) {
          mainWindow.webContents.send('auto-relocate-progress', {
            operationId,
            type: 'cancelled',
            total: data.tracks.length,
            current: i,
            message: 'Auto-relocation cancelled'
          });
        }
        break;
      }

      const track = data.tracks[i];

      // Send progress update for searching
      if (mainWindow) {
        mainWindow.webContents.send('auto-relocate-progress', {
          operationId,
          type: 'searching',
          total: data.tracks.length,
          current: i + 1,
          trackName: track.name,
          trackArtist: track.artist,
          message: `Searching for: ${track.name}`
        });
      }

      try {
        // Use the EXACT same logic as manual relocation
        appLogger.info(`🔍 Auto-relocating track ${i+1}/${data.tracks.length}: "${track.name}" by ${track.artist}`);
        const candidatesResult = await trackRelocator.findRelocationCandidates(track, data.options);

        if (candidatesResult.length > 0) {
          // Use the best candidate (highest confidence) - same as manual
          const bestCandidate = candidatesResult.reduce((best, current) =>
            current.confidence > best.confidence ? current : best
          );

          appLogger.info(`   Found ${candidatesResult.length} candidates, best: ${bestCandidate.path} (confidence: ${bestCandidate.confidence})`);

          // Only auto-relocate if confidence is high enough
          if (bestCandidate.confidence >= data.options.matchThreshold) {
            successfulRelocations.push({
              trackId: track.id,
              oldLocation: track.originalLocation,
              newLocation: bestCandidate.path
            });

            results.push({
              trackId: track.id,
              trackName: track.name,
              success: true,
              newLocation: bestCandidate.path,
              confidence: bestCandidate.confidence,
              oldLocation: track.originalLocation
            });

            successCount++;

            // Send success update
            if (mainWindow) {
              mainWindow.webContents.send('auto-relocate-progress', {
                operationId,
                type: 'found',
                total: data.tracks.length,
                current: i + 1,
                trackName: track.name,
                confidence: bestCandidate.confidence,
                newLocation: bestCandidate.path,
                message: `Found: ${track.name} (${Math.round(bestCandidate.confidence * 100)}%)`,
                successCount
              });
            }

            appLogger.info(`   ✅ Auto-relocating: confidence ${bestCandidate.confidence} >= threshold ${data.options.matchThreshold}`);
          } else {
            results.push({
              trackId: track.id,
              trackName: track.name,
              success: false,
              error: 'No high-confidence candidate found',
              confidence: bestCandidate.confidence
            });

            // Send low confidence update
            if (mainWindow) {
              mainWindow.webContents.send('auto-relocate-progress', {
                operationId,
                type: 'low-confidence',
                total: data.tracks.length,
                current: i + 1,
                trackName: track.name,
                confidence: bestCandidate.confidence,
                message: `Low confidence: ${track.name}`,
                successCount
              });
            }

            appLogger.info(`   ❌ Confidence too low: ${bestCandidate.confidence} < ${data.options.matchThreshold}`);
          }
        } else {
          results.push({
            trackId: track.id,
            trackName: track.name,
            success: false,
            error: 'No candidates found'
          });

          // Send not found update
          if (mainWindow) {
            mainWindow.webContents.send('auto-relocate-progress', {
              operationId,
              type: 'not-found',
              total: data.tracks.length,
              current: i + 1,
              trackName: track.name,
              message: `Not found: ${track.name}`,
              successCount
            });
          }

          appLogger.info(`   ❌ No candidates found for "${track.name}"`);
        }
      } catch (error) {
        results.push({
          trackId: track.id,
          trackName: track.name,
          success: false,
          error: error instanceof Error ? error.message : 'Processing error'
        });
        appLogger.error(`   ❌ Error processing track "${track.name}":`, error);
      }
    }

    // Step 2: Apply the relocations using batch relocation logic
    let batchResult: {
      success: boolean;
      data?: any;
      xmlUpdated?: boolean;
      tracksUpdated?: number;
      backupPath?: string;
      error?: string;
    } | null = null;

    // Do NOT commit partial work to the XML if the user cancelled mid-run
    if (!cancelToken.cancelled && successfulRelocations.length > 0 && data.libraryPath) {
      safeConsole.log(`📝 Applying ${successfulRelocations.length} auto-relocations using batch process`);

      try {
        // Step 2a: Verify relocations first (without XML update)
        const verificationResults = await trackRelocator.batchRelocate(successfulRelocations);
        const verifiedSuccessful = verificationResults.filter(r => r.success);

        if (verifiedSuccessful.length === 0) {
          safeConsole.log('⚠️ No successful relocations to apply to XML');
          batchResult = { success: true, data: verificationResults, xmlUpdated: false, tracksUpdated: 0 };
        } else {
          // Step 2b: Create backup of original XML
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = `${data.libraryPath}.backup.${timestamp}`;

          const fs = require('fs');
          fs.copyFileSync(data.libraryPath, backupPath);
          safeConsole.log(`💾 Backup created: ${backupPath}`);

          // Step 2c: Parse current library
          const library = await rekordboxParser.parseLibrary(data.libraryPath);
          safeConsole.log(`📚 Parsed library with ${library.tracks.size} tracks`);

          // Step 2d: Update track locations in the library
          let tracksUpdated = 0;
          for (const relocation of verifiedSuccessful) {
            const track = library.tracks.get(relocation.trackId);
            if (track && relocation.newLocation) {
              // Update the track location
              track.location = relocation.newLocation;
              library.tracks.set(relocation.trackId, track);
              tracksUpdated++;
              safeConsole.log(`🎵 Auto-updated track "${track.name}": ${relocation.oldLocation} -> ${relocation.newLocation}`);
            }
          }

          // Step 2e: Save updated library back to XML
          if (tracksUpdated > 0) {
            await rekordboxParser.saveLibrary(library, data.libraryPath);
            safeConsole.log(`✅ XML updated with ${tracksUpdated} auto-relocated tracks`);
            logger.logLibrarySaving(data.libraryPath, library.tracks.size);
          }

          batchResult = {
            success: true,
            data: verificationResults,
            backupPath,
            xmlUpdated: tracksUpdated > 0,
            tracksUpdated
          };
        }
      } catch (error) {
        safeConsole.error('❌ Auto-relocate batch processing failed:', error);
        batchResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }

    // Send XML update notification if needed
    if (successfulRelocations.length > 0 && data.libraryPath) {
      if (mainWindow) {
        mainWindow.webContents.send('auto-relocate-progress', {
          operationId,
          type: 'updating-xml',
          total: data.tracks.length,
          current: data.tracks.length,
          message: `Updating XML with ${successfulRelocations.length} relocations...`
        });
      }
    }

    // Clean up cancel token and free the cached file index
    activeOperations.delete(operationId);
    trackRelocator.endRelocationRun();

    // Send completion
    if (mainWindow) {
      mainWindow.webContents.send('auto-relocate-progress', {
        operationId,
        type: 'complete',
        total: data.tracks.length,
        current: data.tracks.length,
        successCount,
        message: `Complete: ${successCount}/${data.tracks.length} tracks relocated`
      });
    }

    appLogger.info(`✅ Auto-relocation complete: ${successCount}/${data.tracks.length} successful (using manual logic)`);

    return {
      success: true,
      operationId,
      data: {
        totalTracks: data.tracks.length,
        successfulRelocations: successCount,
        results,
        xmlUpdated: batchResult?.xmlUpdated || false,
        tracksUpdated: batchResult?.tracksUpdated || 0,
        backupPath: batchResult?.backupPath
      }
    };
  } catch (error) {
    // Clean up active operation and free the cached file index
    activeOperations.delete(operationId);
    trackRelocator.endRelocationRun();

    appLogger.error('❌ Auto-relocate tracks failed:', error);
    logger.error('AUTO_RELOCATE_TRACKS_FAILED', {
      trackCount: data.tracks.length,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });

    // Send error notification
    if (mainWindow) {
      mainWindow.webContents.send('auto-relocate-progress', {
        operationId,
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Add cancel handler
ipcMain.handle('cancel-auto-relocate', async (_, operationId: string) => {
  const cancelToken = activeOperations.get(operationId);
  if (cancelToken) {
    cancelToken.cancelled = true;
    activeOperations.delete(operationId);

    appLogger.info(`⚠️ Auto-relocation ${operationId} cancelled by user`);

    if (mainWindow) {
      mainWindow.webContents.send('auto-relocate-progress', {
        operationId,
        type: 'cancelled',
        message: 'Auto-relocation cancelled'
      });
    }

    return { success: true };
  }
  return { success: false, error: 'Operation not found' };
});

ipcMain.handle('find-missing-tracks', async (_, tracks: any) => {
  appLogger.info('🔍 IPC: Finding missing tracks');
  try {
    const tracksMap = new Map(Object.entries(tracks));
    const missingTracks = await trackRelocator.findMissingTracks(tracksMap);
    appLogger.info(`✅ Found ${missingTracks.length} missing tracks`);
    return { success: true, data: missingTracks };
  } catch (error) {
    appLogger.error('❌ Find missing tracks failed:', error);
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
      safeConsole.log('✅ Track relocation successful');
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

ipcMain.handle('batch-relocate-tracks', async (_, data: {
  libraryPath: string;
  relocations: any[];
}) => {
  safeConsole.log(`📁 IPC: Batch relocating ${data.relocations.length} tracks`);
  try {
    // Step 1: Verify relocations first (without XML update)
    const verificationResults = await trackRelocator.batchRelocate(data.relocations);
    const successfulRelocations = verificationResults.filter(r => r.success);

    if (successfulRelocations.length === 0) {
      safeConsole.log('⚠️ No successful relocations to apply to XML');
      return { success: true, data: verificationResults };
    }

    // Step 2: Create backup of original XML
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${data.libraryPath}.backup.${timestamp}`;

    const fs = require('fs');
    fs.copyFileSync(data.libraryPath, backupPath);
    safeConsole.log(`📄 Backup created: ${backupPath}`);

    // Step 3: Parse current library
    const library = await rekordboxParser.parseLibrary(data.libraryPath);
    safeConsole.log(`📚 Parsed library with ${library.tracks.size} tracks`);

    // Step 4: Update track locations in the library (keep tracks in playlists)
    let tracksUpdated = 0;
    for (const relocation of successfulRelocations) {
      const track = library.tracks.get(relocation.trackId);
      if (track && relocation.newLocation) {
        // Update the track location
        track.location = relocation.newLocation;
        library.tracks.set(relocation.trackId, track);
        tracksUpdated++;
        safeConsole.log(`🎵 Updated track "${track.name}" location: ${relocation.oldLocation} -> ${relocation.newLocation}`);
      } else {
        if (!track) {
          safeConsole.warn(`⚠️ Track ${relocation.trackId} not found in library`);
        }
        if (!relocation.newLocation) {
          safeConsole.warn(`⚠️ No new location provided for track ${relocation.trackId}`);
        }
      }
    }

    // Step 5: Save updated library back to XML
    if (tracksUpdated > 0) {
      await rekordboxParser.saveLibrary(library, data.libraryPath);
      safeConsole.log(`✅ Updated XML saved with ${tracksUpdated} track location changes`);
      logger.logLibrarySaving(data.libraryPath, library.tracks.size);
    }

    const successCount = verificationResults.filter(r => r.success).length;
    safeConsole.log(`✅ Batch relocation complete: ${successCount}/${data.relocations.length} successful, XML updated with ${tracksUpdated} changes`);

    return {
      success: true,
      data: verificationResults,
      backupPath,
      xmlUpdated: tracksUpdated > 0,
      tracksUpdated
    };
  } catch (error) {
    safeConsole.error('❌ Batch relocate tracks failed:', error);
    logger.error('BATCH_RELOCATE_TRACKS_FAILED', {
      count: data.relocations.length,
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
      safeConsole.log('✅ Cloud sync fix successful');
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
      safeConsole.log('✅ Dropbox API initialized successfully');
    } else {
      safeConsole.log('❌ Dropbox API initialization failed');
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
      safeConsole.log('✅ Ownership fix successful');
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
    const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    return { success: true, data: { version: packageJson.version } };
  } catch (error) {
    safeConsole.error('❌ Failed to read app version:', error);
    return { success: false, error: 'Failed to read version' };
  }
});

// Open external URLs in the default browser
ipcMain.handle('open-external', async (_, url: string) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    safeConsole.error('❌ Failed to open external URL:', error);
    return { success: false, error: 'Failed to open URL' };
  }
});

// Native file dialog for opening files with absolute paths
ipcMain.handle('open-file-dialog', async (_, options = {}) => {
  if (!mainWindow) {
    return { success: false, error: 'No active window' };
  }
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: options.filters || [
        { name: 'Rekordbox XML', extensions: ['xml'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      ...options
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, error: 'User cancelled or no files selected' };
    }

    // Return absolute file paths
    return {
      success: true,
      data: {
        filePaths: result.filePaths,
        filePath: result.filePaths[0] // For backward compatibility
      }
    };
  } catch (error) {
    safeConsole.error('❌ Failed to open file dialog:', error);
    return { success: false, error: 'Failed to open file dialog' };
  }
});


// Handle native file drop with real file paths (event-based only)
ipcMain.handle('handle-native-drop', async (_, filePaths: string[]) => {
  try {
    safeConsole.log('🎯 Processing native file drop:', filePaths);

    // Validate that all paths are absolute and files exist
    const fs = require('fs');
    const validPaths: string[] = [];

    for (const filePath of filePaths) {
      if (path.isAbsolute(filePath)) {
        try {
          await fs.promises.access(filePath, fs.constants.R_OK);
          validPaths.push(filePath);
          safeConsole.log('✅ Valid native file path:', filePath);
        } catch {
          safeConsole.warn('❌ Cannot access file:', filePath);
        }
      } else {
        safeConsole.warn('❌ Path is not absolute:', filePath);
      }
    }

    if (validPaths.length > 0) {
      // Send the validated native paths to renderer via event (single notification path)
      mainWindow?.webContents.send('native-file-dropped', validPaths);
      return { success: true, data: { filePaths: validPaths, filePath: validPaths[0] } };
    } else {
      return { success: false, error: 'No valid file paths found' };
    }
  } catch (error) {
    safeConsole.error('❌ Failed to handle native drop:', error);
    return { success: false, error: 'Failed to handle native drop' };
  }
});

// Save dropped file content to temp directory (fallback)
ipcMain.handle('save-dropped-file', async (_, { content, fileName }) => {
  try {
    const fs = require('fs');
    const os = require('os');

    // Create a temporary file path
    const tempDir = path.join(os.tmpdir(), 'rekordbox-library-fixer');
    await fs.promises.mkdir(tempDir, { recursive: true });

    const tempFilePath = path.join(tempDir, fileName);

    // Write the file content
    await fs.promises.writeFile(tempFilePath, content, 'utf8');

    safeConsole.log('✅ Dropped file saved to:', tempFilePath);
    return { success: true, data: { filePath: tempFilePath } };
  } catch (error) {
    safeConsole.error('❌ Failed to save dropped file:', error);
    return { success: false, error: 'Failed to save dropped file' };
  }
});

// ─── Consolidate Library ──────────────────────────────────────────────────────

const consolidateCancelTokens = new Map<string, { cancelled: boolean }>();

ipcMain.handle('consolidate-preview', async (_, { tracks, destination }: { tracks: any[]; destination: string }) => {
  try {
    const preview = libraryConsolidator.preview(tracks, destination);
    return { success: true, data: preview };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Preview failed' };
  }
});

ipcMain.handle('consolidate-library', async (event, {
  operationId, tracks, libraryPath, options
}: {
  operationId: string;
  tracks: any[];
  libraryPath: string;
  options: { destination: string; mode: 'copy' | 'move'; conflictResolution: 'skip' | 'overwrite' | 'quality'; preferLossless?: boolean };
}) => {
  const cancelToken = { cancelled: false };
  consolidateCancelTokens.set(operationId, cancelToken);

  try {
    const result = libraryConsolidator.consolidate(
      tracks,
      options,
      (progress) => {
        event.sender.send('consolidate-progress', { operationId, ...progress });
      },
      cancelToken
    );

    // Update XML locations if any files moved successfully
    if (Object.keys(result.locationUpdates).length > 0 && libraryPath) {
      try {
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${libraryPath}.backup.${timestamp}`;
        fs.copyFileSync(libraryPath, backupPath);

        const library = await rekordboxParser.parseLibrary(libraryPath);
        const locToId = new Map(
          [...library.tracks.entries()].map(([id, t]) => [t.location, id])
        );
        for (const [oldLoc, newLoc] of Object.entries(result.locationUpdates)) {
          const id = locToId.get(oldLoc);
          if (id) {
            const track = library.tracks.get(id);
            if (track) {
              track.location = newLoc;
              locToId.set(newLoc, id);
              locToId.delete(oldLoc);
            }
          }
        }
        await rekordboxParser.saveLibrary(library, libraryPath);
      } catch (xmlErr) {
        safeConsole.error('Failed to update XML after consolidation:', xmlErr);
      }
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Consolidation failed' };
  } finally {
    consolidateCancelTokens.delete(operationId);
  }
});

ipcMain.handle('cancel-consolidate', async (_, operationId: string) => {
  const token = consolidateCancelTokens.get(operationId);
  if (token) token.cancelled = true;
  return { success: true };
});

// ─── Filter & Move/Copy ───────────────────────────────────────────────────────

type FilterRule = {
  field: 'artist' | 'album' | 'genre' | 'rating' | 'bpm' | 'year' | 'format';
  op: 'contains' | 'equals' | 'gte' | 'lte';
  value: string;
};

function applyFilters(tracks: any[], rules: FilterRule[]): any[] {
  return tracks.filter(t => rules.every(r => {
    const raw = (() => {
      switch (r.field) {
        case 'artist':  return (t.artist  || '').toLowerCase();
        case 'album':   return (t.album   || '').toLowerCase();
        case 'genre':   return (t.genre   || '').toLowerCase();
        case 'rating':  return t.rating  ?? 0;
        case 'bpm':     return parseFloat(t.bpm) || 0;
        case 'year':    return parseInt(t.year, 10) || 0;
        case 'format': {
          const ext = (t.location || '').split('.').pop()?.toLowerCase() ?? '';
          return ext;
        }
      }
    })();
    const val = r.op === 'contains' || r.op === 'equals'
      ? r.value.toLowerCase()
      : parseFloat(r.value);

    switch (r.op) {
      case 'contains': return typeof raw === 'string' && raw.includes(val as string);
      case 'equals':   return typeof raw === 'string' ? raw === val : raw === parseFloat(r.value);
      case 'gte':      return typeof raw === 'number' && raw >= (val as number);
      case 'lte':      return typeof raw === 'number' && raw <= (val as number);
      default:         return true;
    }
  }));
}

const filterCancelTokens = new Map<string, { cancelled: boolean }>();

ipcMain.handle('filter-preview', async (_, { tracks, filters, destination }: {
  tracks: any[];
  filters: FilterRule[];
  destination: string;
}) => {
  try {
    const filtered = applyFilters(tracks, filters);
    const preview = libraryConsolidator.preview(filtered, destination);
    return { success: true, data: { ...preview, matchedTracks: filtered.length } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Preview failed' };
  }
});

ipcMain.handle('filter-library', async (event, {
  operationId, tracks, libraryPath, filters, options,
}: {
  operationId: string;
  tracks: any[];
  libraryPath: string;
  filters: FilterRule[];
  options: { destination: string; mode: 'copy' | 'move'; conflictResolution: 'skip' | 'overwrite' | 'quality'; preferLossless?: boolean };
}) => {
  const cancelToken = { cancelled: false };
  filterCancelTokens.set(operationId, cancelToken);

  try {
    const filtered = applyFilters(tracks, filters);
    const result = libraryConsolidator.consolidate(
      filtered,
      options,
      (progress) => { event.sender.send('filter-progress', { operationId, ...progress }); },
      cancelToken
    );

    if (Object.keys(result.locationUpdates).length > 0 && libraryPath) {
      try {
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(libraryPath, `${libraryPath}.backup.${timestamp}`);
        const library = await rekordboxParser.parseLibrary(libraryPath);
        const locToId = new Map([...library.tracks.entries()].map(([id, t]) => [t.location, id]));
        for (const [oldLoc, newLoc] of Object.entries(result.locationUpdates)) {
          const id = locToId.get(oldLoc);
          if (id) {
            const track = library.tracks.get(id);
            if (track) { track.location = newLoc; locToId.set(newLoc, id); locToId.delete(oldLoc); }
          }
        }
        await rekordboxParser.saveLibrary(library, libraryPath);
      } catch (xmlErr) {
        safeConsole.error('Failed to update XML after filter-move:', xmlErr);
      }
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Filter operation failed' };
  } finally {
    filterCancelTokens.delete(operationId);
  }
});

ipcMain.handle('cancel-filter', async (_, operationId: string) => {
  const token = filterCancelTokens.get(operationId);
  if (token) token.cancelled = true;
  return { success: true };
});
