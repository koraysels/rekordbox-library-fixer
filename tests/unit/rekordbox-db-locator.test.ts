import { describe, it, expect } from 'vitest';
import { resolveDbPath } from '../../src/main/rekordboxDbLocator';

const HOME = '/Users/dj';

describe('resolveDbPath', () => {
  it('finds the unversioned rekordbox directory used by Rekordbox 7', () => {
    const exists = (p: string) => p === '/Users/dj/Library/Pioneer/rekordbox/master.db';
    expect(resolveDbPath(HOME, 'darwin', exists)).toEqual({
      dbPath: '/Users/dj/Library/Pioneer/rekordbox/master.db',
      variant: 'rekordbox',
    });
  });

  it('falls back to a versioned directory when the unversioned one is absent', () => {
    const exists = (p: string) => p.includes('rekordbox6');
    expect(resolveDbPath(HOME, 'darwin', exists)).toEqual({
      dbPath: '/Users/dj/Library/Pioneer/rekordbox6/master.db',
      variant: 'rekordbox6',
    });
  });

  it('prefers the unversioned directory when several exist', () => {
    const exists = () => true;
    expect(resolveDbPath(HOME, 'darwin', exists)?.variant).toBe('rekordbox');
  });

  it('resolves under APPDATA on Windows', () => {
    const appData = 'C:\\Users\\dj\\AppData\\Roaming';
    const exists = (p: string) => p.includes('rekordbox') && p.endsWith('master.db');
    const result = resolveDbPath(appData, 'win32', exists);
    expect(result?.dbPath.replace(/\\/g, '/')).toContain('Pioneer/rekordbox/master.db');
  });

  it('returns null when no database exists', () => {
    expect(resolveDbPath(HOME, 'darwin', () => false)).toBeNull();
  });
});
