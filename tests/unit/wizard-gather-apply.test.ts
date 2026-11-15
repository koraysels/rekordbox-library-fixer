import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.unmock('fs');

import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyGather } from '../../src/main/wizard/gatherApply';
import type { GatherMove, GatherStepPlan } from '../../src/main/wizard/types';

let root: string;
let dbPath: string;
let music: string;

/** The tables `parseDb` reads, with just the columns it and the relocator touch. */
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
  insert.run('cue-holder', 'Cue holder', '/elsewhere/c.mp3', 'c.mp3');
  db.prepare("INSERT INTO djmdCue VALUES ('c1', ?, 1, 1000, -1, '', 0)").run(rows[0]?.[0] ?? 'cue-holder');
  db.close();
}

const locationOf = (id: string) => {
  const db = new Database(dbPath, { readonly: true });
  try {
    return (db.prepare('SELECT FolderPath AS p, FileNameL AS n FROM djmdContent WHERE ID = ?').get(id) as any);
  } finally { db.close(); }
};

const write = (p: string, body: string) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};
const read = (p: string) => fs.readFileSync(p, 'utf8');

const move = (over: Partial<GatherMove> & Pick<GatherMove, 'from' | 'to' | 'trackIds'>): GatherMove => ({
  name: `Song ${over.trackIds[0]}`, crossDrive: false, reuseExisting: false, bytes: 0, ...over,
});
const planOf = (...moves: GatherMove[]): GatherStepPlan => ({
  step: 'gather', moves, unplugged: [], bytesCrossDrive: 0, freeBytes: 0,
});

