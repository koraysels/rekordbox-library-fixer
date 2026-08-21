import { execFileSync } from 'child_process';
import * as path from 'path';

/**
 * Is rekordbox itself running? It keeps master.db open with a write-ahead log,
 * so writing while it runs risks losing the change. Every write path asks first.
 *
 * Only the executable NAME is compared, never the whole line: this app lives in
 * a directory called "rekordbox-library-manager", so matching anywhere in the
 * process list made it detect itself and refuse every write.
 *
 * rekordboxAgent is a background helper that keeps running with rekordbox
 * closed, so it does not count.
 */
export function isRekordboxRunning(
  listProcesses: () => string = defaultProcessList
): boolean {
  try {
    return listProcesses()
      .split('\n')
      .map((line) => path.basename(line.trim()).toLowerCase())
      .some((name) => name === 'rekordbox' || name === 'rekordbox.exe');
  } catch {
    // If we cannot tell, assume it is running: refusing to write is the safe
    // answer, and the user can close it and try again.
    return true;
  }
}

function defaultProcessList(): string {
  if (process.platform === 'win32') {
    return execFileSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.split(',')[0]?.replace(/"/g, '') ?? '')
      .join('\n');
  }
  return execFileSync('ps', ['-Ao', 'comm'], { encoding: 'utf8' });
}
