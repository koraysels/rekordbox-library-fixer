/**
 * Builds a small, synthetic `export.pdb` in memory, laid out the way rekordbox
 * writes one (file header, per-table page chains, row index groups of sixteen
 * built backwards from the page end, presence bitmasks), so the reader is
 * tested without anyone's real stick.
 */

export const PAGE_SIZE = 4096;
const PAGE_HEADER = 0x28;
const GROUP = 0x24;

export type StringKind = 'short' | 'long-ascii' | 'utf16';

export function deviceSqlString(text: string, kind?: StringKind): Buffer {
  // eslint-disable-next-line no-control-regex
  const ascii = /^[\x00-\x7f]*$/.test(text);
  const k = kind ?? (!ascii ? 'utf16' : text.length <= 126 ? 'short' : 'long-ascii');
  if (k === 'short') {
    const body = Buffer.from(text, 'latin1');
    return Buffer.concat([Buffer.from([((body.length + 1) << 1) | 1]), body]);
  }
  const body = Buffer.from(text, k === 'utf16' ? 'utf16le' : 'latin1');
  const head = Buffer.alloc(4);
  head[0] = k === 'utf16' ? 0x90 : 0x40;
  head.writeUInt16LE(body.length + 4, 1);
  return Buffer.concat([head, body]);
}

export interface Row {
  bytes: Buffer;
  /** Written into the page, but its presence bit is clear. */
  deleted?: boolean;
}

export interface TrackSpec {
  id: number;
  title: string;
  artistId?: number;
  filePath: string;
  fileName?: string;
}

const TRACK_STRINGS_AT = 0x5e;
const TRACK_HEADER = TRACK_STRINGS_AT + 21 * 2;

export function trackRow(t: TrackSpec): Buffer {
  const head = Buffer.alloc(TRACK_HEADER);
  head.writeUInt16LE(0x24, 0);
  head.writeUInt32LE(t.artistId ?? 0, 0x44);
  head.writeUInt32LE(t.id, 0x48);
  const strings: Buffer[] = [];
  let at = TRACK_HEADER;
  for (let n = 0; n < 21; n++) {
    const text = n === 17 ? t.title
      : n === 19 ? (t.fileName ?? t.filePath.slice(t.filePath.lastIndexOf('/') + 1))
        : n === 20 ? t.filePath : '';
    const s = deviceSqlString(text);
    head.writeUInt16LE(at, TRACK_STRINGS_AT + 2 * n);
    strings.push(s);
    at += s.length;
  }
  return Buffer.concat([head, ...strings]);
}

/** `far` stores the name offset in two bytes (subtype 0x64), as rekordbox does for rows past 0xff. */
export function artistRow(id: number, name: string, far = false): Buffer {
  const head = Buffer.alloc(far ? 12 : 10);
  head.writeUInt16LE(far ? 0x64 : 0x60, 0);
  head.writeUInt32LE(id, 4);
  head[8] = 0x03;
  if (far) {head.writeUInt16LE(12, 0x0a);} else {head[9] = 10;}
  return Buffer.concat([head, deviceSqlString(name)]);
}

export function playlistRow(p: { id: number; parentId?: number; sortOrder?: number; folder?: boolean; name: string }): Buffer {
  const head = Buffer.alloc(20);
  head.writeUInt32LE(p.parentId ?? 0, 0);
  head.writeUInt32LE(p.sortOrder ?? 0, 8);
  head.writeUInt32LE(p.id, 12);
  head.writeUInt32LE(p.folder ? 1 : 0, 16);
  return Buffer.concat([head, deviceSqlString(p.name)]);
}

export function entryRow(entryIndex: number, trackId: number, playlistId: number): Buffer {
  const b = Buffer.alloc(12);
  b.writeUInt32LE(entryIndex, 0);
  b.writeUInt32LE(trackId, 4);
  b.writeUInt32LE(playlistId, 8);
  return b;
}

/** Bytes that are not a row: a deleted row need not be well-formed. */
export const garbageRow = (size = 160) => Buffer.alloc(size, 0x02);

export interface TableSpec {
  type: number;
  /** Data pages, in chain order. */
  pages: Row[][];
  /** Put a non-data page (flag 0x40) between the data pages. */
  nonDataPage?: boolean;
  /** After the last page, link to one more page of this type the reader must not visit. */
  decoyAfterLast?: Row[];
}

