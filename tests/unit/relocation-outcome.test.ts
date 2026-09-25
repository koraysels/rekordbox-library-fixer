import { describe, it, expect, vi, beforeEach } from 'vitest';

const recorded: any[] = [];
const relocationEntries: any[] = [];
const notified: string[] = [];

vi.mock('../../src/renderer/db/duplicationHistoryDb', () => ({
  duplicationHistoryStorage: { record: vi.fn(async (e: any) => { recorded.push(e); }) },
}));
vi.mock('../../src/renderer/db/historyDb', () => ({
  historyStorage: { addRelocationEntry: vi.fn(async (e: any) => { relocationEntries.push(e); }) },
  historyEvents: { notifyHistoryUpdate: vi.fn((p: string) => { notified.push(p); }) },
}));

import {
  describeRelocationWrite, withRelocatedTracks, recordRelocationRun,
} from '../../src/renderer/relocation/relocationOutcome';

beforeEach(() => {
  recorded.length = 0; relocationEntries.length = 0; notified.length = 0;
});

describe('describeRelocationWrite', () => {
  it('names the database when that is what was written', () => {
    // "XML updated" sent DJs looking in the wrong place for their own fix.
    const message = describeRelocationWrite({
      libraryPath: '/Users/dj/Library/Pioneer/rekordbox/master.db',
      tracksUpdated: 3,
      backupPath: '/x/master.db.backup.2026',
    });
    expect(message).toContain('Written into the rekordbox database for 3 tracks.');
    expect(message).toContain('Reopen rekordbox to see it.');
    expect(message).toContain('Backed up first: master.db.backup.2026');
  });

  it('names the XML when that is what was written', () => {
    const message = describeRelocationWrite({
      libraryPath: '/Users/dj/collection.xml', tracksUpdated: 1, backupPath: '/x/c.xml.bak',
    });
    expect(message).toContain('XML updated for 1 track.');
    expect(message).not.toContain('Reopen rekordbox');
  });

  it('says nothing when nothing was written', () => {
    expect(describeRelocationWrite({ libraryPath: '/x/master.db', tracksUpdated: 0 })).toBe('');
  });

  it('leaves out the backup line when there was no backup', () => {
    expect(describeRelocationWrite({ libraryPath: '/x/c.xml', tracksUpdated: 2 }))
      .not.toContain('Backed up');
  });
});

describe('withRelocatedTracks', () => {
  const library = () => ({
    libraryPath: '/x/c.xml',
    tracks: new Map([
      ['1', { id: '1', name: 'Song', location: '/old/song.mp3' }],
      ['2', { id: '2', name: 'Other', location: '/old/other.mp3' }],
    ]),
  }) as any;

  it('points the relocated tracks at their new files', () => {
    const next = withRelocatedTracks(library(), [
      { trackId: '1', success: true, newLocation: '/new/song.mp3' } as any,
    ]);
    expect(next!.tracks.get('1').location).toBe('/new/song.mp3');
    expect(next!.tracks.get('2').location).toBe('/old/other.mp3');
  });

  it('leaves the failures alone', () => {
    const next = withRelocatedTracks(library(), [
      { trackId: '1', success: false, newLocation: '/new/song.mp3' } as any,
    ]);
    expect(next!.tracks.get('1').location).toBe('/old/song.mp3');
  });

  it('returns the same object when nothing moved, so nothing re-renders', () => {
    const before = library();
    expect(withRelocatedTracks(before, [])).toBe(before);
  });

  it('copes with no library at all', () => {
    expect(withRelocatedTracks(null, [])).toBeNull();
  });
});

describe('recordRelocationRun', () => {
  const missing = [{ id: '1', name: 'Song', artist: 'A' }] as any[];
  const run = (over: any = {}) => recordRelocationRun({
    libraryPath: '/x/c.xml',
    results: [{ trackId: '1', success: true, oldLocation: '/old', newLocation: '/new' }] as any,
    tracksUpdated: 1,
    backupPath: '/x/backup',
    method: 'manual',
    ...over,
  }, missing);

  it('records the run in the activity history', async () => {
    await run();
    expect(recorded[0].type).toBe('relocation');
    expect(recorded[0].summary).toBe('Relocated 1 of 1 track');
    expect(recorded[0].backupPath).toBe('/x/backup');
  });

  it('records each relocated track', async () => {
    await run();
    expect(relocationEntries[0]).toMatchObject({
      trackId: '1', trackName: 'Song', newLocation: '/new', relocationMethod: 'manual',
    });
  });

  it('keeps the confidence an automatic match reported', async () => {
    await run({
      method: 'auto',
      results: [{ trackId: '1', success: true, oldLocation: '/old', newLocation: '/new', confidence: 0.92 }],
    });
    expect(relocationEntries[0].confidence).toBe(0.92);
  });

  it('tells the History tab to refresh', async () => {
    await run();
    expect(notified).toEqual(['/x/c.xml']);
  });

  it('still records the run when every track failed', async () => {
    await run({ results: [{ trackId: '1', success: false, oldLocation: '/old', error: 'nope' }] });
    expect(recorded[0].summary).toBe('Relocated 0 of 1 track');
    expect(relocationEntries).toHaveLength(0);
  });

  it('does not record per-track history without a library path', async () => {
    await run({ libraryPath: '' });
    expect(relocationEntries).toHaveLength(0);
  });
});
