import { describe, it, expect, vi } from 'vitest';
vi.unmock('fs');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readBundledKey } from '../../src/main/bundledKey';
// @ts-expect-error -- a plain build script, no type declarations
import { writeBundledKey } from '../../scripts/write-bundled-key.mjs';

const KEY = 'ab'.repeat(32);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bundled-key-'));
const keyFile = (root: string) => path.join(root, 'dist', 'main', 'bundled-key.json');

describe('readBundledKey', () => {
  it('reads the key from a valid file', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'bundled-key.json'), JSON.stringify({ key: KEY }));
    expect(readBundledKey(d)).toBe(KEY);
  });

  it('is empty when there is no file', () => {
    expect(readBundledKey(tmp())).toBe('');
  });

  it('is empty for a key of the wrong shape', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'bundled-key.json'), JSON.stringify({ key: KEY.slice(1) }));
    expect(readBundledKey(d)).toBe('');
  });
});

describe('writeBundledKey', () => {
  it('writes the key from the environment', () => {
    const root = tmp();
    expect(writeBundledKey(root, { REKORDBOX_DB_KEY: KEY })).toBe(true);
    expect(readBundledKey(path.dirname(keyFile(root)))).toBe(KEY);
  });

  it('write-bundled-key without key removes the file', () => {
    const root = tmp();
    fs.mkdirSync(path.dirname(keyFile(root)), { recursive: true });
    fs.writeFileSync(keyFile(root), JSON.stringify({ key: KEY }));
    expect(writeBundledKey(root, {})).toBe(false);
    expect(fs.existsSync(keyFile(root))).toBe(false);
  });

  it('does not bundle a key of the wrong shape', () => {
    const root = tmp();
    expect(writeBundledKey(root, { REKORDBOX_DB_KEY: 'not a key' })).toBe(false);
    expect(fs.existsSync(keyFile(root))).toBe(false);
  });

  it('reads .env when the variable is not set', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, '.env'), `# local secrets\nOTHER=1\nREKORDBOX_DB_KEY=${KEY}\n`);
    expect(writeBundledKey(root, {})).toBe(true);
    expect(readBundledKey(path.dirname(keyFile(root)))).toBe(KEY);
  });

  it('accepts a quoted .env value', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, '.env'), `REKORDBOX_DB_KEY="${KEY}"\r\n`);
    expect(writeBundledKey(root, {})).toBe(true);
  });
});
