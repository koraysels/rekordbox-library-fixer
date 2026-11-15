import { describe, it, expect } from 'vitest';
import { planDuplicates, pickKeeper, playlistSlots } from '../../src/main/wizard/duplicatesPlan';
import type { DuplicateSet } from '../../src/main/duplicateDetector';
import type { DbPlaylist, DbTrack } from '../../src/main/rekordboxDbParser';

const MUSIC = '/Users/dj/Music/Library';

const track = (id: string, location: string, extra: Partial<DbTrack> = {}): DbTrack => ({
  id, name: `Song ${id}`, artist: 'Artist', location,
  duration: 300, size: 1000, bitrate: 320, cues: [], loops: [], ...extra,
});
const hotcues = (n: number): DbTrack['cues'] =>
  Array.from({ length: n }, (_, i) => ({ name: '', type: 'CUE' as const, start: i, hotcue: i }));

const setOf = (...ts: DbTrack[]): DuplicateSet => ({
  id: ts.map((t) => t.id).join('-'),
  tracks: ts.map((t) => ({ id: t.id, name: t.name, artist: t.artist, location: t.location })),
  matchType: 'metadata',
  confidence: 1,
});
const library = (...ts: DbTrack[]) => new Map(ts.map((t) => [t.id, t]));

const deps = (overrides: Partial<Parameters<typeof planDuplicates>[4]> = {}) => ({
  sameContent: async () => true,
  exists: () => true,
  fileId: () => undefined,
  ...overrides,
});

describe('playlistSlots', () => {
  it('counts playlist memberships per track, through folders', () => {
    const playlists: DbPlaylist[] = [
      { name: 'A', type: 'PLAYLIST', tracks: ['1', '2'] },
      { name: 'F', type: 'FOLDER', tracks: [], children: [
        { name: 'B', type: 'PLAYLIST', tracks: ['1'] },
        { name: 'G', type: 'FOLDER', tracks: [], children: [{ name: 'C', type: 'PLAYLIST', tracks: ['1', '3'] }] },
      ] },
    ];
    const slots = playlistSlots(playlists);
    expect(slots.get('1')).toBe(3);
    expect(slots.get('2')).toBe(1);
    expect(slots.get('3')).toBe(1);
    expect(slots.get('4')).toBeUndefined();
  });
});

describe('pickKeeper', () => {
  it('counts playlist slots with cues and loops', () => {
    const a = track('1', '/x/a.mp3', { cues: hotcues(1) });
    const b = track('2', '/x/b.mp3');
    expect(pickKeeper([a, b], new Map([['2', 2]]), MUSIC).id).toBe('2');
  });

  it('prefers a higher bitrate, then a larger file, when lossless is equal', () => {
    const a = track('1', '/x/a.mp3', { bitrate: 256 });
    const b = track('2', '/x/b.mp3', { bitrate: 320 });
    expect(pickKeeper([a, b], new Map(), MUSIC).id).toBe('2');
    const c = track('3', '/x/c.mp3', { size: 2000 });
    const d = track('4', '/x/d.mp3', { size: 1000 });
    expect(pickKeeper([d, c], new Map(), MUSIC).id).toBe('3');
  });

  it('falls back to the lowest id', () => {
    const a = track('10', '/x/a.mp3');
    const b = track('9', '/x/b.mp3');
    expect(pickKeeper([a, b], new Map(), MUSIC).id).toBe('9');
  });
});

