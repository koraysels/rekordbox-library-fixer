import { describe, it, expect } from 'vitest';
import type { NotOnStickEntry, PlaylistCheck, UsbCheckResult, UsbStick } from '../../src/main/ipcContract';
import {
  groupByReason, isIncomplete, orderPlaylists, pickStick, playlistStatus, reasonCounts,
} from '../../src/renderer/usb/usbReport';
import {
  extraLine, headline, playlistCounts, plugInDetail, plugInLine, reasonCountLine, reasonFix, reasonLabel,
  stickNotes, subline,
} from '../../src/renderer/usb/usbText';

const entry = (trackId: string, reason: NotOnStickEntry['reason'], drive?: string): NotOnStickEntry => ({
  trackId, name: `Track ${trackId}`, artist: 'Artist', location: `/Volumes/X/${trackId}.mp3`, reason,
  ...(drive ? { drive } : {}),
});

const playlist = (id: string, over: Partial<PlaylistCheck> = {}): PlaylistCheck => ({
  id, path: ['Sets', id], libraryCount: 10, stickCount: 10, onStick: true, notOnStick: [], extraOnStick: 0, ...over,
});

const result = (over: Partial<UsbCheckResult> = {}): UsbCheckResult => ({
  playlists: [],
  totals: {
    byReason: { 'drive-unplugged': 0, 'missing': 0, 'no-access': 0, 'streaming': 0, 'not-synced-yet': 0 },
    byDrive: [],
    emptyOnStick: 0,
  },
  leftovers: [],
  missingOnStick: [],
  notChecked: [],
  stick: { tracks: 0, playlists: 0 },
  syncList: { present: true, allPlaylists: false, unknownIds: 0 },
  ...over,
});

const stick = (over: Partial<UsbStick> = {}): UsbStick => ({
  root: '/Volumes/STICK', name: 'STICK', hasOneLibrary: false, hasSyncList: true, ...over,
});

describe('playlist status and order', () => {
  it('tells complete, incomplete, empty on the stick and absent apart', () => {
    expect(playlistStatus(playlist('a'))).toBe('complete');
    expect(playlistStatus(playlist('b', { stickCount: 9, notOnStick: [entry('1', 'missing')] }))).toBe('incomplete');
    expect(playlistStatus(playlist('c', { stickCount: 0, notOnStick: [entry('1', 'missing')] }))).toBe('empty-on-stick');
    expect(playlistStatus(playlist('d', { onStick: false, stickCount: 0 }))).toBe('not-on-stick');
    expect(isIncomplete(playlist('d', { onStick: false, stickCount: 0 }))).toBe(true);
    // Extra entries alone do not make a playlist incomplete: everything in the library is there.
    expect(isIncomplete(playlist('e', { extraOnStick: 2 }))).toBe(false);
  });

  it('puts the playlists that are shortest first, then the complete ones in library order', () => {
    const ordered = orderPlaylists([
      playlist('ok1'),
      playlist('short1', { notOnStick: [entry('1', 'missing')] }),
      playlist('ok2'),
      playlist('short3', { notOnStick: [entry('1', 'missing'), entry('2', 'missing'), entry('3', 'streaming')] }),
    ]);
    expect(ordered.map((p) => p.id)).toEqual(['short3', 'short1', 'ok1', 'ok2']);
  });
});

describe('reason counts and grouping', () => {
  it('lists only the reasons that occur, in fix order', () => {
    const r = result({ totals: { ...result().totals, byReason: { 'drive-unplugged': 5, 'missing': 2, 'no-access': 0, 'streaming': 0, 'not-synced-yet': 7 } } });
    expect(reasonCounts(r)).toEqual([
      { reason: 'drive-unplugged', count: 5 },
      { reason: 'missing', count: 2 },
      { reason: 'not-synced-yet', count: 7 },
    ]);
  });

  it('groups a playlist\'s missing entries by reason, one group per unplugged drive', () => {
    const groups = groupByReason([
      entry('1', 'not-synced-yet'),
      entry('2', 'drive-unplugged', 'DJ SSD'),
      entry('3', 'missing'),
      entry('4', 'drive-unplugged', 'OLD DISK'),
      entry('5', 'drive-unplugged', 'DJ SSD'),
    ]);
    expect(groups.map((g) => [g.reason, g.drive, g.entries.map((e) => e.trackId)])).toEqual([
      ['drive-unplugged', 'DJ SSD', ['2', '5']],
      ['drive-unplugged', 'OLD DISK', ['4']],
      ['missing', undefined, ['3']],
      ['not-synced-yet', undefined, ['1']],
    ]);
  });
});

