/**
 * A reader for rekordbox's `export.pdb`, the DeviceSQL database a USB stick
 * carries for CDJ-2000/NXS/NXS2, CDJ-3000 and XDJ players.
 *
 * Format (Deep Symmetry's analysis and crate-digger's `rekordbox_pdb.ksy`),
 * all little-endian:
 * - Page 0 is the file header: page size, table count, then one 16-byte entry
 *   per table (type, empty candidate, first page, last page).
 * - A table is a chain of pages linked by `next_page`, from its first page to
 *   its last. A page has a 40-byte header, a heap of rows after it, and a row
 *   index built backwards from the end of the page in groups of sixteen.
 * - Each group carries a presence bitmask: a row whose bit is clear was
 *   deleted and its bytes are not necessarily well-formed, so it is skipped.
 * - Only data pages (flag 0x40 clear) hold rows.
 *
 * Only the four tables the USB check needs are read. Pure: takes the file's
 * bytes, so it never touches the stick.
 */

export const PdbTable = {
  tracks: 0,
  artists: 2,
  playlistTree: 7,
  playlistEntries: 8,
} as const;

export interface PdbTrack {
  id: number;
  title: string;
  artistId: number;
  /** The file's path on the stick, from its root: `/Contents/Artist/Album/file.mp3`. */
  filePath: string;
  fileName: string;
}

export interface PdbPlaylist {
  id: number;
  /** 0 at the root. */
  parentId: number;
  sortOrder: number;
  isFolder: boolean;
  name: string;
}

export interface PdbPlaylistEntry {
  entryIndex: number;
  trackId: number;
  playlistId: number;
}

export interface PdbExport {
  tracks: PdbTrack[];
  artists: Map<number, string>;
  playlists: PdbPlaylist[];
  entries: PdbPlaylistEntry[];
  /** Rows the index called present whose bytes could not be read. */
  unreadableRows: number;
}

export class PdbFormatError extends Error {
  constructor(message: string) {
    super(`Not a readable export.pdb: ${message}`);
    this.name = 'PdbFormatError';
  }
}

const HEADER_TABLES_AT = 28;
const TABLE_ENTRY_SIZE = 16;
const PAGE_HEADER_SIZE = 0x28;
const ROW_GROUP_SIZE = 0x24;
const ROWS_PER_GROUP = 16;
const NON_DATA_PAGE = 0x40;

function check(buf: Buffer, pos: number, size: number): void {
  if (pos < 0 || pos + size > buf.length) {
    throw new PdbFormatError(`read past the end of the file at ${pos}`);
  }
}

const u8 = (buf: Buffer, pos: number) => { check(buf, pos, 1); return buf.readUInt8(pos); };
const u16 = (buf: Buffer, pos: number) => { check(buf, pos, 2); return buf.readUInt16LE(pos); };
const u32 = (buf: Buffer, pos: number) => { check(buf, pos, 4); return buf.readUInt32LE(pos); };

/**
 * A DeviceSQL string. The first byte says how it is stored:
 * - odd: short ASCII, `(byte >> 1) - 1` bytes of text follow;
 * - 0x40: long ASCII, a u16 total length (header included) and a pad byte;
 * - 0x90: long UTF-16LE, laid out the same way.
 */
export function readDeviceSqlString(buf: Buffer, pos: number): string {
  const kind = u8(buf, pos);
  if (kind === 0x40 || kind === 0x90) {
    const length = u16(buf, pos + 1);
    const size = Math.max(0, length - 4);
    check(buf, pos + 4, size);
    const bytes = buf.subarray(pos + 4, pos + 4 + size);
    const text = kind === 0x40 ? bytes.toString('latin1') : bytes.toString('utf16le');
    return text.replace(/\0+$/, '');
  }
  if (kind % 2 === 1) {
    const size = Math.max(0, (kind >> 1) - 1);
    check(buf, pos + 1, size);
    return buf.subarray(pos + 1, pos + 1 + size).toString('latin1');
  }
  throw new PdbFormatError(`unknown string kind 0x${kind.toString(16)} at ${pos}`);
}

interface Header {
  pageSize: number;
  tables: Map<number, { firstPage: number; lastPage: number }>;
}

