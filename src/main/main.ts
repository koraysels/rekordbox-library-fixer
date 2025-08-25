import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import { RekordboxParser } from './rekordboxParser';
import { DuplicateDetector } from './duplicateDetector';
import { Logger } from './logger';
import { DuplicateStorage } from './duplicateStorage';

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
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#18181B',
  });

  // In development, load from localhost
  if (process.env.NODE_ENV === 'development') {
    // Try different ports in case 3000 is occupied
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3001';
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

app.whenReady().then(() => {
  logger = new Logger();
  rekordboxParser = new RekordboxParser();
  duplicateDetector = new DuplicateDetector();
  
  try {
    duplicateStorage = new DuplicateStorage();
    console.log('✅ SQLite storage initialized');
  } catch (error) {
    console.error('❌ Failed to initialize SQLite storage:', error);
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
  duplicates: any[];
  strategy: 'keep-highest-quality' | 'keep-newest' | 'keep-oldest' | 'keep-preferred-path' | 'manual';
  selections?: Map<string, string>;
}) => {
  try {
    const resolved = await duplicateDetector.resolveDuplicates(resolution);
    return { success: true, data: resolved };
  } catch (error) {
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
  console.log(`💾 IPC: Saving duplicate results for ${data.libraryPath}`);
  try {
    if (!duplicateStorage) {
      console.error('❌ Database not initialized yet');
      return { success: false, error: 'Database not initialized yet' };
    }
    duplicateStorage.saveDuplicateResult({
      libraryPath: data.libraryPath,
      duplicates: data.duplicates,
      selectedDuplicates: data.selectedDuplicates,
      hasScanned: data.hasScanned,
      scanOptions: data.scanOptions
    });
    console.log(`✅ Successfully saved duplicate results for ${data.libraryPath}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Save failed:', error);
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
  console.log(`📖 IPC: Loading duplicate results for ${libraryPath}`);
  try {
    if (!duplicateStorage) {
      console.log('⏳ Database not ready yet, returning null');
      return { success: true, data: null }; // Return null if not ready yet
    }
    const result = duplicateStorage.getDuplicateResult(libraryPath);
    if (result) {
      console.log(`✅ Found stored results: ${result.duplicates.length} duplicates, ${result.selectedDuplicates.length} selected`);
    } else {
      console.log('🆕 No stored results found for this library');
    }
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Load failed:', error);
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
