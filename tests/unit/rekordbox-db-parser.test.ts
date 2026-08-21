import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as path from 'path';
import { mapRowsToLibrary } from '../../src/main/rekordboxDbParser';

let file: string;
let db: InstanceType<typeof Database>;

beforeEach(() => {
  file = path.join(process.cwd(), `.dbtest-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = new Database(file);
  db.exec(`
    CREATE TABLE djmdArtist (ID TEXT PRIMARY KEY, Name TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdAlbum  (ID TEXT PRIMARY KEY, Name TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdGenre  (ID TEXT PRIMARY KEY, Name TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdContent (
      ID TEXT PRIMARY KEY, Title TEXT, ArtistID TEXT, AlbumID TEXT, GenreID TEXT,
      FolderPath TEXT, Length INTEGER, BitRate INTEGER, FileSize INTEGER,
      BPM INTEGER, Rating INTEGER, created_at TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdCue (
      ID TEXT PRIMARY KEY, ContentID TEXT, Kind INTEGER, InMsec INTEGER,
      OutMsec INTEGER, Comment TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdPlaylist (
      ID TEXT PRIMARY KEY, Name TEXT, ParentID TEXT, Attribute INTEGER,
      Seq INTEGER, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdSongPlaylist (
      ID TEXT PRIMARY KEY, PlaylistID TEXT, ContentID TEXT, TrackNo INTEGER,
      rb_local_deleted INTEGER DEFAULT 0);
  `);
  db.exec(`
    INSERT INTO djmdArtist VALUES ('a1','Roméo Elvis',0);
    INSERT INTO djmdAlbum  VALUES ('al1','Morale',0);
    INSERT INTO djmdGenre  VALUES ('g1','Hip Hop',0);
    INSERT INTO djmdContent VALUES
      ('t1','Bruxelles arrive','a1','al1','g1','/Music/bx.mp3',217,320,8000000,14000,4,'2020-10-03 12:14:15.969 +00:00',0);
    INSERT INTO djmdContent VALUES
      ('t2','Deleted','a1','al1','g1','/Music/gone.mp3',100,128,1000,8750,0,'2021-01-01 00:00:00 +00:00',1);
    INSERT INTO djmdCue VALUES ('c1','t1',0,15000,-1,'Intro',0);
    INSERT INTO djmdCue VALUES ('c2','t1',3,30000,45000,'Loop A',0);
    INSERT INTO djmdCue VALUES ('c3','t1',2,60000,-1,'Hot B',0);
    INSERT INTO djmdPlaylist VALUES ('p0','Crates',NULL,1,0,0);
    INSERT INTO djmdPlaylist VALUES ('p1','Gig',  'p0',0,1,0);
    INSERT INTO djmdSongPlaylist VALUES ('sp1','p1','t1',1,0);
  `);
  db.close();
  db = new Database(file, { readonly: true });
});

afterEach(() => {
  db.close();
  fs.rmSync(file, { force: true });
});

describe('mapRowsToLibrary', () => {
  it('maps a track with its joined artist, album and genre', () => {
    const t = mapRowsToLibrary(db, file).tracks.get('t1')!;
    expect(t.name).toBe('Bruxelles arrive');
    expect(t.artist).toBe('Roméo Elvis');
    expect(t.album).toBe('Morale');
    expect(t.genre).toBe('Hip Hop');
    expect(t.location).toBe('/Music/bx.mp3');
    expect(t.duration).toBe(217);
    expect(t.bitrate).toBe(320);
    expect(t.size).toBe(8000000);
    expect(t.rating).toBe(4);
  });

  it('scales BPM down by 100, as rekordbox stores it', () => {
    expect(mapRowsToLibrary(db, file).tracks.get('t1')!.bpm).toBe(140);
  });

  it('skips rows marked rb_local_deleted', () => {
    const lib = mapRowsToLibrary(db, file);
    expect(lib.tracks.has('t2')).toBe(false);
    expect(lib.tracks.size).toBe(1);
  });

  it('treats only a positive OutMsec as a loop (ordinary cues store -1)', () => {
    const t = mapRowsToLibrary(db, file).tracks.get('t1')!;
    expect(t.loops).toHaveLength(1);
    expect(t.loops[0]).toMatchObject({ start: 30, end: 45, name: 'Loop A' });
    expect(t.cues).toHaveLength(2);
    expect(t.cues.map((c) => c.start).sort()).toEqual([15, 60]);
  });

  it('records the hotcue slot from Kind, leaving memory cues (Kind 0) without one', () => {
    const t = mapRowsToLibrary(db, file).tracks.get('t1')!;
    expect(t.cues.find((c) => c.start === 15)!.hotcue).toBeUndefined();
    expect(t.cues.find((c) => c.start === 60)!.hotcue).toBe(2);
  });

  it('parses created_at into a date', () => {
    const t = mapRowsToLibrary(db, file).tracks.get('t1')!;
    expect(t.dateAdded?.getUTCFullYear()).toBe(2020);
  });

  it('nests playlists under their folder and lists their track ids', () => {
    const lib = mapRowsToLibrary(db, file);
    expect(lib.playlists).toHaveLength(1);
    expect(lib.playlists[0]).toMatchObject({ name: 'Crates', type: 'FOLDER' });
    expect(lib.playlists[0].children![0]).toMatchObject({
      name: 'Gig', type: 'PLAYLIST', tracks: ['t1'],
    });
  });

  it('uses the database path as the library path', () => {
    expect(mapRowsToLibrary(db, file).libraryPath).toBe(file);
  });
});
