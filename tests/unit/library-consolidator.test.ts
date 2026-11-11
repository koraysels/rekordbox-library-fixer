import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.unmock('fs');

import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LibraryConsolidator, type ConsolidateOptions } from '../../src/main/libraryConsolidator';
import { runConsolidate, type ConsolidateRunDeps } from '../../src/main/consolidateRun';
import type { TrackPayload } from '../../src/main/ipcContract';
import { relocateTracksInDb, type RelocateOptions, type RelocationPlan } from '../../src/main/rekordboxDbRelocator';

let root: string;
let src: string;
let dest: string;

const write = (p: string, body: string) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};
const read = (p: string) => fs.readFileSync(p, 'utf8');
const track = (id: string, location: string): TrackPayload => ({ id, name: `Song ${id}`, artist: 'A', location });
const noProgress = () => undefined;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'consolidate-'));
  src = path.join(root, 'Old');
  dest = path.join(root, 'New');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('LibraryConsolidator.consolidate', () => {
  const copy: ConsolidateOptions = { destination: '', mode: 'copy' };

  it('never overwrites a different file at the destination: the source lands at " (2)"', async () => {
    const a = write(path.join(src, 'House', 'a.mp3'), 'SOURCE');
    write(path.join(src, 'Techno', 'b.mp3'), 'B');
    const there = write(path.join(dest, 'House', 'a.mp3'), 'SOMETHING ELSE');

    const result = await new LibraryConsolidator().consolidate(
      [track('1', a), track('2', path.join(src, 'Techno', 'b.mp3'))],
      { ...copy, destination: dest }, noProgress, { cancelled: false },
    );

    expect(read(there)).toBe('SOMETHING ELSE');
    expect(read(path.join(dest, 'House', 'a (2).mp3'))).toBe('SOURCE');
    expect(result.locationUpdates[a]).toBe(path.join(dest, 'House', 'a (2).mp3'));
    expect(result.failed).toBe(0);
  });

  it('reuses an identical file already at the destination instead of copying', async () => {
    const a = write(path.join(src, 'House', 'a.mp3'), 'SAME');
    const b = write(path.join(src, 'Techno', 'b.mp3'), 'B');
    const there = write(path.join(dest, 'House', 'a.mp3'), 'SAME');

    const result = await new LibraryConsolidator().consolidate(
      [track('1', a), track('2', b)], { ...copy, destination: dest }, noProgress, { cancelled: false },
    );

    expect(result.locationUpdates[a]).toBe(there);
    expect(fs.existsSync(path.join(dest, 'House', 'a (2).mp3'))).toBe(false);
    expect(result.skipped).toBe(1);
    expect(result.placed).toContainEqual(expect.objectContaining({ from: a, to: there, kind: 'reused' }));
  });

  it('moves a file two entries share once, and points both at it', async () => {
    const a = write(path.join(src, 'House', 'a.mp3'), 'A');
    const b = write(path.join(src, 'Techno', 'b.mp3'), 'B');

    const result = await new LibraryConsolidator().consolidate(
      [track('1', a), track('2', a), track('3', b)],
      { destination: dest, mode: 'move' }, noProgress, { cancelled: false },
    );

    expect(fs.existsSync(a)).toBe(false);
    expect(read(path.join(dest, 'House', 'a.mp3'))).toBe('A');
    expect(fs.existsSync(path.join(dest, 'House', 'a (2).mp3'))).toBe(false);
    expect(result.locationUpdates[a]).toBe(path.join(dest, 'House', 'a.mp3'));
    expect(result.failed).toBe(0);
  });

  it('never counts a file as its own identical copy (a hard link or an aliased folder)', async () => {
    const a = write(path.join(src, 'House', 'a.mp3'), 'A');
    const b = write(path.join(src, 'Techno', 'b.mp3'), 'B');
    fs.mkdirSync(path.join(dest, 'House'), { recursive: true });
    fs.linkSync(a, path.join(dest, 'House', 'a.mp3'));

    const result = await new LibraryConsolidator().consolidate(
      [track('1', a), track('2', b)], { destination: dest, mode: 'move' }, noProgress, { cancelled: false },
    );

    expect(result.placed.filter((p) => p.removeOriginal).map((p) => p.from)).not.toContain(a);
    expect(result.locationUpdates[a]).toBeUndefined();
  });

  it('leaves a location that names a folder alone', async () => {
    const folder = path.join(src, 'House');
    write(path.join(folder, 'a.mp3'), 'A');
    const b = write(path.join(src, 'Techno', 'b.mp3'), 'B');

    const result = await new LibraryConsolidator().consolidate(
      [track('1', folder), track('2', b)], { destination: dest, mode: 'move' }, noProgress, { cancelled: false },
    );

    expect(fs.existsSync(path.join(folder, 'a.mp3'))).toBe(true);
    expect(result.locationUpdates[folder]).toBeUndefined();
  });
});

