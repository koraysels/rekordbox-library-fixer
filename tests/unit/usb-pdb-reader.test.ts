import { describe, it, expect } from 'vitest';
import { PdbFormatError, readDeviceSqlString, readPdb } from '../../src/main/usb/pdbReader';
import {
  artistRow, buildExport, buildPdb, deviceSqlString, entryRow, garbageRow, PAGE_SIZE, playlistRow, trackRow,
} from './helpers/pdbBuilder';

describe('readDeviceSqlString', () => {
  it('reads short ASCII, long ASCII and UTF-16LE strings', () => {
    const long = 'x'.repeat(300);
    expect(readDeviceSqlString(deviceSqlString('Intro', 'short'), 0)).toBe('Intro');
    expect(readDeviceSqlString(deviceSqlString('', 'short'), 0)).toBe('');
    expect(readDeviceSqlString(deviceSqlString(long, 'long-ascii'), 0)).toBe(long);
    expect(readDeviceSqlString(deviceSqlString('Café 東京 💿', 'utf16'), 0)).toBe('Café 東京 💿');
  });

  it('refuses a byte that names no string kind', () => {
    expect(() => readDeviceSqlString(Buffer.from([0x02, 0, 0]), 0)).toThrow(PdbFormatError);
  });

  it('refuses a string that runs past the end of the file', () => {
    expect(() => readDeviceSqlString(Buffer.from([0x40, 0xff, 0x00, 0x00, 0x41]), 0)).toThrow(PdbFormatError);
  });
});

