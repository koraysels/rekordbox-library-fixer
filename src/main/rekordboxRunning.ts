import { execFileSync } from 'child_process';

/**
 * Is rekordbox running? It keeps master.db open with a write-ahead log, so
 * writing to the database while it runs risks losing our changes or corrupting
 * its state. Every write path checks this first.
 */
export function isRekordboxRunning(
  listProcesses: () => string = defaultProcessList
): boolean {
  try {
    const output = listProcesses().toLowerCase();
    return /rekordbox(\.exe)?\b/.test(output) && !/rekordboxagent/.test(
      output.replace(/rekordbox(?!agent)/g, '')
    );
  } catch {
    // If we cannot tell, assume it is running: refusing to write is the safe
    // answer, and the user can close it and try again.
    return true;
  }
}

function defaultProcessList(): string {
  if (process.platform === 'win32') {
    return execFileSync('tasklist', [], { encoding: 'utf8' });
  }
  return execFileSync('ps', ['-Ao', 'comm'], { encoding: 'utf8' });
}