// ─── The run behind 'consolidate-library' ───────────────────────────────────

let dbPath: string;

function makeDb(rows: Array<[string, string]>) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE djmdContent (
      ID TEXT PRIMARY KEY, Title TEXT, FolderPath TEXT, FileNameL TEXT, Length INTEGER, BitRate INTEGER,
      FileSize INTEGER, BPM INTEGER, Rating INTEGER, created_at TEXT, FileType INTEGER, SampleRate INTEGER,
      BitDepth INTEGER, ArtistID TEXT, AlbumID TEXT, GenreID TEXT, rb_local_usn INTEGER,
      rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdArtist (ID TEXT PRIMARY KEY, Name TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdAlbum (ID TEXT PRIMARY KEY, Name TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdGenre (ID TEXT PRIMARY KEY, Name TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdCue (ID TEXT PRIMARY KEY, ContentID TEXT, Kind INTEGER, InMsec INTEGER, OutMsec INTEGER,
      Comment TEXT, rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdPlaylist (ID TEXT PRIMARY KEY, Name TEXT, ParentID TEXT, Attribute INTEGER, Seq INTEGER,
      rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE djmdSongPlaylist (ID TEXT PRIMARY KEY, PlaylistID TEXT, ContentID TEXT, TrackNo INTEGER,
      rb_local_deleted INTEGER DEFAULT 0);
    CREATE TABLE agentRegistry (registry_id TEXT PRIMARY KEY, int_1 INTEGER);
    INSERT INTO agentRegistry VALUES ('localUpdateCount', 100);
  `);
  const insert = db.prepare('INSERT INTO djmdContent (ID, Title, FolderPath, FileNameL, rb_local_usn) VALUES (?, ?, ?, ?, 10)');
  for (const [id, loc] of rows) {insert.run(id, `Song ${id}`, loc, path.basename(loc));}
  db.close();
}

const locationOf = (id: string) => {
  const db = new Database(dbPath, { readonly: true });
  try {
    return (db.prepare('SELECT FolderPath AS p FROM djmdContent WHERE ID = ?').get(id) as { p: string }).p;
  } finally { db.close(); }
};

function deps(over: Partial<ConsolidateRunDeps> = {}): ConsolidateRunDeps {
  return {
    consolidator: new LibraryConsolidator(),
    onProgress: vi.fn(),
    cancelToken: { cancelled: false },
    checkRunning: () => false,
    backupPath: (p) => `${p}.backup.test`,
    ...over,
  };
}

describe('runConsolidate on a rekordbox database', () => {
  beforeEach(() => { dbPath = path.join(root, 'master.db'); });

  it('refuses without the key, in plain words, before touching a file', async () => {
    const a = write(path.join(src, 'House', 'a.mp3'), 'A');
    makeDb([['t1', a]]);

    const result = await runConsolidate(
      { tracks: [track('t1', a)], libraryPath: dbPath, options: { destination: dest, mode: 'move' } },
      deps(),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/key/i);
    expect(result.error).not.toMatch(/undefined|TypeError/);
    expect(fs.existsSync(a)).toBe(true);
    expect(fs.existsSync(dest)).toBe(false);
  });

  it('refuses while rekordbox runs, before touching a file', async () => {
    const a = write(path.join(src, 'House', 'a.mp3'), 'A');
    makeDb([['t1', a]]);

    const result = await runConsolidate(
      { tracks: [track('t1', a)], libraryPath: dbPath, dbKey: 'k', options: { destination: dest, mode: 'move' } },
      deps({ checkRunning: () => true }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Close rekordbox to continue');
    expect(fs.existsSync(a)).toBe(true);
  });

  it('writes the new locations into the database, with a backup', async () => {
    const a = write(path.join(src, 'House', 'a.mp3'), 'A');
    const b = write(path.join(src, 'Techno', 'b.mp3'), 'B');
    makeDb([['t1', a], ['t2', b], ['t3', a]]);
    // The temp database is unencrypted; a real key would not open it.
    const relocate = vi.fn((db: string, _key: string, plans: RelocationPlan[], opts: RelocateOptions) =>
      relocateTracksInDb(db, '', plans, opts));

    const result = await runConsolidate(
      {
        tracks: [track('t1', a), track('t2', b), track('t3', a)],
        libraryPath: dbPath, dbKey: 'k', options: { destination: dest, mode: 'copy' },
      },
      deps({ relocate, readDb: async () => [{ id: 't1', location: a }, { id: 't2', location: b }, { id: 't3', location: a }] }),
    );

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(locationOf('t1')).toBe(path.join(dest, 'House', 'a.mp3'));
    expect(locationOf('t3')).toBe(path.join(dest, 'House', 'a.mp3'));
    expect(locationOf('t2')).toBe(path.join(dest, 'Techno', 'b.mp3'));
    expect(result.data?.entriesUpdated).toBe(3);
    expect(result.data?.backupPath).toBe(`${dbPath}.backup.test`);
    expect(fs.existsSync(`${dbPath}.backup.test`)).toBe(true);
    // Copy keeps the originals.
    expect(fs.existsSync(a)).toBe(true);
  });

  it('puts every file back when the database write fails', async () => {
    const a = write(path.join(src, 'House', 'a.mp3'), 'A');
    const b = write(path.join(src, 'Techno', 'b.mp3'), 'B');
    makeDb([['t1', a], ['t2', b]]);

    const result = await runConsolidate(
      { tracks: [track('t1', a), track('t2', b)], libraryPath: dbPath, dbKey: 'k', options: { destination: dest, mode: 'move' } },
      deps({
        readDb: async () => [{ id: 't1', location: a }, { id: 't2', location: b }],
        relocate: () => { throw new Error('disk full'); },
      }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not changed/);
    expect(read(a)).toBe('A');
    expect(read(b)).toBe('B');
    expect(fs.existsSync(path.join(dest, 'House', 'a.mp3'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'Techno', 'b.mp3'))).toBe(false);
  });

  it('removes a moved original only after the write, when it was copied across drives', async () => {
    const a = write(path.join(src, 'House', 'a.mp3'), 'A');
    const b = write(path.join(src, 'Techno', 'b.mp3'), 'B');
    makeDb([['t1', a], ['t2', b]]);
    let originalAtWrite: boolean | undefined;
    const exdev = Object.assign(new Error('cross-device'), { code: 'EXDEV' });

    const result = await runConsolidate(
      { tracks: [track('t1', a), track('t2', b)], libraryPath: dbPath, dbKey: 'k', options: { destination: dest, mode: 'move' } },
      deps({
        consolidator: new LibraryConsolidator({ rename: async () => { throw exdev; } }),
        readDb: async () => [{ id: 't1', location: a }, { id: 't2', location: b }],
        relocate: (_db, _key, plans, opts) => {
          originalAtWrite = fs.existsSync(a);
          return { tracksRelocated: plans.length, skipped: [], backupPath: opts.backupPath };
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(originalAtWrite).toBe(true);
    expect(fs.existsSync(a)).toBe(false);
    expect(read(path.join(dest, 'House', 'a.mp3'))).toBe('A');
  });
});
