import type { LibraryData } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Both tools copy or move files. Neither overwrites one: a file already at the
 * destination is reused when it is the same, otherwise the new one is saved
 * as "name (2)".
 */
export type Mode = 'copy' | 'move';
export type Phase = 'idle' | 'previewing' | 'previewed' | 'running' | 'done' | 'cancelled';

export interface Progress {
  current: number;
  total: number;
  currentFile: string;
  succeeded: number;
  skipped: number;
  failed: number;
}

export interface Result {
  succeeded: number;
  skipped: number;
  failed: number;
  errors: { file: string; error: string }[];
  entriesUpdated?: number;
  backupPath?: string;
}

/** What happens to a file already at the destination, said once for both tools. */
export const CLASH_NOTE =
  'A file already at the destination is never replaced: an identical one is used as it is, a different one is kept and yours is saved as "name (2)".';

export const isDatabaseLibrary = (libraryPath: string) => /\.db$/i.test(libraryPath ?? '');

/** The key a database library's write needs; undefined for an XML library. */
export const dbKeyFor = (libraryPath: string): string | undefined =>
  (isDatabaseLibrary(libraryPath) ? useSettingsStore.getState().rekordboxDbKey : undefined);

/**
 * The library as it is on disk now, read without the load screen's spinner —
 * which would unmount the page and lose the result being shown.
 */
export async function readLibraryAgain(libraryPath: string): Promise<LibraryData | null> {
  try {
    const res = isDatabaseLibrary(libraryPath)
      ? await window.electronAPI.parseRekordboxDb({
        dbPath: libraryPath, key: useSettingsStore.getState().rekordboxDbKey,
      })
      : await window.electronAPI.parseRekordboxLibrary(libraryPath);
    return res?.success && res.data ? res.data as LibraryData : null;
  } catch {
    return null;
  }
}