function ctx(over: Partial<Parameters<typeof applyGather>[1]> = {}) {
  return {
    dbPath,
    key: '',
    backupPath: `${dbPath}.backup.test`,
    signal: new AbortController().signal,
    onProgress: vi.fn(),
    checkRunning: () => false,
    trash: vi.fn(async (_p: string) => undefined),
    ...over,
  };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'gather-'));
  dbPath = path.join(root, 'master.db');
  music = path.join(root, 'Music');
  fs.mkdirSync(music);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('applyGather', () => {
  it('renames a file on the same drive and switches its entry', async () => {
    const from = write(path.join(root, 'Downloads', 'Promos', 'a.mp3'), 'AAA');
    const to = path.join(music, 'Promos', 'a.mp3');
    makeDb([['t1', from]]);
    const c = ctx();

    const result = await applyGather(planOf(move({ trackIds: ['t1'], from, to })), c);

    expect(result.error).toBeUndefined();
    expect(result.changed).toBe(1);
    expect(fs.existsSync(from)).toBe(false);
    expect(read(to)).toBe('AAA');
    expect(locationOf('t1')).toEqual({ p: to, n: 'a.mp3' });
    expect(result.details).toContainEqual(expect.objectContaining({ action: 'moved', from, to }));
    expect(result.backupPath).toBe(`${dbPath}.backup.test`);
    expect(fs.existsSync(result.backupPath!)).toBe(true);
    // A same-drive move leaves nothing behind to trash.
    expect(c.trash).not.toHaveBeenCalled();
  });

  it('copies across drives, switches the entry, and only then trashes the original', async () => {
    const from = write(path.join(root, 'Other', 'Promos', 'a.mp3'), 'AAA');
    const to = path.join(music, 'Promos', 'a.mp3');
    makeDb([['t1', from]]);
    let entryAtTrash: string | undefined;
    const trash = vi.fn(async (_p: string) => { entryAtTrash = locationOf('t1').p; });

    const result = await applyGather(planOf(move({ trackIds: ['t1'], from, to, crossDrive: true })), ctx({ trash }));

    expect(result.error).toBeUndefined();
    expect(read(to)).toBe('AAA');
    expect(fs.existsSync(`${to}.part`)).toBe(false);
    expect(locationOf('t1').p).toBe(to);
    expect(trash).toHaveBeenCalledWith(from);
    expect(entryAtTrash).toBe(to);
    expect(result.details.map((d) => d.action)).toEqual(['copied', 'trashed']);
  });

  it('keeps an original another entry still uses', async () => {
    const from = write(path.join(root, 'Other', 'Promos', 'a.mp3'), 'AAA');
    const to = path.join(music, 'Promos', 'a.mp3');
    // t2 was added after the plan, so the plan does not carry it.
    makeDb([['t1', from], ['t2', from]]);
    const c = ctx();

    await applyGather(planOf(move({ trackIds: ['t1'], from, to, crossDrive: true })), c);

    expect(locationOf('t2').p).toBe(from);
    expect(c.trash).not.toHaveBeenCalled();
    expect(fs.existsSync(from)).toBe(true);
  });

  it('reuses an identical file: no copy, entry switched, original trashed', async () => {
    const from = write(path.join(root, 'Other', 'Promos', 'a.mp3'), 'SAME');
    const to = write(path.join(music, 'Promos', 'a.mp3'), 'SAME');
    makeDb([['t1', from]]);
    const c = ctx();

    const result = await applyGather(planOf(move({ trackIds: ['t1'], from, to, crossDrive: true, reuseExisting: true })), c);

    expect(result.error).toBeUndefined();
    expect(locationOf('t1').p).toBe(to);
    expect(c.trash).toHaveBeenCalledWith(from);
  });

  it('rolls back file moves when the write throws', async () => {
    const same = write(path.join(root, 'Downloads', 'Promos', 'a.mp3'), 'AAA');
    const other = write(path.join(root, 'Other', 'Promos', 'b.mp3'), 'BBB');
    const reusedFrom = write(path.join(root, 'Other', 'Promos', 'c.mp3'), 'CCC');
    const reusedTo = write(path.join(music, 'Promos', 'c.mp3'), 'CCC');
    const sameTo = path.join(music, 'Promos', 'a.mp3');
    const otherTo = path.join(music, 'Promos', 'b.mp3');
    const c = ctx({ dbPath: path.join(root, 'no-such.db') });

    const result = await applyGather(planOf(
      move({ trackIds: ['t1'], from: same, to: sameTo }),
      move({ trackIds: ['t2'], from: other, to: otherTo, crossDrive: true }),
      move({ trackIds: ['t3'], from: reusedFrom, to: reusedTo, crossDrive: true, reuseExisting: true }),
    ), c);

    expect(result.error).toMatch(/not changed/i);
    expect(result.changed).toBe(0);
    expect(read(same)).toBe('AAA');
    expect(fs.existsSync(sameTo)).toBe(false);
    expect(read(other)).toBe('BBB');
    expect(fs.existsSync(otherTo)).toBe(false);
    // A file that was already there is never removed.
    expect(read(reusedTo)).toBe('CCC');
    expect(read(reusedFrom)).toBe('CCC');
    expect(c.trash).not.toHaveBeenCalled();
  });

  it('refuses before moving when rekordbox runs', async () => {
    const from = write(path.join(root, 'Downloads', 'Promos', 'a.mp3'), 'AAA');
    const to = path.join(music, 'Promos', 'a.mp3');
    makeDb([['t1', from]]);
    const c = ctx({ checkRunning: () => true });

    const result = await applyGather(planOf(move({ trackIds: ['t1'], from, to })), c);

    expect(result.error).toBe('Close rekordbox to continue');
    expect(read(from)).toBe('AAA');
    expect(fs.existsSync(to)).toBe(false);
    expect(fs.existsSync(`${dbPath}.backup.test`)).toBe(false);
    expect(c.onProgress).not.toHaveBeenCalled();
  });

  it('refuses a plan that carries a refusal, touching nothing', async () => {
    const from = write(path.join(root, 'Downloads', 'Promos', 'a.mp3'), 'AAA');
    const plan = { ...planOf(move({ trackIds: ['t1'], from, to: path.join(music, 'Promos', 'a.mp3') })), refusal: 'Not enough space' };

    const result = await applyGather(plan, ctx());

    expect(result.error).toBe('Not enough space');
    expect(read(from)).toBe('AAA');
  });

  it('stops between files when cancelled and writes only what was moved', async () => {
    const a = write(path.join(root, 'Downloads', 'Promos', 'a.mp3'), 'AAA');
    const b = write(path.join(root, 'Downloads', 'Promos', 'b.mp3'), 'BBB');
    const aTo = path.join(music, 'Promos', 'a.mp3');
    const bTo = path.join(music, 'Promos', 'b.mp3');
    makeDb([['t1', a], ['t2', b]]);
    const controller = new AbortController();
    const onProgress = vi.fn((current: number) => { if (current === 1) {controller.abort();} });

    const result = await applyGather(
      planOf(move({ trackIds: ['t1'], from: a, to: aTo }), move({ trackIds: ['t2'], from: b, to: bTo })),
      ctx({ signal: controller.signal, onProgress }),
    );

    expect(result.cancelled).toBe(true);
    expect(result.changed).toBe(1);
    expect(locationOf('t1').p).toBe(aTo);
    expect(locationOf('t2').p).toBe(b);
    expect(read(b)).toBe('BBB');
    expect(fs.existsSync(bTo)).toBe(false);
  });

  it('never overwrites a file that appeared at the destination after the plan', async () => {
    const from = write(path.join(root, 'Downloads', 'Promos', 'a.mp3'), 'AAA');
    const to = write(path.join(music, 'Promos', 'a.mp3'), 'SOMEONE ELSE');
    makeDb([['t1', from]]);

    const result = await applyGather(planOf(move({ trackIds: ['t1'], from, to })), ctx());

    expect(read(to)).toBe('SOMEONE ELSE');
    expect(read(from)).toBe('AAA');
    expect(locationOf('t1').p).toBe(from);
    expect(result.changed).toBe(0);
    expect(result.details).toEqual([expect.objectContaining({ action: 'failed', from, to })]);
  });

  it('never overwrites across drives either, and leaves no partial copy', async () => {
    const from = write(path.join(root, 'Other', 'Promos', 'a.mp3'), 'AAA');
    const to = write(path.join(music, 'Promos', 'a.mp3'), 'SOMEONE ELSE');
    makeDb([['t1', from]]);
    const c = ctx();

    const result = await applyGather(planOf(move({ trackIds: ['t1'], from, to, crossDrive: true })), c);

    expect(read(to)).toBe('SOMEONE ELSE');
    expect(fs.existsSync(`${to}.part`)).toBe(false);
    expect(result.details[0].action).toBe('failed');
    expect(c.trash).not.toHaveBeenCalled();
  });

  it('does not reuse a destination that changed since the plan', async () => {
    const from = write(path.join(root, 'Other', 'Promos', 'a.mp3'), 'SAME');
    const to = write(path.join(music, 'Promos', 'a.mp3'), 'DIFF');
    makeDb([['t1', from]]);
    const c = ctx();

    const result = await applyGather(planOf(move({ trackIds: ['t1'], from, to, crossDrive: true, reuseExisting: true })), c);

    expect(locationOf('t1').p).toBe(from);
    expect(result.details[0].action).toBe('failed');
    expect(c.trash).not.toHaveBeenCalled();
  });

  it('puts a file back when its entry left the library since the plan', async () => {
    const from = write(path.join(root, 'Downloads', 'Promos', 'a.mp3'), 'AAA');
    const to = path.join(music, 'Promos', 'a.mp3');
    makeDb([]);

    const result = await applyGather(planOf(move({ trackIds: ['gone'], from, to })), ctx());

    expect(read(from)).toBe('AAA');
    expect(fs.existsSync(to)).toBe(false);
    expect(result.changed).toBe(0);
  });

  it('never moves a folder whose path an entry holds, and still moves the files inside it', async () => {
    const folder = path.join(root, 'Downloads', 'Promos');
    const inner = write(path.join(folder, 'a.mp3'), 'AAA');
    const folderTo = path.join(music, 'Downloads', 'Promos');
    const crossTo = path.join(music, 'Other', 'Promos');
    const innerTo = path.join(music, 'Promos', 'a.mp3');
    makeDb([['t1', folder], ['t2', folder], ['t3', inner]]);
    const c = ctx();

    const result = await applyGather(planOf(
      move({ trackIds: ['t1'], from: folder, to: folderTo }),
      move({ trackIds: ['t2'], from: folder, to: crossTo, crossDrive: true }),
      move({ trackIds: ['t3'], from: inner, to: innerTo }),
    ), c);

    expect(fs.statSync(folder).isDirectory()).toBe(true);
    expect(fs.existsSync(folderTo)).toBe(false);
    expect(fs.existsSync(crossTo)).toBe(false);
    expect(locationOf('t1').p).toBe(folder);
    expect(locationOf('t2').p).toBe(folder);
    expect(result.details.filter((d) => d.action === 'failed').map((d) => d.from)).toEqual([folder, folder]);
    // The file inside the folder was not dragged along and still moves on its own.
    expect(read(innerTo)).toBe('AAA');
    expect(locationOf('t3').p).toBe(innerTo);
    expect(result.changed).toBe(1);
    expect(c.trash).not.toHaveBeenCalled();
  });

  it('reports progress per file', async () => {
    const a = write(path.join(root, 'Downloads', 'Promos', 'a.mp3'), 'AAA');
    makeDb([['t1', a]]);
    const c = ctx();

    await applyGather(planOf(move({ trackIds: ['t1'], from: a, to: path.join(music, 'Promos', 'a.mp3') })), c);

    expect(c.onProgress).toHaveBeenCalledWith(1, 1, 'Song t1');
  });
});
