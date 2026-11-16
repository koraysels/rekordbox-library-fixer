import { describe, it, expect, vi } from 'vitest';
import {
  checkUsb, flattenLibraryPlaylists, type FileState, type LibraryTrackRef, type UsbCheckDeps,
} from '../../src/main/usb/usbCheck';
import { readPdb, type PdbExport, type PdbTrack } from '../../src/main/usb/pdbReader';
import type { DbPlaylist } from '../../src/main/rekordboxDbParser';
import type { SyncList } from '../../src/main/usb/syncList';
import { buildExport } from './helpers/pdbBuilder';

/** Everything off the boot disk lives under /Volumes/<drive>; only GONE is unplugged. */
function fakeDeps(states: Record<string, FileState> = {}): UsbCheckDeps & { fileState: ReturnType<typeof vi.fn> } {
  return {
    fileState: vi.fn(async (p: string) => states[p] ?? 'ok'),
    isVolumeMounted: (p) => !p.startsWith('/Volumes/GONE/'),
    driveName: (p) => (p.startsWith('/Volumes/') ? p.split('/')[2] : '/'),
  };
}

const track = (id: string, location: string, name = `Title ${id}`, artist = 'Artist'): LibraryTrackRef =>
  ({ id, name, artist, location });

const tracksMap = (...tracks: LibraryTrackRef[]) => new Map(tracks.map((t) => [t.id, t]));

const list = (id: string, name: string, tracks: string[], attribute = 0): DbPlaylist =>
  ({ id, name, tracks, type: 'PLAYLIST', attribute, children: [] });

const folder = (id: string, name: string, children: DbPlaylist[]): DbPlaylist =>
  ({ id, name, tracks: [], type: 'FOLDER', attribute: 1, children });

const sync = (ids: string[], allPlaylists = false): SyncList =>
  ({ allPlaylists, automaticSync: true, nodes: ids.map((id) => ({ id, parentId: '0', attribute: 0 })) });

/** A stick built from playlists of [fileName, title?, artist?] entries. */
function stick(
  playlists: Array<{ name: string; files: Array<string | [string, string, string]>; parentId?: number; id?: number; folder?: boolean }>,
): PdbExport {
  const tracks: PdbTrack[] = [];
  const artists = new Map<number, string>();
  const entries: PdbExport['entries'] = [];
  const out: PdbExport['playlists'] = [];
  playlists.forEach((p, i) => {
    const id = p.id ?? i + 1;
    out.push({ id, parentId: p.parentId ?? 0, sortOrder: i, isFolder: Boolean(p.folder), name: p.name });
    p.files.forEach((f, n) => {
      const [fileName, title, artist] = typeof f === 'string' ? [f, f, ''] : f;
      const trackId = tracks.length + 1;
      const artistId = artists.size + 1;
      artists.set(artistId, artist);
      tracks.push({ id: trackId, title, artistId, fileName, filePath: `/Contents/${fileName}` });
      entries.push({ entryIndex: n + 1, trackId, playlistId: id });
    });
  });
  return { tracks, artists, playlists: out, entries, unreadableRows: 0 };
}

