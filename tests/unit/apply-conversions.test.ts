import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.unmock('fs');

import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  applySwitchesToDb, switchEntriesInDb, switchEntriesInXml, FILE_TYPE_FOR, KIND_FOR, type EntrySwitch,
} from '../../src/main/convert/applyConversions';
import { RekordboxParser } from '../../src/main/rekordboxParser';
import { DATABASE_IS_READ_ONLY } from '../../src/main/librarySource';

let file: string;
let db: InstanceType<typeof Database>;
const yes = () => true;

const sw = (over: Partial<EntrySwitch> = {}): EntrySwitch => ({
  trackId: 't1', newLocation: '/new/Song.aiff', target: 'aiff', sizeBytes: 5000,
  out: { format: 'aiff', sampleRate: 44100, bitDepth: 16, bitrateKbps: 1411 }, ...over,
});

beforeEach(() => {
  file = path.join(os.tmpdir(), `ac-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = new Database(file);
  db.exec(`
    CREATE TABLE djmdContent (
      ID TEXT PRIMARY KEY, Title TEXT, FolderPath TEXT, FileNameL TEXT, FileType INTEGER,
      FileSize INTEGER, BitRate INTEGER, BitDepth INTEGER, SampleRate INTEGER,
      AnalysisDataPath TEXT, OrgFolderPath TEXT, rb_file_id TEXT, rb_local_usn INTEGER,
      rb_local_deleted INTEGER DEFAULT 0);
    INSERT INTO djmdContent VALUES
      ('t1','Song','/old/Song.flac','Song.flac',5,999,900,24,48000,'/analysis/ANLZ0.DAT','/orig/Song.flac','555',10,0),
      ('t2','Other','/old/Other.flac','Other.flac',5,999,900,24,48000,'/analysis/ANLZ1.DAT','/orig/Other.flac','556',10,0);
    CREATE TABLE djmdCue (ID TEXT PRIMARY KEY, ContentID TEXT);
    INSERT INTO djmdCue VALUES ('c1','t1');
    CREATE TABLE agentRegistry (registry_id TEXT PRIMARY KEY, int_1 INTEGER);
    INSERT INTO agentRegistry VALUES ('localUpdateCount', 100);
  `);
});

afterEach(() => {
  try { db.close(); } catch { /* closed */ }
  fs.rmSync(file, { force: true });
});

const tmpFiles: string[] = [];
afterEach(() => { for (const f of tmpFiles.splice(0)) { fs.rmSync(f, { force: true }); } });

const row = (id: string) => db.prepare('SELECT * FROM djmdContent WHERE ID = ?').get(id) as any;

describe('constants', () => {
  it('uses rekordbox file types and kinds', () => {
    expect(FILE_TYPE_FOR).toEqual({ aiff: 12, wav: 11, mp3: 1 });
    expect(KIND_FOR).toEqual({ aiff: 'AIFF File', wav: 'WAV File', mp3: 'MP3 File' });
  });
});

describe('applySwitchesToDb', () => {
  it('switches the entry and every file-describing column, nothing else', () => {
    const before = row('t1');
    const t2Before = row('t2');
    const out = applySwitchesToDb(db, [sw()], yes);
    expect(out.switched).toBe(1);
    const after = row('t1');
    const changed = Object.keys(after).filter((k) => after[k] !== before[k]).sort();
    expect(changed).toEqual(
      ['BitDepth', 'BitRate', 'FileNameL', 'FileSize', 'FileType', 'FolderPath', 'SampleRate', 'rb_local_usn'].sort()
    );
    expect(after).toMatchObject({
      FolderPath: '/new/Song.aiff', FileNameL: 'Song.aiff', FileType: 12, FileSize: 5000,
      BitRate: 1411, BitDepth: 16, SampleRate: 44100,
    });
    expect(after.AnalysisDataPath).toBe('/analysis/ANLZ0.DAT');
    expect(db.prepare('SELECT ID FROM djmdCue WHERE ContentID = ?').get('t1')).toBeTruthy();
    expect(row('t2')).toEqual(t2Before);
  });

  it('writes 16 for the bit depth of an MP3, as rekordbox does', () => {
    applySwitchesToDb(db, [sw({ newLocation: '/new/Song.mp3', target: 'mp3',
      out: { format: 'mp3', sampleRate: 44100, bitrateKbps: 320 } })], yes);
    expect(row('t1')).toMatchObject({ FileType: 1, BitRate: 320, BitDepth: 16 });
  });

  it('bumps rb_local_usn and the counter', () => {
    applySwitchesToDb(db, [sw()], yes);
    expect(row('t1').rb_local_usn).toBe(101);
    expect((db.prepare("SELECT int_1 n FROM agentRegistry").get() as any).n).toBe(101);
  });

  it('skips a track that is gone or whose new file is missing', () => {
    const gone = applySwitchesToDb(db, [sw({ trackId: 'ghost' })], yes);
    expect(gone.switched).toBe(0);
    expect(gone.skipped[0]).toEqual({ trackId: 'ghost', reason: 'not in the collection' });
    const nofile = applySwitchesToDb(db, [sw()], () => false);
    expect(nofile.switched).toBe(0);
    expect(nofile.skipped[0]).toEqual({ trackId: 't1', reason: 'the file is not there' });
    expect(row('t1').FolderPath).toBe('/old/Song.flac');
  });
});

describe('applySwitchesToDb edge cases', () => {
  it('skips a deleted row and leaves it untouched', () => {
    db.prepare("UPDATE djmdContent SET rb_local_deleted = 1 WHERE ID = 't1'").run();
    const before = row('t1');
    const out = applySwitchesToDb(db, [sw()], yes);
    expect(out.switched).toBe(0);
    expect(out.skipped[0]).toEqual({ trackId: 't1', reason: 'not in the collection' });
    expect(row('t1')).toEqual(before);
  });

  it('rolls back earlier rows and the usn counter when a later one throws', () => {
    const before = row('t1');
    // The second switch carries a value SQLite cannot bind.
    const bad = sw({ trackId: 't2', sizeBytes: Symbol('x') as unknown as number });
    expect(() => applySwitchesToDb(db, [sw(), bad], yes)).toThrow();
    expect(row('t1')).toEqual(before);
    expect((db.prepare('SELECT int_1 n FROM agentRegistry').get() as any).n).toBe(100);
  });
});

describe('switchEntriesInDb', () => {
  it('refuses while rekordbox runs and does not touch the file', () => {
    db.close();
    const sizeBefore = fs.statSync(file).size;
    const backupPath = `${file}.bak`;
    expect(() => switchEntriesInDb(file, 'k', [sw()], { backupPath, checkRunning: () => true }))
      .toThrow(/Close rekordbox first/);
    expect(fs.statSync(file).size).toBe(sizeBefore);
    expect(fs.existsSync(backupPath)).toBe(false);
  });

  it('requires a backup path', () => {
    db.close();
    expect(() => switchEntriesInDb(file, 'k', [sw()], { backupPath: '', checkRunning: () => false }))
      .toThrow(/backup path is required/);
  });
});

describe('switchEntriesInXml', () => {
  it('rewrites Location, Kind, BitRate, Size, SampleRate and keeps cues and TEMPO', async () => {
    const xmlPath = path.join(os.tmpdir(), `ac-${Date.now()}.xml`);
    tmpFiles.push(xmlPath);
    fs.writeFileSync(xmlPath, `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0"><PRODUCT Name="rekordbox" Version="6.0.0" Company="Pioneer DJ"/>
<COLLECTION Entries="1"><TRACK TrackID="1" Name="Song" Artist="A" Kind="FLAC File" Size="999" BitRate="900" SampleRate="48000" Location="file://localhost/old/Song.flac">
<TEMPO Inizio="0.1" Bpm="128.00" Metro="4/4" Battito="1"/>
<POSITION_MARK Name="c" Type="CUE" Start="1.5" Num="0"/></TRACK></COLLECTION>
<PLAYLISTS><NODE Type="0" Name="ROOT" Count="0"/></PLAYLISTS></DJ_PLAYLISTS>`);
    const parser = new RekordboxParser();
    const library = await parser.parseLibrary(xmlPath);
    const out = await switchEntriesInXml(xmlPath, library, [sw({ trackId: '1' })], yes);
    tmpFiles.push(out.backupPath);
    expect(out.switched).toBe(1);
    expect(fs.existsSync(out.backupPath)).toBe(true);
    expect(fs.readFileSync(out.backupPath, 'utf-8')).toContain('Song.flac');
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    expect(xml).toContain('Kind="AIFF File"');
    expect(xml).toContain('BitRate="1411"');
    expect(xml).toContain('Size="5000"');
    expect(xml).toContain('SampleRate="44100"');
    expect(xml).toContain('Location="file://localhost/new/Song.aiff"');
    expect(xml).toContain('TEMPO');
    expect(xml).toContain('Battito="1"');
    expect(xml).toContain('POSITION_MARK');
  });

  it('refuses a database path', async () => {
    const library = { tracks: new Map(), playlists: [], version: '1' } as any;
    await expect(switchEntriesInXml('/x/master.db', library, [])).rejects.toThrow(DATABASE_IS_READ_ONLY);
  });

  it('skips a missing file and an unknown track, writing nothing for them', async () => {
    const xmlPath = path.join(os.tmpdir(), `ac-skip-${Date.now()}.xml`);
    tmpFiles.push(xmlPath);
    fs.writeFileSync(xmlPath, '<DJ_PLAYLISTS Version="1.0.0"><COLLECTION Entries="1"><TRACK TrackID="1" Name="S" Location="file://localhost/old/S.flac"/></COLLECTION><PLAYLISTS><NODE Type="0" Name="ROOT" Count="0"/></PLAYLISTS></DJ_PLAYLISTS>');
    const library = await new RekordboxParser().parseLibrary(xmlPath);
    const before = fs.readFileSync(xmlPath, 'utf-8');
    const out = await switchEntriesInXml(xmlPath, library,
      [sw({ trackId: '1' }), sw({ trackId: '9' })], (p) => false);
    tmpFiles.push(out.backupPath);
    expect(out.switched).toBe(0);
    expect(out.skipped).toHaveLength(2);
    expect(fs.readFileSync(xmlPath, 'utf-8')).toBe(before);
    const out2 = await switchEntriesInXml(xmlPath, library, [sw({ trackId: '9' })], yes);
    tmpFiles.push(out2.backupPath);
    expect(out2.skipped[0]).toEqual({ trackId: '9', reason: 'not in the collection' });
  });
});