describe('readPdb', () => {
  it('reads tracks, artists, the playlist tree and its entries', () => {
    const pdb = readPdb(buildExport({
      artists: [{ id: 7, name: 'Roméo Elvis' }],
      tracks: [
        { id: 1, title: 'Bruxelles arrive', artistId: 7, filePath: '/Contents/Roméo Elvis/Morale/bx.mp3' },
        { id: 2, title: 'Intro', filePath: '/Contents/UnknownArtist/intro.wav', fileName: 'intro.wav' },
      ],
      playlists: [
        { id: 1, name: 'Crates', folder: true },
        { id: 2, parentId: 1, name: 'Gig' },
      ],
      entries: [{ playlistId: 2, trackId: 1, index: 1 }, { playlistId: 2, trackId: 2, index: 2 }],
    }));

    expect(pdb.tracks).toEqual([
      { id: 1, title: 'Bruxelles arrive', artistId: 7, filePath: '/Contents/Roméo Elvis/Morale/bx.mp3', fileName: 'bx.mp3' },
      { id: 2, title: 'Intro', artistId: 0, filePath: '/Contents/UnknownArtist/intro.wav', fileName: 'intro.wav' },
    ]);
    expect(pdb.artists.get(7)).toBe('Roméo Elvis');
    expect(pdb.playlists).toEqual([
      { id: 1, parentId: 0, sortOrder: 0, isFolder: true, name: 'Crates' },
      { id: 2, parentId: 1, sortOrder: 1, isFolder: false, name: 'Gig' },
    ]);
    expect(pdb.entries).toEqual([
      { entryIndex: 1, trackId: 1, playlistId: 2 },
      { entryIndex: 2, trackId: 2, playlistId: 2 },
    ]);
    expect(pdb.unreadableRows).toBe(0);
  });

  it('reads an artist name stored behind a two-byte offset', () => {
    const pdb = readPdb(buildPdb([
      { type: 2, pages: [[{ bytes: artistRow(1, 'Near') }, { bytes: artistRow(2, 'Far Away', true) }]] },
    ]));
    expect([...pdb.artists]).toEqual([[1, 'Near'], [2, 'Far Away']]);
  });

  it('skips a deleted row, whose bytes need not be a row at all', () => {
    const pdb = readPdb(buildPdb([
      { type: 0, pages: [[
        { bytes: trackRow({ id: 1, title: 'Kept', filePath: '/Contents/a.mp3' }) },
        { bytes: garbageRow(), deleted: true },
        { bytes: trackRow({ id: 3, title: 'Also kept', filePath: '/Contents/c.mp3' }) },
      ]] },
      { type: 7, pages: [[
        { bytes: playlistRow({ id: 1, name: 'Old' }), deleted: true },
        { bytes: playlistRow({ id: 2, name: 'Live' }) },
      ]] },
    ]));
    expect(pdb.tracks.map((t) => t.title)).toEqual(['Kept', 'Also kept']);
    expect(pdb.playlists.map((p) => p.name)).toEqual(['Live']);
    expect(pdb.unreadableRows).toBe(0);
  });

  it('reads past sixteen rows on a page and across pages, skipping non-data pages', () => {
    const rows = (from: number, n: number, deletedAt = -1) =>
      Array.from({ length: n }, (_, i) => ({ bytes: entryRow(from + i, 100 + from + i, 9), deleted: i === deletedAt }));
    const pdb = readPdb(buildPdb([
      { type: 8, nonDataPage: true, pages: [rows(0, 40, 17), rows(40, 5)] },
    ]));
    expect(pdb.entries).toHaveLength(44);
    expect(pdb.entries.map((e) => e.entryIndex)).not.toContain(17);
    expect(pdb.entries.at(-1)).toEqual({ entryIndex: 44, trackId: 144, playlistId: 9 });
  });

  it('stops at the table\'s last page', () => {
    const pdb = readPdb(buildPdb([
      {
        type: 7,
        pages: [[{ bytes: playlistRow({ id: 1, name: 'Real' }) }]],
        decoyAfterLast: [{ bytes: playlistRow({ id: 2, name: 'Not part of the table' }) }],
      },
    ]));
    expect(pdb.playlists.map((p) => p.name)).toEqual(['Real']);
  });

  it('counts a present row it cannot read rather than failing the whole stick', () => {
    const pdb = readPdb(buildPdb([
      { type: 7, pages: [[{ bytes: garbageRow(40) }, { bytes: playlistRow({ id: 2, name: 'Fine' }) }]] },
    ]));
    expect(pdb.playlists.map((p) => p.name)).toEqual(['Fine']);
    expect(pdb.unreadableRows).toBe(1);
  });

  it('reads an export with no table of some type as empty', () => {
    const pdb = readPdb(buildPdb([{ type: 0, pages: [[]] }]));
    expect(pdb).toMatchObject({ tracks: [], playlists: [], entries: [] });
    expect(pdb.artists.size).toBe(0);
  });

  describe('a table that breaks off before its last page', () => {
    // buildExport lays out: header, then tracks on pages 1-2, artists 3-4, playlists 5-6, entries 7-8.
    const whole = () => buildExport({
      artists: [{ id: 1, name: 'A' }],
      tracks: [{ id: 1, title: 'T', artistId: 1, filePath: '/Contents/t.mp3' }],
      playlists: [{ id: 1, name: 'P' }],
      entries: [{ playlistId: 1, trackId: 1 }],
    });
    const linkPage = (buf: Buffer, page: number, next: number) => { buf.writeUInt32LE(next, page * PAGE_SIZE + 12); return buf; };

    it('reads the whole file as it is', () => {
      expect(readPdb(whole())).toMatchObject({ tracks: [{ id: 1 }], playlists: [{ id: 1 }], entries: [{ trackId: 1 }] });
    });

    it('refuses a file cut short, rather than reading a smaller stick', () => {
      expect(() => readPdb(whole().subarray(0, PAGE_SIZE))).toThrow(PdbFormatError);
      expect(() => readPdb(whole().subarray(0, 5 * PAGE_SIZE))).toThrow(/playlist.*damaged/);
    });

    it('refuses a link to a page of another table', () => {
      expect(() => readPdb(linkPage(whole(), 1, 5))).toThrow(/track.*damaged/);
    });

    it('refuses a chain that loops', () => {
      expect(() => readPdb(linkPage(whole(), 7, 7))).toThrow(PdbFormatError);
    });
  });

  it('refuses a file that is not an export', () => {
    expect(() => readPdb(Buffer.alloc(10))).toThrow(PdbFormatError);
    expect(() => readPdb(Buffer.from('<?xml version="1.0"?><DJ_PLAYLISTS>'.padEnd(4096)))).toThrow(PdbFormatError);
  });
});
