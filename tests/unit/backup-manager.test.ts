import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The global setup stubs fs (existsSync always true, rmSync inert) so the
// logger stays quiet. These tests are about real files, so use the real module.
vi.unmock('fs');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  isBackupOf, parseBackupTimestamp, listBackups, restoreBackup, deleteBackup,
} from '../../src/main/backupManager';

let dir: string;
const LIB = 'newlib.xml';

beforeEach(() => {
  // os.tmpdir(): the repo working tree is write-restricted in some sandboxes,
  // and these tests genuinely create and delete files.
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, body: string) => {
  fs.writeFileSync(path.join(dir, name), body);
  return path.join(dir, name);
};

describe('isBackupOf', () => {
  it('matches the app\'s backup naming', () => {
    expect(isBackupOf('newlib.xml.backup.2026-08-21T14-05-35-470Z', LIB)).toBe(true);
  });
  it('does not match another library\'s backup', () => {
    expect(isBackupOf('other.xml.backup.2026-08-21T14-05-35-470Z', LIB)).toBe(false);
  });
  it('does not match the library itself', () => {
    expect(isBackupOf(LIB, LIB)).toBe(false);
  });
});

describe('parseBackupTimestamp', () => {
  it('reads the stamp the app writes', () => {
    const when = parseBackupTimestamp('newlib.xml.backup.2026-08-21T14-05-35-470Z', new Date(0));
    expect(when.toISOString()).toBe('2026-08-21T14:05:35.470Z');
  });
  it('falls back when the name has no usable stamp', () => {
    const fallback = new Date('2020-01-01T00:00:00.000Z');
    expect(parseBackupTimestamp('newlib.xml.backup.garbage', fallback)).toEqual(fallback);
  });
});

describe('listBackups', () => {
  it('lists only this library\'s backups, newest first', () => {
    const lib = write(LIB, 'current');
    write(`${LIB}.backup.2026-08-20T10-00-00-000Z`, 'older');
    write(`${LIB}.backup.2026-08-21T10-00-00-000Z`, 'newer');
    write('other.xml.backup.2026-08-21T10-00-00-000Z', 'not mine');

    const backups = listBackups(lib);
    expect(backups).toHaveLength(2);
    expect(backups[0].path).toContain('2026-08-21');
    expect(backups[1].path).toContain('2026-08-20');
  });

  it('returns nothing when the folder has no backups', () => {
    expect(listBackups(write(LIB, 'current'))).toEqual([]);
  });
});

describe('restoreBackup', () => {
  it('puts the backup back and keeps the current file as a safety copy', () => {
    const lib = write(LIB, 'current state');
    const backup = write(`${LIB}.backup.2026-08-20T10-00-00-000Z`, 'old state');

    const { safetyCopy } = restoreBackup(backup, lib);

    expect(fs.readFileSync(lib, 'utf8')).toBe('old state');
    expect(fs.readFileSync(safetyCopy, 'utf8')).toBe('current state');
  });

  it('refuses a backup that is gone', () => {
    const lib = write(LIB, 'current');
    expect(() => restoreBackup(path.join(dir, 'missing.backup.x'), lib)).toThrow(/no longer exists/i);
  });
});

describe('deleteBackup', () => {
  it('deletes a backup', () => {
    const backup = write(`${LIB}.backup.2026-08-20T10-00-00-000Z`, 'old');
    deleteBackup(backup);
    expect(fs.existsSync(backup)).toBe(false);
  });

  it('refuses to delete something that is not a backup', () => {
    const lib = write(LIB, 'current');
    expect(() => deleteBackup(lib)).toThrow(/not a backup/i);
    expect(fs.existsSync(lib)).toBe(true);
  });
});
