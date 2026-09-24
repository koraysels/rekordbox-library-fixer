import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.unmock('fs');

import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyEntryRemoval, removeEntriesFromDb } from '../../src/main/rekordboxDbWriter';

let file: string;
let db: InstanceType<typeof Database>;

/** Nothing is on disk unless a test says otherwise. */
const nothingExists = () => false;

beforeEach(() => {
  file = path.join(os.tmpdir(), `rm-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = new Database(file);
  db.exec(`
    CREATE TABLE djmdContent (ID TEXT PRIMARY KEY, Title TEXT, FolderPath TEXT, rb_local_deleted INTEGER DEFAULT 0);
    INSERT INTO djmdContent VALUES
      ('gone','Gone','/music/gone.mp3',0),
      ('folder','Folder','/music/album/',0),
      ('here','Here','/music/here.mp3',0),
      ('tidal','Streamed','tidal:tracks:1315162',0);
    CREATE TABLE djmdSongPlaylist (ID TEXT PRIMARY KEY, PlaylistID TEXT, ContentID TEXT);
    INSERT INTO djmdSongPlaylist VALUES ('l1','A','gone'), ('l2','B','gone'), ('l3','A','here');
    CREATE TABLE djmdCue (ID TEXT PRIMARY KEY, ContentID TEXT);
    INSERT INTO djmdCue VALUES ('c1','gone'), ('c2','here');
    CREATE TABLE agentRegistry (registry_id TEXT PRIMARY KEY, int_1 INTEGER);
    INSERT INTO agentRegistry VALUES ('localUpdateCount', 500);
  `);
});

afterEach(() => {
  try { db.close(); } catch { /* already closed */ }
  fs.rmSync(file, { force: true });
});

const alive = () => db.prepare('SELECT ID FROM djmdContent').all().map((r: any) => r.ID);
const counter = () =>
  (db.prepare("SELECT int_1 AS n FROM agentRegistry WHERE registry_id='localUpdateCount'").get() as any).n;

describe('applyEntryRemoval', () => {
  it('removes an entry whose file is gone', () => {
    const out = applyEntryRemoval(db, ['gone'], nothingExists);
    expect(out.entriesRemoved).toBe(1);
    expect(alive()).not.toContain('gone');
  });

  it('takes its playlist links and its cues with it', () => {
    // Nothing can inherit the slots: the entry points at no file.
    const out = applyEntryRemoval(db, ['gone'], nothingExists);
    expect(out.playlistLinksRemoved).toBe(2);
    expect(db.prepare('SELECT ID FROM djmdCue WHERE ContentID=?').get('gone')).toBeUndefined();
    expect(db.prepare('SELECT ID FROM djmdCue WHERE ContentID=?').get('here')).toBeTruthy();
  });

  it('keeps an entry whose file is there after all', () => {
    // A stale list, or a drive that was unmounted during the scan and is back.
    const out = applyEntryRemoval(db, ['here'], (p) => p === '/music/here.mp3');
    expect(out.entriesRemoved).toBe(0);
    expect(out.kept).toEqual([{ trackId: 'here', reason: 'its file is there after all' }]);
    expect(alive()).toContain('here');
  });

  it('never removes a streaming track, however it was asked', () => {
    const out = applyEntryRemoval(db, ['tidal'], nothingExists);
    expect(out.entriesRemoved).toBe(0);
    expect(out.kept[0].reason).toMatch(/streaming/);
    expect(alive()).toContain('tidal');
  });

  it('removes a folder entry, which can never be a file', () => {
    const out = applyEntryRemoval(db, ['folder'], nothingExists);
    expect(out.entriesRemoved).toBe(1);
  });

  it('reports an id that is not in the collection', () => {
    const out = applyEntryRemoval(db, ['ghost'], nothingExists);
    expect(out.kept).toEqual([{ trackId: 'ghost', reason: 'not in the collection' }]);
  });

  it('removes the good ones even when others are kept', () => {
    const out = applyEntryRemoval(db, ['gone', 'here', 'tidal'], (p) => p === '/music/here.mp3');
    expect(out.entriesRemoved).toBe(1);
    expect(out.kept).toHaveLength(2);
    expect(alive().sort()).toEqual(['folder', 'here', 'tidal']);
  });

  it('advances rekordbox\'s update counter', () => {
    applyEntryRemoval(db, ['gone'], nothingExists);
    expect(counter()).toBe(503); // one entry + two playlist links
  });

  it('leaves the counter alone when nothing was removed', () => {
    applyEntryRemoval(db, ['here'], () => true);
    expect(counter()).toBe(500);
  });
});

describe('removeEntriesFromDb guards', () => {
  it('refuses while rekordbox is running', () => {
    expect(() => removeEntriesFromDb(file, 'k', ['gone'], {
      backupPath: `${file}.bak`, checkRunning: () => true,
    })).toThrow(/Close rekordbox first/);
  });

  it('refuses without a backup path', () => {
    expect(() => removeEntriesFromDb(file, 'k', ['gone'], {
      backupPath: '', checkRunning: () => false,
    })).toThrow(/backup path is required/);
  });

  it('makes the backup before it writes', () => {
    db.close();
    const backupPath = `${file}.bak`;
    const out = removeEntriesFromDb(file, '', ['gone'], {
      backupPath, checkRunning: () => false, fileExists: nothingExists,
    });
    expect(out.entriesRemoved).toBe(1);
    const backup = new Database(backupPath, { readonly: true });
    expect(backup.prepare('SELECT ID FROM djmdContent WHERE ID=?').get('gone')).toBeTruthy();
    backup.close();
    fs.rmSync(backupPath, { force: true });
  });
});
