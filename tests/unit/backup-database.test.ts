import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.unmock('fs');

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { backupDatabaseFile } from '../../src/main/backupDatabase';

let dir: string;
let db: string;
let backup: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
  db = path.join(dir, 'master.db');
  backup = path.join(dir, 'master.db.backup');
  fs.writeFileSync(db, 'the database');
});

afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('backupDatabaseFile', () => {
  it('copies the database aside', () => {
    backupDatabaseFile(db, backup);
    expect(fs.readFileSync(backup, 'utf8')).toBe('the database');
  });

  it('takes the WAL with it', () => {
    // Recent changes live in the WAL; a database restored without it is not
    // the database that was backed up.
    fs.writeFileSync(db + '-wal', 'pending changes');
    backupDatabaseFile(db, backup);
    expect(fs.readFileSync(backup + '-wal', 'utf8')).toBe('pending changes');
  });

  it('does not mind a database with no WAL', () => {
    expect(() => backupDatabaseFile(db, backup)).not.toThrow();
    expect(fs.existsSync(backup + '-wal')).toBe(false);
  });

  it('refuses without a backup path', () => {
    expect(() => backupDatabaseFile(db, '')).toThrow(/backup path is required/);
  });

  it('refuses when the copy came out the wrong size', () => {
    // A full disk or a disconnected drive can leave a truncated copy. Trusting
    // it is worse than having none: it only fails when you actually need it.
    const truncating = {
      copy: (_from: string, to: string) => fs.writeFileSync(to, 'trunc'),
      size: (p: string) => fs.statSync(p).size,
    };
    expect(() => backupDatabaseFile(db, backup, truncating))
      .toThrow(/is 5 bytes but the database is 12/);
  });

  it('says nothing was changed when the copy never appeared', () => {
    const doingNothing = {
      copy: () => undefined,
      size: (p: string) => fs.statSync(p).size,
    };
    expect(() => backupDatabaseFile(db, backup, doingNothing)).toThrow(/could not be written/);
  });

  it('lets a real failure through rather than writing anyway', () => {
    expect(() => backupDatabaseFile(path.join(dir, 'gone.db'), backup)).toThrow();
  });
});