function readHeader(buf: Buffer): Header {
  if (buf.length < HEADER_TABLES_AT) {throw new PdbFormatError('the file is too short');}
  const pageSize = u32(buf, 4);
  const tableCount = u32(buf, 8);
  if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0) {
    throw new PdbFormatError(`unexpected page size ${pageSize}`);
  }
  if (tableCount === 0 || HEADER_TABLES_AT + tableCount * TABLE_ENTRY_SIZE > pageSize) {
    throw new PdbFormatError(`unexpected table count ${tableCount}`);
  }
  const tables = new Map<number, { firstPage: number; lastPage: number }>();
  for (let i = 0; i < tableCount; i++) {
    const at = HEADER_TABLES_AT + i * TABLE_ENTRY_SIZE;
    const type = u32(buf, at);
    if (!tables.has(type)) {
      tables.set(type, { firstPage: u32(buf, at + 8), lastPage: u32(buf, at + 12) });
    }
  }
  return { pageSize, tables };
}

/**
 * The start of every present row of one table. Follows the page chain from the
 * first page to the last, stopping early at a page of another type, a page past
 * the end of the file, or a loop.
 */
function rowOffsets(buf: Buffer, header: Header, type: number): number[] {
  const table = header.tables.get(type);
  if (!table) {return [];}
  const { pageSize } = header;
  const rows: number[] = [];
  const seen = new Set<number>();
  let index = table.firstPage;
  while (!seen.has(index) && (index + 1) * pageSize <= buf.length) {
    seen.add(index);
    const page = index * pageSize;
    if (u32(buf, page + 8) !== type) {break;}
    const flags = u8(buf, page + 0x1b);
    if ((flags & NON_DATA_PAGE) === 0) {
      // A 24-bit field: 13 bits of row offsets ever allocated, then 11 of live rows.
      const counts = u8(buf, page + 0x18) | (u8(buf, page + 0x19) << 8) | (u8(buf, page + 0x1a) << 16);
      const offsetCount = counts & 0x1fff;
      const groups = offsetCount === 0 ? 0 : Math.floor((offsetCount - 1) / ROWS_PER_GROUP) + 1;
      for (let g = 0; g < groups; g++) {
        const base = page + pageSize - g * ROW_GROUP_SIZE;
        const present = u16(buf, base - 4);
        const inGroup = Math.min(ROWS_PER_GROUP, offsetCount - g * ROWS_PER_GROUP);
        for (let r = 0; r < inGroup; r++) {
          if (((present >> r) & 1) === 0) {continue;}
          rows.push(page + PAGE_HEADER_SIZE + u16(buf, base - 6 - 2 * r));
        }
      }
    }
    if (index === table.lastPage) {break;}
    index = u32(buf, page + 12);
  }
  return rows;
}

function readTrack(buf: Buffer, row: number): PdbTrack {
  const strings = row + 0x5e;
  const str = (n: number) => readDeviceSqlString(buf, row + u16(buf, strings + 2 * n));
  return {
    id: u32(buf, row + 0x48),
    artistId: u32(buf, row + 0x44),
    title: str(17),
    fileName: str(19),
    filePath: str(20),
  };
}

function readArtist(buf: Buffer, row: number): { id: number; name: string } {
  const subtype = u16(buf, row);
  // Subtype 0x64 means the name lies too far for a one-byte offset.
  const offset = (subtype & 0x04) === 0x04 ? u16(buf, row + 0x0a) : u8(buf, row + 9);
  return { id: u32(buf, row + 4), name: readDeviceSqlString(buf, row + offset) };
}

function readPlaylist(buf: Buffer, row: number): PdbPlaylist {
  return {
    parentId: u32(buf, row),
    sortOrder: u32(buf, row + 8),
    id: u32(buf, row + 12),
    isFolder: u32(buf, row + 16) !== 0,
    name: readDeviceSqlString(buf, row + 20),
  };
}

function readEntry(buf: Buffer, row: number): PdbPlaylistEntry {
  return { entryIndex: u32(buf, row), trackId: u32(buf, row + 4), playlistId: u32(buf, row + 8) };
}

export function readPdb(buf: Buffer): PdbExport {
  const header = readHeader(buf);
  let unreadableRows = 0;
  const rowsOf = <T>(type: number, read: (b: Buffer, row: number) => T): T[] => {
    const out: T[] = [];
    for (const row of rowOffsets(buf, header, type)) {
      try {
        out.push(read(buf, row));
      } catch (e) {
        if (!(e instanceof PdbFormatError)) {throw e;}
        unreadableRows++;
      }
    }
    return out;
  };

  const artists = new Map<number, string>();
  for (const a of rowsOf(PdbTable.artists, readArtist)) {artists.set(a.id, a.name);}
  const tracks = rowsOf(PdbTable.tracks, readTrack);
  const playlists = rowsOf(PdbTable.playlistTree, readPlaylist);
  const entries = rowsOf(PdbTable.playlistEntries, readEntry);
  return { tracks, artists, playlists, entries, unreadableRows };
}
