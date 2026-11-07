import { describe, it, expect, vi } from 'vitest';
vi.unmock('fs');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readSavedDbKey, writeSavedDbKey } from '../../src/main/savedDbKey';

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
