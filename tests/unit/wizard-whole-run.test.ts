/**
 * The whole wizard on a made-up library: an encrypted database and audio files
 * in a temp folder, the real relocator, duplicate detector, writers and parser.
 * Only the Trash (a logger) and the rekordbox-running check are stand-ins.
 *
 * Runs check → relocate → remove → duplicates, then plans gather and convert
 * without applying them, and reads the database back: cues and loops of every
 * surviving track unchanged, playlists of merged entries pointing at the keeper.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.unmock('fs');
vi.unmock('crypto');

import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { unlockDatabase, parseDb, type DbPlaylist } from '../../src/main/rekordboxDbParser';
import { TrackRelocator } from '../../src/main/trackRelocator';
import { DuplicateDetector } from '../../src/main/duplicateDetector';
import { realWizardDeps, type WizardDeps } from '../../src/main/wizard/wizardDeps';
import { applyStep, planStep, runCheck, type WizardContext } from '../../src/main/wizard/wizardService';
import type {
  ConvertStepPlan, DuplicatesStepPlan, GatherStepPlan, RelocateStepPlan, RemoveStepPlan,
} from '../../src/main/wizard/types';

const KEY = 'ab'.repeat(32);
const UNPLUGGED = '/Volumes/WizardWholeRunNoSuchDrive';

let root: string;
let dbPath: string;
let music: string;
let trashed: string[];

const write = (p: string, body: string) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};

interface Row {
  id: string; title: string; artist: string; location: string;
  length?: number; size?: number; fileType?: number; sampleRate?: number; bitDepth?: number;
}

function buildLibrary() {
  const at = (...parts: string[]) => path.join(root, ...parts);
  write(at('Music', 'Moved', 'Found Song.mp3'), 'found song bytes');
  write(at('Music', 'Dup', 'Same Tune.mp3'), 'same tune bytes');
  const twin = 'twin bytes, identical in both copies';
  write(at('Music', 'A', 'Twin.mp3'), twin);
  write(at('Music', 'B', 'Twin.mp3'), twin);
  write(at('Elsewhere', 'Promos', 'Outside.mp3'), 'outside bytes');
  write(at('Music', 'Hi', 'Hires.flac'), 'flac bytes');

  const mp3 = { fileType: 1, sampleRate: 44100, bitDepth: 16 };
  const rows: Row[] = [
    { id: 'moved', title: 'Found Song', artist: 'Alpha', location: at('Old', 'Found Song.mp3'), length: 300, ...mp3 },
    { id: 'gone', title: 'Qqzz Vanished', artist: 'Beta', location: at('Old', 'Qqzz Vanished.mp3'), length: 250, ...mp3 },
    { id: 'unplugged', title: 'Lost Elsewhere', artist: 'Kappa', location: `${UNPLUGGED}/Set/Lost Elsewhere.mp3`, ...mp3 },
    { id: 'stream', title: 'Streamed', artist: 'Omega', location: 'tidal:tracks:42' },
    { id: 'd1', title: 'Same Tune', artist: 'Gamma', location: at('Music', 'Dup', 'Same Tune.mp3'), length: 200, ...mp3 },
    { id: 'd2', title: 'Same Tune', artist: 'Gamma', location: at('Music', 'Dup', 'Same Tune.mp3'), length: 200, ...mp3 },
    { id: 'tw1', title: 'Twin', artist: 'Delta', location: at('Music', 'A', 'Twin.mp3'), length: 180, size: twin.length, ...mp3 },
    { id: 'tw2', title: 'Twin', artist: 'Delta', location: at('Music', 'B', 'Twin.mp3'), length: 180, size: twin.length, ...mp3 },
    { id: 'out', title: 'Outside', artist: 'Eps', location: at('Elsewhere', 'Promos', 'Outside.mp3'), length: 222, ...mp3 },
    { id: 'hires', title: 'Hires', artist: 'Zeta', location: at('Music', 'Hi', 'Hires.flac'), length: 260, fileType: 5, sampleRate: 96000, bitDepth: 24 },
  ];

  const db = new Database(dbPath);
  unlockDatabase(db, KEY);
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
  const artist = db.prepare('INSERT OR IGNORE INTO djmdArtist (ID, Name) VALUES (?, ?)');
  const content = db.prepare(`INSERT INTO djmdContent
    (ID, Title, FolderPath, FileNameL, Length, BitRate, FileSize, FileType, SampleRate, BitDepth, ArtistID, rb_local_usn)
    VALUES (?, ?, ?, ?, ?, 320, ?, ?, ?, ?, ?, 10)`);
  for (const r of rows) {
    artist.run(`a-${r.artist}`, r.artist);
    content.run(r.id, r.title, r.location, path.basename(r.location), r.length ?? null, r.size ?? null,
      r.fileType ?? null, r.sampleRate ?? null, r.bitDepth ?? null, `a-${r.artist}`);
  }
  // Cues (OutMsec -1) and loops (positive OutMsec), unevenly spread.
  const cue = db.prepare('INSERT INTO djmdCue (ID, ContentID, Kind, InMsec, OutMsec, Comment) VALUES (?, ?, ?, ?, ?, ?)');
  let n = 0;
  const cues = (id: string, count: number, loops: number) => {
    for (let i = 0; i < count; i++) {cue.run(`c${n++}`, id, i + 1, 1000 * (i + 1), -1, '');}
    for (let i = 0; i < loops; i++) {cue.run(`c${n++}`, id, 0, 5000 * (i + 1), 5000 * (i + 1) + 4000, 'loop');}
  };
  cues('moved', 2, 1);
  cues('gone', 1, 0);
  cues('d1', 3, 0);
  cues('tw1', 2, 1);
  cues('tw2', 1, 0);
  cues('out', 1, 1);

  db.exec(`
    INSERT INTO djmdPlaylist VALUES ('p1', 'Warmup', NULL, 0, 0, 0), ('p2', 'Peak', NULL, 0, 1, 0);
    INSERT INTO djmdSongPlaylist VALUES
      ('s1', 'p1', 'moved', 1, 0), ('s2', 'p1', 'gone', 2, 0), ('s3', 'p1', 'd1', 3, 0),
      ('s4', 'p2', 'd2', 1, 0), ('s5', 'p2', 'tw2', 2, 0), ('s6', 'p2', 'out', 3, 0);
  `);
  db.close();
}

function deps(): WizardDeps {
  return {
    ...realWizardDeps({
      relocator: new TrackRelocator(),
      detector: new DuplicateDetector(),
      trash: async (p) => { trashed.push(p); },
      ffmpegStatus: () => ({ state: 'missing', sizeBytes: 0 }),
    }),
    // Never the real process check: rekordbox open on the test machine would refuse every write.
    isRunning: () => false,
  };
}

function ctx(): WizardContext {
  return {
    operationId: 'whole-run',
    dbPath,
    key: KEY,
    musicFolder: music,
    profileId: 'cdj2000',
    searchPaths: [],
    signal: new AbortController().signal,
    onProgress: () => undefined,
  };
}

const cueCounts = (lib: Awaited<ReturnType<typeof parseDb>>) =>
  new Map([...lib.tracks].map(([id, t]) => [id, { cues: t.cues.length, loops: t.loops.length }]));

const playlistTracks = (playlists: DbPlaylist[], name: string): string[] => {
  for (const p of playlists) {
    if (p.name === name) {return p.tracks ?? [];}
    const inner = playlistTracks(p.children ?? [], name);
    if (inner.length) {return inner;}
  }
  return [];
};

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-whole-')));
  dbPath = path.join(root, 'master.db');
  music = path.join(root, 'Music');
  trashed = [];
  buildLibrary();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('the whole wizard on a copy', () => {
  it('fixes what is sure, keeps cues and playlists, and never touches an unplugged drive', async () => {
    // Encrypted like master.db, so every read and write goes through the key.
    expect(fs.readFileSync(dbPath).subarray(0, 15).toString()).not.toBe('SQLite format 3');
    const d = deps();
    const before = cueCounts(await parseDb(dbPath, KEY));

    const check = await runCheck(ctx(), d);
    expect(check).toMatchObject({ missing: 2, duplicates: 2, outsideFolder: 1, unplayable: 1 });
    expect(check.unpluggedDrives).toEqual([UNPLUGGED]);

    const relocate = await planStep('relocate', ctx(), d) as RelocateStepPlan;
    expect(relocate.apply.map((a) => a.trackIds)).toEqual([['moved']]);
    const relocated = await applyStep(relocate, ctx(), d);
    expect(relocated).toMatchObject({ changed: 1, cancelled: false });
    expect(relocated.error).toBeUndefined();
    expect(fs.existsSync(relocated.backupPath!)).toBe(true);

    const remove = await planStep('remove', ctx(), d) as RemoveStepPlan;
    expect(remove.remove.map((r) => r.trackIds)).toEqual([['gone']]);
    expect(remove.setAside.flatMap((s) => s.trackIds)).toEqual(['unplugged']);
    const removed = await applyStep(remove, ctx(), d);
    expect(removed).toMatchObject({ changed: 1 });

    const dups = await planStep('duplicates', ctx(), d) as DuplicatesStepPlan;
    const merges = [...dups.merges].sort((a, b) => a.keepId.localeCompare(b.keepId));
    expect(merges.map((m) => [m.keepId, m.removeIds])).toEqual([['d1', ['d2']], ['tw1', ['tw2']]]);
    const merged = await applyStep(dups, ctx(), d);
    expect(merged).toMatchObject({ changed: 2 });
    // Only the extra copy of the twin goes; the file the two Same Tune entries shared stays.
    expect(trashed).toEqual([path.join(music, 'B', 'Twin.mp3')]);

    const gather = await planStep('gather', ctx(), d) as GatherStepPlan;
    expect(gather.moves.map((m) => [m.trackIds, m.to])).toEqual([[['out'], path.join(music, 'Promos', 'Outside.mp3')]]);
    expect(gather.unplugged).toEqual([{ drive: UNPLUGGED, count: 1 }]);
    expect(gather.refusal).toBeUndefined();

    const convert = await planStep('convert', ctx(), d) as ConvertStepPlan;
    expect(convert.items.length + convert.setAside.length).toBe(1);

    // Read back: the right entries are gone, the rest keep every cue and loop.
    const after = await parseDb(dbPath, KEY);
    expect([...after.tracks.keys()].sort()).toEqual(['d1', 'hires', 'moved', 'out', 'stream', 'tw1', 'unplugged']);
    for (const [id, counts] of cueCounts(after)) {expect(counts).toEqual(before.get(id));}
    expect(after.tracks.get('moved')!.location).toBe(path.join(music, 'Moved', 'Found Song.mp3'));
    expect(after.tracks.get('unplugged')!.location).toBe(`${UNPLUGGED}/Set/Lost Elsewhere.mp3`);

    // Playlists of merged entries now hold the keepers; the removed entry left its playlist.
    expect(playlistTracks(after.playlists, 'Warmup')).toEqual(['moved', 'd1']);
    expect(playlistTracks(after.playlists, 'Peak').sort()).toEqual(['d1', 'out', 'tw1']);
  });
});
