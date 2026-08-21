import Database from 'better-sqlite3-multiple-ciphers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type Db = InstanceType<typeof Database>;

/**
 * Read a Rekordbox master.db (SQLCipher) into the same shape the XML parser
 * produces, so every downstream feature works regardless of where the library
 * came from.
 *
 * Facts verified against a real Rekordbox 7.2 database:
 * - The driver defaults to chacha20, so `PRAGMA cipher='sqlcipher'` and
 *   `legacy=4` must be set BEFORE the key or every read fails with
 *   "file is not a database".
 * - BPM is stored times 100 (14000 = 140.00).
 * - A cue is a loop only when OutMsec is positive: ordinary cues store -1,
 *   not null, so a truthiness check misreads every cue as a loop. Kind
 *   identifies the hotcue slot (0 = memory cue); it does not mark loops.
 * - Deleted rows linger with rb_local_deleted = 1 and must be skipped.
 */

export interface DbTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  genre?: string;
  location: string;
  duration?: number;
  bitrate?: number;
  size?: number;
  bpm?: number;
  rating?: number;
  dateAdded?: Date;
  cues: Array<{ name: string; type: 'CUE'; start: number; hotcue?: number }>;
  loops: Array<{ name: string; start: number; end: number }>;
}

export interface DbPlaylist {
  name: string;
  tracks: string[];
  type: 'FOLDER' | 'PLAYLIST';
  children?: DbPlaylist[];
}

export interface DbLibrary {
  libraryPath: string;
  tracks: Map<string, DbTrack>;
  playlists: DbPlaylist[];
}

/** Apply the cipher settings this database needs, in the required order. */
export function unlockDatabase(db: Db, key: string): void {
  db.pragma("cipher='sqlcipher'");
  db.pragma('legacy=4');
  db.pragma(`key='${key.replace(/'/g, "''")}'`);
}

/** Ordinary cues store OutMsec = -1; only a positive value marks a loop. */
const isLoop = (cue: { OutMsec?: number | null }) =>
  typeof cue.OutMsec === 'number' && cue.OutMsec > 0;

export function mapRowsToLibrary(db: Db, dbPath: string): DbLibrary {
  const tracks = new Map<string, DbTrack>();

  const contentRows = db.prepare(`
    SELECT c.ID, c.Title, c.FolderPath, c.Length, c.BitRate, c.FileSize,
           c.BPM, c.Rating, c.created_at,
           ar.Name AS ArtistName, al.Name AS AlbumName, g.Name AS GenreName
    FROM djmdContent c
    LEFT JOIN djmdArtist ar ON ar.ID = c.ArtistID AND ar.rb_local_deleted = 0
    LEFT JOIN djmdAlbum  al ON al.ID = c.AlbumID  AND al.rb_local_deleted = 0
    LEFT JOIN djmdGenre  g  ON g.ID  = c.GenreID  AND g.rb_local_deleted  = 0
    WHERE c.rb_local_deleted = 0
  `).all() as any[];

  const cuesByContent = new Map<string, any[]>();
  for (const row of db.prepare(`
    SELECT ContentID, Kind, InMsec, OutMsec, Comment
    FROM djmdCue WHERE rb_local_deleted = 0
  `).all() as any[]) {
    const id = String(row.ContentID);
    if (!cuesByContent.has(id)) { cuesByContent.set(id, []); }
    cuesByContent.get(id)!.push(row);
  }

  for (const row of contentRows) {
    const marks = cuesByContent.get(String(row.ID)) ?? [];
    tracks.set(String(row.ID), {
      id: String(row.ID),
      name: row.Title ?? '',
      artist: row.ArtistName ?? '',
      album: row.AlbumName ?? undefined,
      genre: row.GenreName ?? undefined,
      location: row.FolderPath ?? '',
      duration: row.Length ?? undefined,
      bitrate: row.BitRate ?? undefined,
      size: row.FileSize ?? undefined,
      bpm: row.BPM ? row.BPM / 100 : undefined,
      rating: row.Rating ?? undefined,
      dateAdded: row.created_at ? new Date(row.created_at) : undefined,
      cues: marks
        .filter((m) => !isLoop(m))
        .map((m) => ({
          name: m.Comment ?? '',
          type: 'CUE' as const,
          start: (m.InMsec ?? 0) / 1000,
          hotcue: m.Kind > 0 ? m.Kind : undefined,
        })),
      loops: marks
        .filter(isLoop)
        .map((m) => ({
          name: m.Comment ?? '',
          start: (m.InMsec ?? 0) / 1000,
          end: (m.OutMsec ?? 0) / 1000,
        })),
    });
  }

  return { libraryPath: dbPath, tracks, playlists: buildPlaylists(db) };
}

function buildPlaylists(db: Db): DbPlaylist[] {
  const rows = db.prepare(`
    SELECT ID, Name, ParentID, Attribute
    FROM djmdPlaylist WHERE rb_local_deleted = 0 ORDER BY Seq
  `).all() as any[];

  const trackIdsByPlaylist = new Map<string, string[]>();
  for (const song of db.prepare(`
    SELECT PlaylistID, ContentID FROM djmdSongPlaylist
    WHERE rb_local_deleted = 0 ORDER BY TrackNo
  `).all() as any[]) {
    const id = String(song.PlaylistID);
    if (!trackIdsByPlaylist.has(id)) { trackIdsByPlaylist.set(id, []); }
    trackIdsByPlaylist.get(id)!.push(String(song.ContentID));
  }

  const nodes = new Map<string, DbPlaylist>();
  for (const row of rows) {
    nodes.set(String(row.ID), {
      name: row.Name ?? '',
      type: row.Attribute === 1 ? 'FOLDER' : 'PLAYLIST',
      tracks: trackIdsByPlaylist.get(String(row.ID)) ?? [],
      children: [],
    });
  }

  const roots: DbPlaylist[] = [];
  for (const row of rows) {
    const self = nodes.get(String(row.ID))!;
    const parentId = row.ParentID ? String(row.ParentID) : null;
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) { parent.children!.push(self); } else { roots.push(self); }
  }
  return roots;
}

/**
 * Copy master.db (with its WAL, which holds recent writes) to a temp file and
 * read that copy read-only, so Rekordbox may stay open and the original is
 * never touched. The copy is always removed.
 */
export async function parseDb(dbPath: string, key: string): Promise<DbLibrary> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rbdb-'));
  const copy = path.join(dir, 'master.db');
  await fs.promises.copyFile(dbPath, copy);
  for (const suffix of ['-wal', '-shm']) {
    try { await fs.promises.copyFile(dbPath + suffix, copy + suffix); } catch { /* absent is fine */ }
  }

  let db: Db | null = null;
  try {
    db = new Database(copy, { readonly: true });
    unlockDatabase(db, key);
    return mapRowsToLibrary(db, dbPath);
  } finally {
    if (db) { db.close(); }
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}
