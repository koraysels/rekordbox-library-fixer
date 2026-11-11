import { describe, it, expect, vi } from 'vitest';
import { gatherDestination, planGather, resolveClash } from '../../src/main/wizard/gatherPlan';
import { referenceKey } from '../../src/main/convert/applyConversions';
import type { DbTrack } from '../../src/main/rekordboxDbParser';

const MUSIC = '/Volumes/SSD/Music';
const GiB = 1024 ** 3;

const track = (id: string, location: string): DbTrack => ({
  id, name: `Song ${id}`, artist: 'Artist', location, cues: [], loops: [],
});
const library = (...ts: DbTrack[]) => new Map(ts.map((t) => [t.id, t]));

/** A disk where `files` exist (with sizes), plus the volume roots `mounted`. */
function disk(files: Record<string, number>, mounted: string[] = ['/', '/Volumes/SSD']) {
  const existing = new Set([...Object.keys(files), ...mounted]);
  return {
    platform: 'darwin' as NodeJS.Platform,
    exists: (p: string) => existing.has(p),
    sameContent: vi.fn(async () => false),
    fileSize: (p: string) => files[p] ?? 0,
    freeBytes: () => 100 * GiB,
  };
}

describe('gatherDestination', () => {
  it('keeps the name of the folder the file came from', () => {
    expect(gatherDestination('/Users/k/Downloads/Promos/a.mp3', MUSIC)).toBe('/Volumes/SSD/Music/Promos/a.mp3');
  });
});

describe('resolveClash', () => {
  const dest = `${MUSIC}/Promos/x.mp3`;

  it('uses the destination when nothing is there', async () => {
    const out = await resolveClash(dest, '/A/Promos/x.mp3', new Set(), { exists: () => false, sameContent: async () => false });
    expect(out).toEqual({ to: dest, reuseExisting: false });
  });

  it('reuses an identical file already there', async () => {
    const out = await resolveClash(dest, '/A/Promos/x.mp3', new Set(), { exists: (p) => p === dest, sameContent: async () => true });
    expect(out).toEqual({ to: dest, reuseExisting: true });
  });

  it('puts a different file next to it with (2), then (3)', async () => {
    const two = `${MUSIC}/Promos/x (2).mp3`;
    const out = await resolveClash(dest, '/A/Promos/x.mp3', new Set(), {
      exists: (p) => p === dest || p === two, sameContent: async () => false,
    });
    expect(out).toEqual({ to: `${MUSIC}/Promos/x (3).mp3`, reuseExisting: false });
  });

  it('skips a name another move of this run already took', async () => {
    const out = await resolveClash(dest, '/B/Promos/x.mp3', new Set([referenceKey(dest)]), {
      exists: () => false, sameContent: async () => true,
    });
    expect(out).toEqual({ to: `${MUSIC}/Promos/x (2).mp3`, reuseExisting: false });
  });
});