describe('pickStick', () => {
  const a = stick({ root: '/Volumes/A', name: 'A' });
  const b = stick({ root: '/Volumes/B', name: 'B' });
  it('uses the only stick, keeps the one checked before, and otherwise asks', () => {
    expect(pickStick([a], null)).toBe(a);
    expect(pickStick([a, b], '/Volumes/B')).toBe(b);
    expect(pickStick([a, b], '/Volumes/GONE')).toBeNull();
    expect(pickStick([a, b], null)).toBeNull();
    expect(pickStick([], '/Volumes/A')).toBeNull();
  });
});

describe('wording', () => {
  it('heads the summary with the number of incomplete playlists on the stick', () => {
    const r = result({
      playlists: [
        playlist('a', { notOnStick: [entry('1', 'missing')] }),
        playlist('b', { onStick: false, stickCount: 0 }),
        playlist('c'),
      ],
    });
    expect(headline(r, 'STICK')).toBe('2 playlists incomplete on STICK');
    expect(headline(result({ playlists: [playlist('a', { notOnStick: [entry('1', 'missing')] })] }), 'STICK'))
      .toBe('1 playlist incomplete on STICK');
    expect(headline(result({ playlists: [playlist('c')] }), 'STICK')).toBe('Every synced playlist is complete on STICK');
    expect(headline(result(), 'STICK')).toBe('No synced playlists to check on STICK');
  });

  it('says how many were checked, empty and absent', () => {
    const r = result({
      playlists: [playlist('a'), playlist('b')],
      totals: { ...result().totals, emptyOnStick: 1 },
      missingOnStick: [['Sets', 'Gone']],
    });
    expect(subline(r)).toBe('2 playlists checked · 1 empty on the stick · 1 not on the stick at all');
    expect(subline(result({ playlists: [playlist('a')] }))).toBe('1 playlist checked');
  });

  it('names the drive to plug in with its tracks and entries', () => {
    expect(plugInLine({ drive: 'DJ SSD', tracks: 634 })).toBe('Plug in DJ SSD: 634 tracks');
    expect(plugInLine({ drive: 'DJ SSD', tracks: 1 })).toBe('Plug in DJ SSD: 1 track');
    expect(plugInDetail({ entries: 946 })).toBe('946 playlist entries live on it. Plug it in, then sync again in rekordbox.');
  });

  it('has a label and a fix for every reason, and points missing files at Track Relocation', () => {
    for (const r of ['drive-unplugged', 'missing', 'no-access', 'streaming', 'not-synced-yet'] as const) {
      expect(reasonLabel(r)).toBeTruthy();
      expect(reasonFix(r)).toBeTruthy();
    }
    expect(reasonFix('missing')).toMatch(/Track Relocation/);
    expect(reasonFix('not-synced-yet')).toMatch(/sync again in rekordbox/);
    expect(reasonCountLine('missing', 206)).toBe('File is gone: 206 entries');
    expect(reasonCountLine('streaming', 1)).toBe('Streaming track: 1 entry');
  });

  it('counts a playlist as library against stick', () => {
    expect(playlistCounts(playlist('a', { libraryCount: 87, stickCount: 27 }))).toBe('27 of 87 on the stick');
    expect(playlistCounts(playlist('a', { onStick: false, libraryCount: 3, stickCount: 0 }))).toBe('Not on the stick · 3 tracks in the library');
    expect(extraLine(2)).toBe('2 tracks on the stick are no longer in this playlist in the library.');
  });

  it('says in one line that a OneLibrary database is not checked, and when the stick was exported rather than synced', () => {
    expect(stickNotes(stick(), result())).toEqual([]);
    expect(stickNotes(stick({ hasOneLibrary: true }), result())[0]).toMatch(/^Only the Device Library \(CDJ-2000/);
    expect(stickNotes(stick(), result({ syncList: { present: false, allPlaylists: false, unknownIds: 0 } }))[0])
      .toMatch(/made with Export/);
    expect(stickNotes(stick(), result({ syncList: { present: true, allPlaylists: true, unknownIds: 0 } }))[0])
      .toMatch(/every playlist/);
  });
});
