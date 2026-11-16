import { ipcMain } from 'electron';
import { safeConsole } from '../runtime';
import { findSticks } from '../usb/findSticks';
import { checkStick } from '../usb/checkStick';
import type { IpcResult, UsbCheckRequest, UsbCheckResult, UsbStick } from '../ipcContract';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Unknown error occurred');

/**
 * The USB check: which mounted sticks carry a rekordbox export, and what one of
 * them lacks compared with the library. Read-only — the stick's files and
 * master.db are copied to a temp folder and read there; nothing is written.
 */
export function registerUsbIpc(): void {
  ipcMain.handle('usb-find-sticks', async (): Promise<IpcResult<UsbStick[]>> => {
    try {
      return { success: true, data: await findSticks() };
    } catch (error) {
      safeConsole.error('❌ usb-find-sticks failed:', error);
      return { success: false, error: errorText(error) };
    }
  });

  ipcMain.handle('usb-check-stick', async (_e, data: UsbCheckRequest): Promise<IpcResult<UsbCheckResult>> => {
    if (!data?.stickRoot || !data.dbPath || !data.key) {
      return { success: false, error: 'A stick, the library database and its key are all needed.' };
    }
    try {
      return { success: true, data: await checkStick(data) };
    } catch (error) {
      safeConsole.error('❌ usb-check-stick failed:', error);
      return { success: false, error: errorText(error) };
    }
  });
}
