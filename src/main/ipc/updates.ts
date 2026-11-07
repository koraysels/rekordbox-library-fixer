import { ipcMain } from 'electron';
import { checkForUpdates, installUpdate, openReleasesPage, currentUpdateStatus } from '../updates/updater';

/** The app's own update: its status, a manual check, and the restart into it. */
export function registerUpdateIpc(): void {
  ipcMain.handle('get-update-status', async () => currentUpdateStatus());
  ipcMain.handle('check-for-updates', async () => checkForUpdates());
  ipcMain.handle('install-update', async () => { installUpdate(); return { success: true }; });
  ipcMain.handle('open-releases-page', async () => { await openReleasesPage(); return { success: true }; });
}
