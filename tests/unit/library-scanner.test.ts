import { describe, it, expect } from 'vitest';
import { databaseCandidates, xmlSearchDirs } from '../../src/main/libraryScanner';

describe('databaseCandidates', () => {
  it('looks in the unversioned directory first, as rekordbox 7 uses it', () => {
    const paths = databaseCandidates('/Users/dj', 'darwin');
    expect(paths[0]).toBe('/Users/dj/Library/Pioneer/rekordbox/master.db');
    expect(paths).toHaveLength(3);
  });

  it('uses the Pioneer directory under APPDATA on Windows', () => {
    const paths = databaseCandidates('C:\\Users\\dj\\AppData\\Roaming', 'win32');
    expect(paths[0].replace(/\\/g, '/')).toContain('Pioneer/rekordbox/master.db');
  });
});

describe('xmlSearchDirs', () => {
  it('includes the places people actually export to', () => {
    const dirs = xmlSearchDirs('/Users/dj');
    expect(dirs).toContain('/Users/dj/Documents/rekordbox');
    expect(dirs).toContain('/Users/dj/Desktop');
    expect(dirs).toContain('/Users/dj/Downloads');
  });

  it('checks the rekordbox folder before the wider Documents folder', () => {
    const dirs = xmlSearchDirs('/Users/dj');
    expect(dirs.indexOf('/Users/dj/Documents/rekordbox')).toBeLessThan(dirs.indexOf('/Users/dj/Documents'));
  });
});
