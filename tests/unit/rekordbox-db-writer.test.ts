import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.unmock('fs');

import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyMerges, mergeDuplicateEntries } from '../../src/main/rekordboxDbWriter';

let file: string;
let db: InstanceType<typeof Database>;

beforeEach(() => {
  file = path.join(os.tmpdir(), `wr-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = new Database(file);
  db.exec(`
    CREATE TABLE djmdContent (ID TEXT PRIMARY KEY, Title TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdSongPlaylist (
      ID TEXT PRIMARY KEY, PlaylistID TEXT, ContentID TEXT, rb_local_deleted INTEGER DEFAULT 0);
    INSERT INTO djmdContent VALUES ('keep','Song',0), ('dup1','Song',0), ('dup2','Song',0);
    -- playlist A holds only the duplicate; playlist B holds both
    INSERT INTO djmdSongPlaylist VALUES ('l1','A','dup1',0);
    INSERT INTO djmdSongPlaylist VALUES ('l2','B','keep',0);
    INSERT INTO djmdSongPlaylist VALUES ('l3','B','dup1',0);
    INSERT INTO djmdSongPlaylist VALUES ('l4','A','dup2',0);
  `);
});

afterEach(() => {
  try { db.close(); } catch { /* already closed */ }
  fs.rmSync(file, { force: true });
});

const links = () =>
  db.prepare('SELECT PlaylistID, ContentID FROM djmdSongPlaylist WHERE rb_local_deleted = 0 ORDER BY PlaylistID, ContentID').all();
const alive = () =>
  db.prepare('SELECT ID FROM djmdContent WHERE rb_local_deleted = 0').all().map((r: any) => r.ID);

describe('applyMerges', () => {
  it('retires the duplicate entries and keeps the chosen one', () => {
    const result = applyMerges(db, [{ keepId: 'keep', removeIds: ['dup1', 'dup2'] }]);
    expect(alive()).toEqual(['keep']);
    expect(result.entriesRemoved).toBe(2);
  });

  it('moves a playlist that held only the duplicate onto the kept entry', () => {
    applyMerges(db, [{ keepId: 'keep', removeIds: ['dup1', 'dup2'] }]);
    // Playlist A had no link to keep, so it must now point at keep — once.
    expect(links().filter((l: any) => l.PlaylistID === 'A')).toEqual([{ PlaylistID: 'A', ContentID: 'keep' }]);
  });

  it('does not add a second link where the playlist already had the kept entry', () => {
    applyMerges(db, [{ keepId: 'keep', removeIds: ['dup1'] }]);
    expect(links().filter((l: any) => l.PlaylistID === 'B')).toEqual([{ PlaylistID: 'B', ContentID: 'keep' }]);
  });

  it('leaves the kept entry alone when it is listed among the removals', () => {
    applyMerges(db, [{ keepId: 'keep', removeIds: ['keep'] }]);
    expect(alive()).toContain('keep');
  });

  it('touches nothing when the plan is empty', () => {
    const before = links();
    applyMerges(db, []);
    expect(links()).toEqual(before);
    expect(alive()).toHaveLength(3);
  });
});

describe('mergeDuplicateEntries safety', () => {
  it('refuses to write while rekordbox is running', () => {
    expect(() => mergeDuplicateEntries(file, 'k', [], {
      backupPath: `${file}.bak`,
      checkRunning: () => true,
    })).toThrow(/close rekordbox/i);
    expect(fs.existsSync(`${file}.bak`)).toBe(false);
  });

  it('refuses to write without a backup path', () => {
    expect(() => mergeDuplicateEntries(file, 'k', [], {
      backupPath: '',
      checkRunning: () => false,
    })).toThrow(/backup/i);
  });
});
