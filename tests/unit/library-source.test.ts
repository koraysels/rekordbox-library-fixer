import { describe, it, expect } from 'vitest';
import {
  isRekordboxDatabasePath,
  assertWritableLibraryPath,
  DATABASE_IS_READ_ONLY,
} from '../../src/main/librarySource';

describe('isRekordboxDatabasePath', () => {
  it('recognises master.db', () => {
    expect(isRekordboxDatabasePath('/Users/dj/Library/Pioneer/rekordbox/master.db')).toBe(true);
  });

  it('recognises it regardless of case', () => {
    expect(isRekordboxDatabasePath('/x/MASTER.DB')).toBe(true);
  });

  it('does not flag an XML library', () => {
    expect(isRekordboxDatabasePath('/Users/dj/Documents/rekordbox/newlib.xml')).toBe(false);
  });

  it('does not flag an empty path', () => {
    expect(isRekordboxDatabasePath('')).toBe(false);
  });
});

describe('assertWritableLibraryPath', () => {
  it('refuses to write over the rekordbox database', () => {
    expect(() => assertWritableLibraryPath('/x/master.db')).toThrow(DATABASE_IS_READ_ONLY);
  });

  it('allows an XML path through', () => {
    expect(() => assertWritableLibraryPath('/x/lib.xml')).not.toThrow();
  });
});
