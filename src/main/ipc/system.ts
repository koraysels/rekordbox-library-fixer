import * as path from 'path';
import { ipcMain, dialog, shell, Notification, app } from 'electron';
import { runtime, safeConsole, getMainWindow, sendToWindow } from '../runtime';

/**
 * Talking to the desktop: notifications, file dialogs, revealing a
 * file, drag-and-drop and the app's own details.
 */
export function registerSystemIpc(): void {
  ipcMain.handle('show-system-notification', async (_e, data: { type: string; message: string }) => {
    try {
      if (!Notification.isSupported()) { return { success: false }; }
      const titles: Record<string, string> = {
        success: 'Rekordbox Library Fixer',
        error: 'Rekordbox Library Fixer — something went wrong',
        warning: 'Rekordbox Library Fixer — check this',
        info: 'Rekordbox Library Fixer',
      };
      new Notification({
        title: titles[data.type] ?? titles.info,
        body: data.message,
        silent: data.type === 'success',
      }).show();
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  ipcMain.handle('get-logs-info', async () => {
    return {
      logFilePath: runtime().logger.getLogPath(),
      logsDirectory: runtime().logger.getLogsDirectory()
    };
  });

  ipcMain.handle('show-file-in-folder', async (_, filePath: string) => {
    try {
      // showItemInFolder does nothing at all for a path that is not there, which
      // reads as a dead button. Say what happened instead.
      if (!require('fs').existsSync(filePath)) {
        return { success: false, error: 'That file is not on disk any more.' };
      }
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      runtime().logger.error('SHOW_FILE_FAILED', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  ipcMain.handle('get-app-version', async () => {
    // Electron knows its own version from the packaged app; reading package.json
    // relative to __dirname broke the moment this handler moved to another file.
    try {
      return { success: true, data: { version: app.getVersion() } };
    } catch (error) {
      safeConsole.error('❌ Failed to read app version:', error);
      return { success: false, error: 'Failed to read version' };
    }
  });

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

  ipcMain.handle('open-file-dialog', async (_, options = {}) => {
    const window = getMainWindow();
    if (!window) {
      return { success: false, error: 'No active window' };
    }
    try {
      const result = await dialog.showOpenDialog(window, {
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
        sendToWindow('native-file-dropped', validPaths);
        return { success: true, data: { filePaths: validPaths, filePath: validPaths[0] } };
      } else {
        return { success: false, error: 'No valid file paths found' };
      }
    } catch (error) {
      safeConsole.error('❌ Failed to handle native drop:', error);
      return { success: false, error: 'Failed to handle native drop' };
    }
  });

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
  }
