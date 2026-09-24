import { ipcMain } from 'electron';
import { listBackups, restoreBackup, deleteBackup, scanAllBackups } from '../backupManager';

/**
 * Listing, restoring and deleting the backups the app takes before
 * every change.
 */
export function registerBackupIpc(): void {
  ipcMain.handle('list-backups', async (_e, libraryPath: string) => {
    try {
      // Without a loaded library, show every backup on the machine — this page is
      // most needed exactly when nothing is loaded and something went wrong.
      return { success: true, data: libraryPath ? listBackups(libraryPath) : scanAllBackups() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('restore-backup', async (_e, args: { backupPath: string; libraryPath: string }) => {
    try {
      const { safetyCopy } = restoreBackup(args.backupPath, args.libraryPath);
      return { success: true, safetyCopy };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('delete-backup', async (_e, backupPath: string) => {
    try {
      deleteBackup(backupPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  }