describe('planDuplicates', () => {
  it('merges entries that point at one file and trashes nothing', async () => {
    const a = track('1', '/x/a.mp3', { cues: hotcues(1) });
    const b = track('2', '/x/a.mp3');
    const plan = await planDuplicates([setOf(a, b)], library(a, b), [], MUSIC, deps());
    expect(plan.step).toBe('duplicates');
    expect(plan.merges).toEqual([
      { keepId: '1', removeIds: ['2'], keepName: 'Song 1', artist: 'Artist', trashPaths: [] },
    ]);
    expect(plan.setAside).toEqual([]);
  });

  it('treats NFD and NFC spellings of one path as one file without comparing content', async () => {
    const a = track('1', '/x/Café.mp3'.normalize('NFC'));
    const b = track('2', '/x/CAFÉ.mp3'.normalize('NFD'));
    let compared = false;
    const plan = await planDuplicates([setOf(a, b)], library(a, b), [], MUSIC,
      deps({ sameContent: async () => { compared = true; return false; } }));
    expect(compared).toBe(false);
    expect(plan.merges).toHaveLength(1);
    expect(plan.merges[0].trashPaths).toEqual([]);
  });

  it('keeps the entry with 3 hot cues over a higher bitrate copy and trashes the other file', async () => {
    const cued = track('1', '/x/a.mp3', { cues: hotcues(3), bitrate: 192 });
    const plain = track('2', '/y/a.mp3', { bitrate: 320 });
    const plan = await planDuplicates([setOf(plain, cued)], library(cued, plain), [], MUSIC, deps());
    expect(plan.merges).toEqual([
      { keepId: '1', removeIds: ['2'], keepName: 'Song 1', artist: 'Artist', trashPaths: ['/y/a.mp3'] },
    ]);
  });

  it('keeps the lossless one when cues tie', async () => {
    const mp3 = track('1', '/x/a.mp3', { bitrate: 320 });
    const aiff = track('2', '/x/a.aiff', { bitrate: 1411 });
    const wavLowBitrate = track('3', '/x/a.wav', { bitrate: 0 });
    const plan = await planDuplicates([setOf(mp3, aiff)], library(mp3, aiff), [], MUSIC, deps());
    expect(plan.merges[0].keepId).toBe('2');
    expect(pickKeeper([mp3, wavLowBitrate], new Map(), MUSIC).id).toBe('3');
  });

  it('keeps the one inside the music folder when everything else ties', async () => {
    const outside = track('1', '/Volumes/Old/a.mp3');
    const inside = track('2', `${MUSIC}/Downloads/a.mp3`);
    const plan = await planDuplicates([setOf(outside, inside)], library(outside, inside), [], MUSIC, deps());
    expect(plan.merges[0].keepId).toBe('2');
    expect(plan.merges[0].trashPaths).toEqual(['/Volumes/Old/a.mp3']);
  });

  it('sets aside files of the same size whose content differs', async () => {
    const a = track('1', '/x/a.mp3');
    const b = track('2', '/y/a.mp3');
    const plan = await planDuplicates([setOf(a, b)], library(a, b), [], MUSIC,
      deps({ sameContent: async () => false }));
    expect(plan.merges).toEqual([]);
    expect(plan.setAside).toEqual([{
      trackIds: ['1', '2'], name: 'Song 1', artist: 'Artist', location: '/x/a.mp3',
      why: 'Not certain these are the same recording',
    }]);
  });

  it('sets aside without comparing content when sizes or durations differ', async () => {
    let compared = 0;
    const sameContent = async () => { compared++; return true; };
    const a = track('1', '/x/a.mp3');
    const bigger = track('2', '/y/a.mp3', { size: 2000 });
    const longer = track('3', '/z/a.mp3', { duration: 302 });
    const plan = await planDuplicates(
      [setOf(a, bigger), setOf(a, longer)], library(a, bigger, longer), [], MUSIC, deps({ sameContent }));
    expect(plan.merges).toEqual([]);
    expect(plan.setAside.map((s) => s.why)).toEqual([
      'Not certain these are the same recording', 'Not certain these are the same recording',
    ]);
    expect(compared).toBe(0);
  });

  it('allows durations within one second', async () => {
    const a = track('1', '/x/a.mp3', { duration: 300 });
    const b = track('2', '/y/a.mp3', { duration: 300.8 });
    const plan = await planDuplicates([setOf(a, b)], library(a, b), [], MUSIC, deps());
    expect(plan.merges).toHaveLength(1);
  });

  it('sets aside a set with a missing file', async () => {
    const a = track('1', '/x/a.mp3');
    const b = track('2', '/Volumes/Gone/a.mp3');
    const plan = await planDuplicates([setOf(a, b)], library(a, b), [], MUSIC,
      deps({ exists: (p) => !p.startsWith('/Volumes/Gone') }));
    expect(plan.merges).toEqual([]);
    expect(plan.setAside[0].why).toBe('A file is missing');
  });

  it('does not trash a file a third entry outside the set still uses', async () => {
    const keep = track('1', '/x/a.mp3', { cues: hotcues(2) });
    const lose = track('2', '/y/a.mp3');
    const third = track('3', '/Y/A.mp3', { name: 'Elsewhere' });
    const plan = await planDuplicates([setOf(keep, lose)], library(keep, lose, third), [], MUSIC, deps());
    expect(plan.merges[0].removeIds).toEqual(['2']);
    expect(plan.merges[0].trashPaths).toEqual([]);
  });

  it('uses playlist slots when choosing the keeper', async () => {
    const a = track('1', '/x/a.mp3', { cues: hotcues(1) });
    const b = track('2', '/y/a.mp3');
    const playlists: DbPlaylist[] = [
      { name: 'P', type: 'PLAYLIST', tracks: ['2'] },
      { name: 'Q', type: 'PLAYLIST', tracks: ['2'] },
    ];
    const plan = await planDuplicates([setOf(a, b)], library(a, b), playlists, MUSIC, deps());
    expect(plan.merges[0].keepId).toBe('2');
  });

  it('leaves streaming entries and entries no longer in the library out of a set', async () => {
    const a = track('1', '/x/a.mp3');
    const stream = track('2', 'tidal:tracks:123');
    const plan = await planDuplicates(
      [setOf(a, stream), setOf(a, track('9', '/x/gone.mp3'))], library(a, stream), [], MUSIC, deps());
    expect(plan.merges).toEqual([]);
    expect(plan.setAside).toEqual([]);
  });

  it('never puts one entry in two merges', async () => {
    const a = track('1', '/x/a.mp3', { cues: hotcues(1) });
    const b = track('2', '/x/a.mp3');
    const c = track('3', '/x/a.mp3');
    const plan = await planDuplicates([setOf(a, b), setOf(b, c)], library(a, b, c), [], MUSIC, deps());
    const ids = plan.merges.flatMap((m) => [m.keepId, ...m.removeIds]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists a file for the Trash once even when two merges remove entries on it', async () => {
    const a = track('1', '/x/a.mp3', { cues: hotcues(3) });
    const b = track('2', '/y/a.mp3');
    const c = track('3', '/y/a.mp3');
    const d = track('4', '/z/a.mp3', { cues: hotcues(3) });
    const plan = await planDuplicates([setOf(a, b), setOf(c, d)], library(a, b, c, d), [], MUSIC, deps());
    expect(plan.merges.map((m) => m.keepId)).toEqual(['1', '4']);
    expect(plan.merges.flatMap((m) => m.trashPaths)).toEqual(['/y/a.mp3']);
  });

  describe('two spellings of one physical file', () => {
    // macOS ships /Volumes/Macintosh HD -> /, so these two paths are one file.
    const ALIAS = '/Volumes/Macintosh HD';
    const inodes: Record<string, string> = {
      '/Users/dj/Music/a.mp3': '1:100',
      [`${ALIAS}/Users/dj/Music/a.mp3`]: '1:100',
      '/Users/dj/Copies/a.mp3': '1:200',
      [`${ALIAS}/Users/dj/Copies/a.mp3`]: '1:200',
    };
    const fileId = (p: string) => inodes[p];

    it('merges them as one file, without comparing it with itself, and trashes nothing', async () => {
      const a = track('1', '/Users/dj/Music/a.mp3');
      const b = track('2', `${ALIAS}/Users/dj/Music/a.mp3`);
      let compared = 0;
      const plan = await planDuplicates([setOf(a, b)], library(a, b), [], MUSIC,
        deps({ fileId, sameContent: async () => { compared++; return true; } }));
      expect(compared).toBe(0);
      expect(plan.merges).toEqual([
        { keepId: '1', removeIds: ['2'], keepName: 'Song 1', artist: 'Artist', trashPaths: [] },
      ]);
    });

    it('does not trash a copy a third entry still reaches by another spelling', async () => {
      const keep = track('1', '/Users/dj/Music/a.mp3', { cues: hotcues(2) });
      const lose = track('2', '/Users/dj/Copies/a.mp3');
      const third = track('3', `${ALIAS}/Users/dj/Copies/a.mp3`, { name: 'Elsewhere' });
      const plan = await planDuplicates([setOf(keep, lose)], library(keep, lose, third), [], MUSIC,
        deps({ fileId }));
      expect(plan.merges[0].removeIds).toEqual(['2']);
      expect(plan.merges[0].trashPaths).toEqual([]);
    });

    it('lists a removed copy once when two removed entries spell it differently', async () => {
      const keep = track('1', '/Users/dj/Music/a.mp3', { cues: hotcues(2) });
      const lose = track('2', '/Users/dj/Copies/a.mp3');
      const loseAlias = track('3', `${ALIAS}/Users/dj/Copies/a.mp3`);
      const plan = await planDuplicates([setOf(keep, lose, loseAlias)], library(keep, lose, loseAlias), [], MUSIC,
        deps({ fileId }));
      expect(plan.merges[0].removeIds).toEqual(['2', '3']);
      expect(plan.merges[0].trashPaths).toEqual(['/Users/dj/Copies/a.mp3']);
    });

    it('never trashes the kept file when the keeper is reached by the alias', async () => {
      const keep = track('1', `${ALIAS}/Users/dj/Music/a.mp3`, { cues: hotcues(2) });
      const lose = track('2', '/Users/dj/Music/a.mp3');
      const copy = track('3', '/Users/dj/Copies/a.mp3');
      const plan = await planDuplicates([setOf(lose, copy, keep)], library(keep, lose, copy), [], MUSIC,
        deps({ fileId }));
      expect(plan.merges[0].keepId).toBe('1');
      expect(plan.merges[0].trashPaths).toEqual(['/Users/dj/Copies/a.mp3']);
    });
  });

  it('uses durationOf when given', async () => {
    const a = track('1', '/x/a.mp3');
    const b = track('2', '/y/a.mp3');
    const plan = await planDuplicates([setOf(a, b)], library(a, b), [], MUSIC,
      deps({ durationOf: (t) => (t.id === '1' ? 300 : 310) }));
    expect(plan.merges).toEqual([]);
  });
});
