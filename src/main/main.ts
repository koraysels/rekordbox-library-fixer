import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import * as path from 'path';
import { RekordboxParser } from './rekordboxParser';
import { DuplicateDetector } from './duplicateDetector';
import { Logger } from './logger';
import { DuplicateStorage } from './duplicateStorage';

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
let duplicateStorage: DuplicateStorage;

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

  try {
    duplicateStorage = new DuplicateStorage();
    safeConsole.log('✅ SQLite storage initialized');
  } catch (error) {
    safeConsole.error('❌ Failed to initialize SQLite storage:', error);
    // Continue without storage for now - could fallback to localStorage
  }

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

// Duplicate Storage IPC Handlers
ipcMain.handle('save-duplicate-results', async (_, data: {
  libraryPath: string;
  duplicates: any[];
  selectedDuplicates: string[];
  hasScanned: boolean;
  scanOptions: any;
}) => {
  safeConsole.log(`💾 IPC: Saving duplicate results for ${data.libraryPath}`);
  try {
    if (!duplicateStorage) {
      safeConsole.error('❌ Database not initialized yet');
      return { success: false, error: 'Database not initialized yet' };
    }
    duplicateStorage.saveDuplicateResult({
      libraryPath: data.libraryPath,
      duplicates: data.duplicates,
      selectedDuplicates: data.selectedDuplicates,
      hasScanned: data.hasScanned,
      scanOptions: data.scanOptions
    });
    safeConsole.log(`✅ Successfully saved duplicate results for ${data.libraryPath}`);
    return { success: true };
  } catch (error) {
    safeConsole.error('❌ Save failed:', error);
    logger.error('SAVE_DUPLICATE_RESULTS_FAILED', {
      libraryPath: data.libraryPath,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('get-duplicate-results', async (_, libraryPath: string) => {
  safeConsole.log(`📖 IPC: Loading duplicate results for ${libraryPath}`);
  try {
    if (!duplicateStorage) {
      safeConsole.log('⏳ Database not ready yet, returning null');
      return { success: true, data: null }; // Return null if not ready yet
    }
    const result = duplicateStorage.getDuplicateResult(libraryPath);
    if (result) {
      safeConsole.log(`✅ Found stored results: ${result.duplicates.length} duplicates, ${result.selectedDuplicates.length} selected`);
    } else {
      safeConsole.log('🆕 No stored results found for this library');
    }
    return { success: true, data: result };
  } catch (error) {
    safeConsole.error('❌ Load failed:', error);
    logger.error('GET_DUPLICATE_RESULTS_FAILED', {
      libraryPath,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('delete-duplicate-results', async (_, libraryPath: string) => {
  try {
    if (!duplicateStorage) {
      return { success: false, error: 'Database not initialized yet' };
    }
    duplicateStorage.deleteDuplicateResult(libraryPath);
    return { success: true };
  } catch (error) {
    logger.error('DELETE_DUPLICATE_RESULTS_FAILED', {
      libraryPath,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});
