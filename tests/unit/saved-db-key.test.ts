import { describe, it, expect, vi } from 'vitest';
vi.unmock('fs');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readSavedDbKey, rememberDbKey, writeSavedDbKey } from '../../src/main/savedDbKey';

const KEY = 'ab'.repeat(32);
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dbkey-'));

describe('saved database key', () => {
  it('survives a round trip', () => {
    const d = dir();
    expect(writeSavedDbKey(d, `  ${KEY}\n`)).toBe(true);
    expect(readSavedDbKey(d)).toBe(KEY);
  });

  it('is empty when nothing was saved, or the file is damaged', () => {
    const d = dir();
    expect(readSavedDbKey(d)).toBe('');
    fs.writeFileSync(path.join(d, 'rekordbox-key.json'), '{not json');
    expect(readSavedDbKey(d)).toBe('');
  });

  it('refuses to keep something that is not a key', () => {
    const d = dir();
    expect(writeSavedDbKey(d, 'half a key 402fd4')).toBe(false);
    expect(readSavedDbKey(d)).toBe('');
  });
});

describe('rememberDbKey', () => {
  const BUNDLED = 'cd'.repeat(32);

  it('keeps a pasted key that is not the bundled one', () => {
    const d = dir();
    expect(rememberDbKey(d, KEY, BUNDLED)).toBe(true);
    expect(readSavedDbKey(d)).toBe(KEY);
  });

  it('never saves the bundled key, so a later release\'s bundled key is not pinned out', () => {
    const d = dir();
    expect(rememberDbKey(d, BUNDLED.toUpperCase(), BUNDLED)).toBe(true);
    expect(readSavedDbKey(d)).toBe('');
  });

  it('drops a saved copy of the bundled key an older version left behind', () => {
    const d = dir();
    writeSavedDbKey(d, BUNDLED);
    rememberDbKey(d, BUNDLED, BUNDLED);
    expect(readSavedDbKey(d)).toBe('');
  });

  it('saves any key when the build has none bundled', () => {
    const d = dir();
    expect(rememberDbKey(d, KEY, '')).toBe(true);
    expect(readSavedDbKey(d)).toBe(KEY);
  });

  it('refuses something that is not a key', () => {
    expect(rememberDbKey(dir(), '402fd4', BUNDLED)).toBe(false);
  });
});
