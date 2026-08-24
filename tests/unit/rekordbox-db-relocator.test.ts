import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.unmock('fs');

import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyRelocations, relocateTracksInDb } from '../../src/main/rekordboxDbRelocator';

let file: string;
let db: InstanceType<typeof Database>;

/** Every path the tests relocate to counts as an existing file. */
const anyFileExists = () => true;

beforeEach(() => {
  file = path.join(os.tmpdir(), `rl-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = new Database(file);
  db.exec(`
    CREATE TABLE djmdContent (
      ID TEXT PRIMARY KEY, Title TEXT, FolderPath TEXT, FileNameL TEXT,
      OrgFolderPath TEXT, rb_file_id TEXT, rb_local_usn INTEGER, rb_local_deleted INTEGER DEFAULT 0);
    INSERT INTO djmdContent VALUES
      ('t1','Song','/old/gone/Song.mp3','Song.mp3','/orig/Song.mp3','555', 10, 0),
      ('t2','Other','/old/gone/Other.mp3','Other.mp3','/orig/Other.mp3','556', 10, 0);
    CREATE TABLE djmdCue (ID TEXT PRIMARY KEY, ContentID TEXT);
    INSERT INTO djmdCue VALUES ('c1','t1');
    CREATE TABLE agentRegistry (registry_id TEXT PRIMARY KEY, int_1 INTEGER);
    INSERT INTO agentRegistry VALUES ('localUpdateCount', 100);
  `);
});

afterEach(() => {
  try { db.close(); } catch { /* already closed */ }
  fs.rmSync(file, { force: true });
});

const track = (id: string) => db.prepare('SELECT * FROM djmdContent WHERE ID = ?').get(id) as any;
const counter = () =>
  (db.prepare("SELECT int_1 AS n FROM agentRegistry WHERE registry_id='localUpdateCount'").get() as any).n;

describe('applyRelocations', () => {
  it('points the track at its new file', () => {
    const out = applyRelocations(db, [{ trackId: 't1', newLocation: '/new/place/Song.mp3' }], anyFileExists);
    expect(out.tracksRelocated).toBe(1);
    expect(track('t1').FolderPath).toBe('/new/place/Song.mp3');
  });

  it('updates the stored filename when the file was renamed', () => {
    applyRelocations(db, [{ trackId: 't1', newLocation: '/new/Song (Remastered).mp3' }], anyFileExists);
    expect(track('t1').FileNameL).toBe('Song (Remastered).mp3');
  });

  it('leaves everything else about the track alone', () => {
    // Cues, the analysis link and the original path must survive, or relocating
    // would cost the DJ their hot cues and beatgrid.
    applyRelocations(db, [{ trackId: 't1', newLocation: '/new/Song.mp3' }], anyFileExists);
    const row = track('t1');
    expect(row.rb_file_id).toBe('555');
    expect(row.OrgFolderPath).toBe('/orig/Song.mp3');
    expect(row.Title).toBe('Song');
    expect(db.prepare('SELECT ID FROM djmdCue WHERE ContentID = ?').get('t1')).toBeTruthy();
  });

  it('does not touch tracks that were not in the plan', () => {
    applyRelocations(db, [{ trackId: 't1', newLocation: '/new/Song.mp3' }], anyFileExists);
    expect(track('t2').FolderPath).toBe('/old/gone/Other.mp3');
  });

  it('refuses a path where no file exists', () => {
    // Writing an unverified path turns a findable track into an unfindable one.
    const out = applyRelocations(db, [{ trackId: 't1', newLocation: '/nope/Song.mp3' }], () => false);
    expect(out.tracksRelocated).toBe(0);
    expect(out.skipped[0]).toEqual({ trackId: 't1', reason: 'the file is not there' });
    expect(track('t1').FolderPath).toBe('/old/gone/Song.mp3');
  });

  it('skips a track that is not in the collection', () => {
    const out = applyRelocations(db, [{ trackId: 'ghost', newLocation: '/new/Song.mp3' }], anyFileExists);
    expect(out.tracksRelocated).toBe(0);
    expect(out.skipped[0].reason).toBe('not in the collection');
  });

  it('skips a plan with no new location', () => {
    const out = applyRelocations(db, [{ trackId: 't1', newLocation: '' }], anyFileExists);
    expect(out.skipped[0].reason).toBe('no new location');
  });

  it('applies the good plans even when others are skipped', () => {
    const out = applyRelocations(db, [
      { trackId: 't1', newLocation: '/new/Song.mp3' },
      { trackId: 'ghost', newLocation: '/new/Ghost.mp3' },
    ], anyFileExists);
    expect(out.tracksRelocated).toBe(1);
    expect(out.skipped).toHaveLength(1);
  });

  it('gives each changed row the next update number', () => {
    // Rekordbox spots changes by comparing a row's usn with the counter; a row
    // left behind the counter is a change rekordbox never notices.
    applyRelocations(db, [
      { trackId: 't1', newLocation: '/new/Song.mp3' },
      { trackId: 't2', newLocation: '/new/Other.mp3' },
    ], anyFileExists);
    expect(counter()).toBe(102);
    expect(track('t1').rb_local_usn).toBe(101);
    expect(track('t2').rb_local_usn).toBe(102);
  });

  it('does not burn an update number on a skipped track', () => {
    applyRelocations(db, [{ trackId: 't1', newLocation: '/nope.mp3' }], () => false);
    expect(counter()).toBe(100);
  });

  it('works on a schema without the update counter', () => {
    db.exec('DROP TABLE agentRegistry');
    const out = applyRelocations(db, [{ trackId: 't1', newLocation: '/new/Song.mp3' }], anyFileExists);
    expect(out.tracksRelocated).toBe(1);
    expect(track('t1').rb_local_usn).toBe(10); // left as it was rather than nulled
  });
});

describe('relocateTracksInDb guards', () => {
  const plans = [{ trackId: 't1', newLocation: '/new/Song.mp3' }];

  it('refuses while rekordbox is running', () => {
    expect(() => relocateTracksInDb(file, 'k', plans, {
      backupPath: `${file}.bak`, checkRunning: () => true,
    })).toThrow(/Close rekordbox first/);
  });

  it('refuses without a backup path', () => {
    expect(() => relocateTracksInDb(file, 'k', plans, {
      backupPath: '', checkRunning: () => false,
    })).toThrow(/backup path is required/);
  });

  it('makes the backup before it writes', () => {
    db.close();
    const backupPath = `${file}.bak`;
    relocateTracksInDb(file, '', plans, {
      backupPath, checkRunning: () => false, isRegularFile: anyFileExists,
    });
    expect(fs.existsSync(backupPath)).toBe(true);
    // The backup still holds the pre-relocation path.
    const backup = new Database(backupPath, { readonly: true });
    expect((backup.prepare('SELECT FolderPath AS p FROM djmdContent WHERE ID=?').get('t1') as any).p)
      .toBe('/old/gone/Song.mp3');
    backup.close();
    fs.rmSync(backupPath, { force: true });
  });
});
