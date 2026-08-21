import { describe, it, expect } from 'vitest';
import { isRekordboxRunning } from '../../src/main/rekordboxRunning';

describe('isRekordboxRunning', () => {
  it('detects the running app on macOS', () => {
    const ps = () => '/Applications/rekordbox 7/rekordbox.app/Contents/MacOS/rekordbox\n/usr/sbin/cfprefsd';
    expect(isRekordboxRunning(ps)).toBe(true);
  });

  it('detects it on Windows', () => {
    expect(isRekordboxRunning(() => 'rekordbox.exe    1234 Console')).toBe(true);
  });

  it('reports not running when only unrelated processes are up', () => {
    expect(isRekordboxRunning(() => '/usr/sbin/cfprefsd\n/usr/libexec/secd')).toBe(false);
  });

  it('assumes running when the process list cannot be read, because refusing is safe', () => {
    expect(isRekordboxRunning(() => { throw new Error('no ps'); })).toBe(true);
  });
});
