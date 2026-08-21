import { describe, it, expect } from 'vitest';
import { isRekordboxRunning } from '../../src/main/rekordboxRunning';

describe('isRekordboxRunning', () => {
  it('detects the running app on macOS', () => {
    const ps = () => [
      '/Applications/rekordbox 7/rekordbox.app/Contents/MacOS/rekordbox',
      '/usr/sbin/cfprefsd',
    ].join('\n');
    expect(isRekordboxRunning(ps)).toBe(true);
  });

  it('detects it on Windows', () => {
    expect(isRekordboxRunning(() => 'rekordbox.exe\nexplorer.exe')).toBe(true);
  });

  it('does not mistake this app for rekordbox', () => {
    // This app runs from a directory called rekordbox-library-manager, so
    // matching anywhere in the line made it detect itself and refuse to write.
    const ps = () => [
      '/Users/dj/rekordbox-library-manager/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
      '/Users/dj/rekordbox-library-manager/node_modules/.../Electron Helper',
    ].join('\n');
    expect(isRekordboxRunning(ps)).toBe(false);
  });

  it('ignores the background agent, which runs with rekordbox closed', () => {
    const ps = () => '/Library/PrivilegedHelperTools/rekordboxAgent\n/usr/sbin/cfprefsd';
    expect(isRekordboxRunning(ps)).toBe(false);
  });

  it('reports not running when only unrelated processes are up', () => {
    expect(isRekordboxRunning(() => '/usr/sbin/cfprefsd\n/usr/libexec/secd')).toBe(false);
  });

  it('assumes running when the process list cannot be read, because refusing is safe', () => {
    expect(isRekordboxRunning(() => { throw new Error('no ps'); })).toBe(true);
  });
});
