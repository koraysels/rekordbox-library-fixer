import * as path from 'path';
import { ipcMain, dialog } from 'electron';
import { runtime } from '../runtime';
import { detectRekordboxDb } from '../rekordboxDbLocator';
import { scanForLibraries } from '../libraryScanner';
import { isRekordboxRunning } from '../rekordboxRunning';
import { handleParseRekordboxDb } from '../rekordboxDbIpc';
import { parseDb } from '../rekordboxDbParser';
import { assertWritableLibraryPath } from '../librarySource';

/**
 * Opening a library: the file dialogs, the XML parser, rekordbox's
 * database, and finding what this machine already has.
 */
export function registerLibraryIpc(): void {
  ipcMain.handle('file-exists', async (_, path: string) => {
    const fs = require('fs');
    try {
      await fs.promises.access(path, fs.constants.R_OK);
      return { accessible: true };
    } catch {
      return { accessible: false };
    }
  });

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
      const library = await runtime().rekordboxParser.parseLibrary(xmlPath);
      runtime().logger.logLibraryParsing(xmlPath, library.tracks.size, library.playlists.length);

      // Include the libraryPath in the returned data to match LibraryData interface
      const libraryData = {
        ...library,
        libraryPath: xmlPath
      };

      return { success: true, data: libraryData };
    } catch (error) {
      runtime().logger.error('LIBRARY_PARSING_FAILED', {
        xmlPath,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  ipcMain.handle('detect-rekordbox-db', async () => detectRekordboxDb());

  ipcMain.handle('scan-for-libraries', async () => scanForLibraries());

  ipcMain.handle('is-rekordbox-running', async () => ({ running: isRekordboxRunning() }));

  ipcMain.handle('parse-rekordbox-db', async (_e, args: { dbPath: string; key: string }) =>
    handleParseRekordboxDb(args, parseDb));

  ipcMain.handle('save-rekordbox-xml', async (_, data: {
    library: Parameters<ReturnType<typeof runtime>['rekordboxParser']['saveLibrary']>[0];
    outputPath: string;
  }) => {
    try {
      assertWritableLibraryPath(data.outputPath);
      await runtime().rekordboxParser.saveLibrary(data.library, data.outputPath);
      runtime().logger.logLibrarySaving(data.outputPath, data.library.tracks.size);
      return { success: true };
    } catch (error) {
      runtime().logger.error('LIBRARY_SAVING_FAILED', {
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
  }
