import { BrowserWindow } from 'electron';
import { RekordboxParser } from './rekordboxParser';
import { DuplicateDetector } from './duplicateDetector';
import { TrackRelocator } from './trackRelocator';
import { LibraryConsolidator } from './libraryConsolidator';
import { Logger } from './logger';

/**
 * The long-lived pieces of the main process, in one place so the IPC handlers
 * can live in files of their own instead of all sharing one 1800-line module.
 *
 * Read through `runtime()` inside a handler rather than captured at import
 * time: the window is replaced when it is closed and reopened, and a captured
 * reference would send progress to a window that is gone.
 */
export const safeConsole = {
  log: (...args: any[]) => { try { console.log(...args); } catch { /* EPIPE */ } },
  error: (...args: any[]) => { try { console.error(...args); } catch { /* EPIPE */ } },
  warn: (...args: any[]) => { try { console.warn(...args); } catch { /* EPIPE */ } },
};

let mainWindow: BrowserWindow | null = null;
export const setMainWindow = (window: BrowserWindow | null): void => { mainWindow = window; };
export const getMainWindow = (): BrowserWindow | null => mainWindow;

let logger: Logger | null = null;
let rekordboxParser: RekordboxParser | null = null;
let duplicateDetector: DuplicateDetector | null = null;
let trackRelocator: TrackRelocator | null = null;
let libraryConsolidator: LibraryConsolidator | null = null;

export interface MainRuntime {
  logger: Logger;
  rekordboxParser: RekordboxParser;
  duplicateDetector: DuplicateDetector;
  trackRelocator: TrackRelocator;
  libraryConsolidator: LibraryConsolidator;
  mainWindow: BrowserWindow | null;
}

/**
 * Send a message to the renderer, if there is a window to send it to. Every
 * progress report used to repeat the same null check around the same call.
 */
export function sendToWindow(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

/** Built on first use, which is always after the app is ready. */
export function runtime(): MainRuntime {
  logger ??= new Logger();
  rekordboxParser ??= new RekordboxParser();
  duplicateDetector ??= new DuplicateDetector();
  trackRelocator ??= new TrackRelocator();
  libraryConsolidator ??= new LibraryConsolidator();
  return {
    logger, rekordboxParser, duplicateDetector, trackRelocator, libraryConsolidator, mainWindow,
  };
}