function page(index: number, type: number, next: number, rows: Row[], dataPage = true): Buffer {
  const buf = Buffer.alloc(PAGE_SIZE);
  buf.writeUInt32LE(index, 4);
  buf.writeUInt32LE(type, 8);
  buf.writeUInt32LE(next, 12);
  const live = rows.filter((r) => !r.deleted).length;
  const counts = (rows.length & 0x1fff) | (live << 13);
  buf[0x18] = counts & 0xff;
  buf[0x19] = (counts >> 8) & 0xff;
  buf[0x1a] = (counts >> 16) & 0xff;
  buf[0x1b] = dataPage ? 0x24 : 0x64;
  let heap = 0;
  rows.forEach((row, i) => {
    const g = Math.floor(i / 16);
    const r = i % 16;
    const base = PAGE_SIZE - g * GROUP;
    if (PAGE_HEADER + heap + row.bytes.length > base - GROUP) {throw new Error('page overflow in test builder');}
    row.bytes.copy(buf, PAGE_HEADER + heap);
    buf.writeUInt16LE(heap, base - 6 - 2 * r);
    if (!row.deleted) {buf.writeUInt16LE(buf.readUInt16LE(base - 4) | (1 << r), base - 4);}
    heap += (row.bytes.length + 3) & ~3;
  });
  return buf;
}

/** A whole file: header page, then for each table an empty first page followed by its data pages. */
export function buildPdb(tables: TableSpec[]): Buffer {
  const pages: Buffer[] = [];
  const entries: Array<{ type: number; first: number; last: number }> = [];
  let next = 1;
  const layout = tables.map((t) => {
    const chain: Array<{ rows: Row[]; data: boolean }> = [{ rows: [], data: true }];
    t.pages.forEach((rows, i) => {
      if (t.nonDataPage && i === 1) {chain.push({ rows: [], data: false });}
      chain.push({ rows, data: true });
    });
    const indices = chain.map(() => next++);
    const decoy = t.decoyAfterLast ? next++ : null;
    return { t, chain, indices, decoy };
  });
  const pastEnd = next + 10;
  for (const { t, chain, indices, decoy } of layout) {
    chain.forEach((c, i) => {
      const last = i === chain.length - 1;
      pages[indices[i]] = page(indices[i], t.type, last ? (decoy ?? pastEnd) : indices[i + 1], c.rows, c.data);
    });
    if (decoy !== null) {pages[decoy] = page(decoy, t.type, pastEnd, t.decoyAfterLast!);}
    entries.push({ type: t.type, first: indices[0], last: indices[indices.length - 1] });
  }
  const header = Buffer.alloc(PAGE_SIZE);
  header.writeUInt32LE(PAGE_SIZE, 4);
  header.writeUInt32LE(entries.length, 8);
  header.writeUInt32LE(pastEnd, 12);
  entries.forEach((e, i) => {
    const at = 28 + 16 * i;
    header.writeUInt32LE(e.type, at);
    header.writeUInt32LE(e.last, at + 12);
    header.writeUInt32LE(e.first, at + 8);
  });
  pages[0] = header;
  return Buffer.concat(pages);
}

export interface SimpleExport {
  artists: Array<{ id: number; name: string }>;
  tracks: TrackSpec[];
  playlists: Array<{ id: number; parentId?: number; folder?: boolean; name: string }>;
  entries: Array<{ playlistId: number; trackId: number; index?: number }>;
}

/** The four tables the USB check reads, one data page each. */
export function buildExport(e: SimpleExport): Buffer {
  return buildPdb([
    { type: 0, pages: [e.tracks.map((t) => ({ bytes: trackRow(t) }))] },
    { type: 2, pages: [e.artists.map((a) => ({ bytes: artistRow(a.id, a.name) }))] },
    { type: 7, pages: [e.playlists.map((p, i) => ({ bytes: playlistRow({ ...p, sortOrder: i }) }))] },
    { type: 8, pages: [e.entries.map((x, i) => ({ bytes: entryRow(x.index ?? i + 1, x.trackId, x.playlistId) }))] },
  ]);
}