describe('checkUsb', () => {
  it('gives every entry missing from the stick its reason', async () => {
    const tracks = tracksMap(
      track('1', '/Music/on stick.mp3'),
      track('2', '/Volumes/GONE/Music/away.mp3'),
      track('3', '/Music/deleted.mp3'),
      track('4', '/Users/me/Downloads/locked.mp3'),
      track('5', 'tidal:tracks:123'),
      track('6', '/Volumes/DJ SSD/new.flac'),
    );
    const deps = fakeDeps({ '/Music/deleted.mp3': 'missing', '/Users/me/Downloads/locked.mp3': 'no-access' });
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([list('10', 'Gig', ['1', '2', '3', '4', '5', '6'])]),
      tracks,
      stick: stick([{ name: 'Gig', files: ['on stick.mp3'] }]),
      syncList: sync(['10']),
    }, deps);

    expect(result.playlists).toHaveLength(1);
    const [gig] = result.playlists;
    expect(gig).toMatchObject({ id: '10', path: ['Gig'], libraryCount: 6, stickCount: 1, onStick: true, extraOnStick: 0 });
    expect(gig.notOnStick.map((e) => [e.trackId, e.reason, e.drive])).toEqual([
      ['2', 'drive-unplugged', 'GONE'],
      ['3', 'missing', undefined],
      ['4', 'no-access', undefined],
      ['5', 'streaming', undefined],
      ['6', 'not-synced-yet', undefined],
    ]);
    expect(result.totals.byReason).toEqual({
      'drive-unplugged': 1, missing: 1, 'no-access': 1, streaming: 1, 'not-synced-yet': 1,
    });
    // A file on an unplugged drive cannot be checked, and a streaming track has no file.
    expect(deps.fileState).not.toHaveBeenCalledWith('/Volumes/GONE/Music/away.mp3');
    expect(deps.fileState).not.toHaveBeenCalledWith('tidal:tracks:123');
  });

  it('totals each unplugged drive by entries and by tracks, checking each file once', async () => {
    const deps = fakeDeps();
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([
        list('1', 'A', ['x', 'y']),
        list('2', 'B', ['x']),
        list('3', 'C', ['z']),
      ]),
      tracks: tracksMap(
        track('x', '/Volumes/GONE/x.mp3'),
        track('y', '/Volumes/GONE/y.mp3'),
        track('z', '/Music/z.mp3'),
      ),
      stick: stick([{ name: 'A', files: [] }, { name: 'B', files: [] }, { name: 'C', files: [] }]),
      syncList: sync(['1', '2', '3']),
    }, deps);
    expect(result.totals.byDrive).toEqual([{ drive: 'GONE', entries: 3, tracks: 2 }]);
    expect(result.totals.emptyOnStick).toBe(3);
    expect(deps.fileState).toHaveBeenCalledTimes(1);
  });

  it('pairs a file rekordbox renamed for the stick by title and artist', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([list('1', 'Rock', ['1', '2'])]),
      tracks: tracksMap(
        track('1', '/Music/AC:DC - Back in Black?.mp3', 'Back in Black', 'AC/DC'),
        // Decomposed é and a different case: the same name to macOS.
        track('2', '/Music/Café Olé.MP3', 'Other', 'Someone'),
      ),
      stick: stick([{ name: 'Rock', files: [
        ['AC_DC - Back in Black_.mp3', 'Back in Black', 'AC/DC'],
        ['café olé.mp3', 'Another title', 'Another artist'],
      ] }]),
      syncList: sync(['1']),
    }, fakeDeps());
    expect(result.playlists[0]).toMatchObject({ stickCount: 2, notOnStick: [], extraOnStick: 0 });
  });

  it('counts a track in a playlist twice as two entries, on either side', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([
        list('1', 'Twice in library', ['1', '1']),
        list('2', 'Twice on stick', ['2']),
      ]),
      tracks: tracksMap(track('1', '/Music/one.mp3'), track('2', '/Music/two.mp3')),
      stick: stick([
        { name: 'Twice in library', files: ['one.mp3'] },
        { name: 'Twice on stick', files: ['two.mp3', 'two.mp3'] },
      ]),
      syncList: sync(['1', '2']),
    }, fakeDeps());
    const [inLibrary, onStick] = result.playlists;
    expect(inLibrary).toMatchObject({ libraryCount: 2, stickCount: 1, extraOnStick: 0 });
    expect(inLibrary.notOnStick.map((e) => e.reason)).toEqual(['not-synced-yet']);
    expect(onStick).toMatchObject({ libraryCount: 1, stickCount: 2, extraOnStick: 1, notOnStick: [] });
  });

  it('does not let a renamed match take the stick entry another entry matches by file name', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([list('1', 'P', ['a', 'b'])]),
      tracks: tracksMap(
        track('a', '/Music/renamed?.mp3', 'Same', 'Artist'),
        track('b', '/Music/exact.mp3', 'Same', 'Artist'),
      ),
      stick: stick([{ name: 'P', files: [['exact.mp3', 'Same', 'Artist']] }]),
      syncList: sync(['1']),
    }, fakeDeps());
    expect(result.playlists[0].notOnStick.map((e) => e.trackId)).toEqual(['a']);
  });

  it('lists stick playlists the sync list does not account for as leftovers', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([list('1', 'Synced', []), list('2', 'Not synced', [])]),
      tracks: tracksMap(),
      stick: stick([
        { name: 'Synced', files: [] },
        { name: 'Not synced', files: ['a.mp3'] },
        { name: 'Old export', files: ['b.mp3', 'c.mp3'] },
      ]),
      syncList: sync(['1']),
    }, fakeDeps());
    expect(result.playlists.map((p) => p.path)).toEqual([['Synced']]);
    expect(result.leftovers).toEqual([
      { path: ['Not synced'], stickCount: 1 },
      { path: ['Old export'], stickCount: 2 },
    ]);
  });

  it('names a synced playlist the stick lacks altogether, and why its tracks are not there', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([folder('1', 'Gigs', [list('2', 'Friday', ['t'])])]),
      tracks: tracksMap(track('t', '/Volumes/GONE/t.mp3')),
      stick: stick([]),
      syncList: sync(['2']),
    }, fakeDeps());
    expect(result.missingOnStick).toEqual([['Gigs', 'Friday']]);
    expect(result.playlists[0]).toMatchObject({ onStick: false, stickCount: 0, libraryCount: 1 });
    expect(result.playlists[0].notOnStick[0]).toMatchObject({ reason: 'drive-unplugged', drive: 'GONE' });
  });

  it('lists a synced smart playlist as not checked', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([list('1', 'Smart', [], 4), list('2', 'Smart elsewhere', [], 4)]),
      tracks: tracksMap(),
      stick: stick([{ name: 'Smart', files: ['a.mp3', 'b.mp3'] }]),
      syncList: sync(['1', '2']),
    }, fakeDeps());
    expect(result.playlists).toEqual([]);
    expect(result.notChecked).toEqual([
      { id: '1', path: ['Smart'], stickCount: 2 },
      { id: '2', path: ['Smart elsewhere'], stickCount: null },
    ]);
    expect(result.leftovers).toEqual([]);
  });

  it('checks every playlist below a synced folder, matching the stick by path', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([
        folder('1', 'Crates', [list('2', 'House', []), folder('3', 'Deep', [list('4', 'House', [])])]),
        list('5', 'House', []),
      ]),
      tracks: tracksMap(),
      stick: stick([
        { id: 1, name: 'Crates', files: [], folder: true },
        { id: 2, name: 'House', files: ['a.mp3'], parentId: 1 },
        { id: 3, name: 'Deep', files: [], folder: true, parentId: 1 },
        { id: 4, name: 'House', files: ['b.mp3', 'c.mp3'], parentId: 3 },
      ]),
      syncList: sync(['1']),
    }, fakeDeps());
    expect(result.playlists.map((p) => [p.path.join('/'), p.stickCount])).toEqual([
      ['Crates/House', 1],
      ['Crates/Deep/House', 2],
    ]);
    expect(result.leftovers).toEqual([]);
  });

  it('finds a playlist moved into another folder by its name, when only one has it', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([folder('1', 'Archive', [list('2', 'Friday', [])])]),
      tracks: tracksMap(),
      stick: stick([{ name: 'friday', files: ['a.mp3'] }]),
      syncList: sync(['2']),
    }, fakeDeps());
    expect(result.playlists[0]).toMatchObject({ onStick: true, stickCount: 1 });
    expect(result.missingOnStick).toEqual([]);
  });

  it('checks every playlist when the sync list says all, and counts ids the library no longer has', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([list('1', 'A', []), list('2', 'B', [])]),
      tracks: tracksMap(),
      stick: stick([{ name: 'A', files: [] }]),
      syncList: { ...sync(['999']), allPlaylists: true },
    }, fakeDeps());
    expect(result.playlists.map((p) => p.path[0])).toEqual(['A', 'B']);
    expect(result.missingOnStick).toEqual([['B']]);
    expect(result.syncList).toEqual({ present: true, allPlaylists: true, unknownIds: 1 });
  });

  it('without a sync list (a stick made with Export), checks the playlists the stick carries', async () => {
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([list('1', 'Exported', ['t']), list('2', 'Never exported', ['t'])]),
      tracks: tracksMap(track('t', '/Music/t.mp3')),
      stick: stick([{ name: 'Exported', files: [] }, { name: 'Only on stick', files: ['x.mp3'] }]),
      syncList: null,
    }, fakeDeps());
    expect(result.playlists.map((p) => p.path[0])).toEqual(['Exported']);
    expect(result.playlists[0].notOnStick.map((e) => e.reason)).toEqual(['not-synced-yet']);
    expect(result.missingOnStick).toEqual([]);
    expect(result.leftovers).toEqual([{ path: ['Only on stick'], stickCount: 1 }]);
    expect(result.syncList).toEqual({ present: false, allPlaylists: false, unknownIds: 0 });
  });

  it('works on what the reader makes of a real export file', async () => {
    const pdb = readPdb(buildExport({
      artists: [{ id: 1, name: 'Artist' }],
      tracks: [{ id: 5, title: 'Title a', artistId: 1, filePath: '/Contents/Artist/a.mp3' }],
      playlists: [{ id: 3, name: 'Gig' }],
      entries: [{ playlistId: 3, trackId: 5 }],
    }));
    const result = await checkUsb({
      playlists: flattenLibraryPlaylists([list('1', 'Gig', ['a', 'b'])]),
      tracks: tracksMap(track('a', '/Music/a.mp3'), track('b', '/Volumes/GONE/b.mp3')),
      stick: pdb,
      syncList: sync(['1']),
    }, fakeDeps());
    expect(result.playlists[0]).toMatchObject({ libraryCount: 2, stickCount: 1 });
    expect(result.playlists[0].notOnStick).toEqual([
      { trackId: 'b', name: 'Title b', artist: 'Artist', location: '/Volumes/GONE/b.mp3', reason: 'drive-unplugged', drive: 'GONE' },
    ]);
    expect(result.stick).toEqual({ tracks: 1, playlists: 1 });
  });
});

describe('flattenLibraryPlaylists', () => {
  it('gives each playlist its path, kind and the folders above it', () => {
    expect(flattenLibraryPlaylists([folder('1', 'A', [list('2', 'B', ['t'], 0), list('3', 'S', [], 4)])])).toEqual([
      { id: '1', path: ['A'], kind: 'folder', trackIds: [], ancestorIds: [] },
      { id: '2', path: ['A', 'B'], kind: 'list', trackIds: ['t'], ancestorIds: ['1'] },
      { id: '3', path: ['A', 'S'], kind: 'smart', trackIds: [], ancestorIds: ['1'] },
    ]);
  });
});