describe('planGather', () => {
  it('moves a track from another drive into <music>/<folder>/<file>', async () => {
    const from = '/Users/k/Downloads/Promos/a.mp3';
    const plan = await planGather(library(track('1', from)), MUSIC, disk({ [from]: 5000 }));
    expect(plan.moves).toEqual([{
      trackIds: ['1'], name: 'Song 1', from, to: '/Volumes/SSD/Music/Promos/a.mp3',
      crossDrive: true, reuseExisting: false, bytes: 5000,
    }]);
    expect(plan.bytesCrossDrive).toBe(5000);
    expect(plan.refusal).toBeUndefined();
  });

  it('marks a move on the music folder\'s own drive as same-drive', async () => {
    const from = '/Volumes/SSD/Downloads/Promos/a.mp3';
    const plan = await planGather(library(track('1', from)), MUSIC, disk({ [from]: 5000 }));
    expect(plan.moves[0].crossDrive).toBe(false);
    expect(plan.bytesCrossDrive).toBe(0);
  });

  it('leaves a track already inside the music folder alone', async () => {
    const inside = `${MUSIC}/House/b.mp3`;
    const plan = await planGather(library(track('1', inside)), MUSIC, disk({ [inside]: 1 }));
    expect(plan.moves).toEqual([]);
  });

  it('moves a file two entries share once, carrying both entries', async () => {
    const from = '/Users/k/Downloads/Promos/a.mp3';
    const plan = await planGather(library(track('1', from), track('2', from.normalize('NFD').toUpperCase())), MUSIC,
      disk({ [from]: 10, [from.normalize('NFD').toUpperCase()]: 10 }));
    expect(plan.moves).toHaveLength(1);
    expect(plan.moves[0].trackIds).toEqual(['1', '2']);
  });

  it('two sources to one name get (2)', async () => {
    const a = '/A/Promos/x.mp3';
    const b = '/B/Promos/x.mp3';
    const plan = await planGather(library(track('1', a), track('2', b)), MUSIC, disk({ [a]: 1, [b]: 2 }));
    expect(plan.moves.map((m) => m.to)).toEqual([`${MUSIC}/Promos/x.mp3`, `${MUSIC}/Promos/x (2).mp3`]);
  });

  it('reuses an identical file already at the destination', async () => {
    const from = '/Users/k/Promos/a.mp3';
    const dest = `${MUSIC}/Promos/a.mp3`;
    const d = disk({ [from]: 10, [dest]: 10 });
    d.sameContent.mockResolvedValue(true);
    const plan = await planGather(library(track('1', from)), MUSIC, d);
    expect(plan.moves[0]).toMatchObject({ to: dest, reuseExisting: true });
    // Nothing is copied for a reused file, so it needs no room.
    expect(plan.bytesCrossDrive).toBe(0);
  });

  it('gives a different file at the destination a (2)', async () => {
    const from = '/Users/k/Promos/a.mp3';
    const dest = `${MUSIC}/Promos/a.mp3`;
    const plan = await planGather(library(track('1', from)), MUSIC, disk({ [from]: 10, [dest]: 99 }));
    expect(plan.moves[0]).toMatchObject({ to: `${MUSIC}/Promos/a (2).mp3`, reuseExisting: false });
  });

  it('lists a track on an unplugged drive under its drive and never moves it', async () => {
    const plan = await planGather(
      library(track('1', '/Volumes/Old/Promos/a.mp3'), track('2', '/Volumes/Old/Promos/b.mp3')),
      MUSIC, disk({}),
    );
    expect(plan.moves).toEqual([]);
    expect(plan.unplugged).toEqual([{ drive: '/Volumes/Old', count: 2 }]);
  });

  it('leaves out streaming tracks and missing files on a plugged-in drive', async () => {
    const plan = await planGather(
      library(track('1', 'tidal:tracks:123'), track('2', '/Users/k/gone/a.mp3')),
      MUSIC, disk({}),
    );
    expect(plan.moves).toEqual([]);
    expect(plan.unplugged).toEqual([]);
  });

  it('refuses up front when the music folder\'s drive lacks the room', async () => {
    const from = '/Users/k/Promos/big.wav';
    const d = { ...disk({ [from]: 2 * GiB }), freeBytes: () => 2.5 * GiB };
    const plan = await planGather(library(track('1', from)), MUSIC, d);
    expect(plan.refusal).toBe('Not enough space on SSD: needs 3.0 GB, has 2.5 GB');
    expect(plan.freeBytes).toBe(2.5 * GiB);
  });

  it('does not ask for headroom when nothing crosses drives', async () => {
    const from = '/Volumes/SSD/Downloads/a.mp3';
    const d = { ...disk({ [from]: 10 }), freeBytes: () => 0 };
    const plan = await planGather(library(track('1', from)), MUSIC, d);
    expect(plan.refusal).toBeUndefined();
  });

  it('refuses when the music folder\'s own drive is not plugged in', async () => {
    const from = '/Users/k/Promos/a.mp3';
    const plan = await planGather(library(track('1', from)), MUSIC, disk({ [from]: 1 }, ['/']));
    expect(plan.moves).toEqual([]);
    expect(plan.refusal).toMatch(/Plug in SSD/);
  });

  it('treats two spellings of one file as one file', async () => {
    const a = '/Volumes/Macintosh HD/Users/k/Promos/a.mp3';
    const b = '/Users/k/Promos/a.mp3';
    const d = { ...disk({ [a]: 10, [b]: 10 }, ['/', '/Volumes/SSD', '/Volumes/Macintosh HD']), fileId: () => 'same' };
    const plan = await planGather(library(track('1', a), track('2', b)), MUSIC, d);
    expect(plan.moves).toHaveLength(1);
    expect(plan.moves[0].trackIds).toEqual(['1', '2']);
  });

  it('leaves a file alone that an entry inside the music folder reaches by another spelling', async () => {
    const outside = '/Volumes/Macintosh HD/Users/k/Music/Promos/a.mp3';
    const inside = '/Users/k/Music/Promos/a.mp3';
    const d = {
      ...disk({ [outside]: 10, [inside]: 10 }, ['/', '/Volumes/Macintosh HD']),
      fileId: () => 'same',
    };
    const plan = await planGather(library(track('1', outside), track('2', inside)), '/Users/k/Music', d);
    expect(plan.moves).toEqual([]);
  });

  it('never plans a file onto itself under another spelling', async () => {
    // The music folder reached through an alias: the "destination" is the source.
    const from = '/Volumes/Macintosh HD/Users/k/Downloads/Promos/a.mp3';
    const dest = '/Users/k/Downloads/Promos/a.mp3';
    const d = {
      ...disk({ [from]: 10, [dest]: 10 }, ['/', '/Volumes/Macintosh HD']),
      fileId: () => 'same',
    };
    d.sameContent.mockResolvedValue(true);
    const plan = await planGather(library(track('1', from)), '/Users/k/Downloads', d);
    expect(plan.moves).toEqual([]);
  });

  it('plans nothing without a music folder', async () => {
    const from = '/Users/k/Promos/a.mp3';
    const plan = await planGather(library(track('1', from)), '', disk({ [from]: 1 }));
    expect(plan.moves).toEqual([]);
  });
});
