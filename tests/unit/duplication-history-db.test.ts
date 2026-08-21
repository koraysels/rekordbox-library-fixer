import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { duplicationHistoryStorage, type ActivityEntry } from '../../src/renderer/db/duplicationHistoryDb';

const LIB = '/lib/newlib.xml';

const entry = (over: Partial<ActivityEntry> = {}): Omit<ActivityEntry, 'id'> => ({
  libraryPath: LIB,
  timestamp: new Date('2026-01-01T10:00:00Z'),
  type: 'duplicate-merge',
  summary: 'Merged 1 set',
  details: [{ action: 'merged', trackName: 'Song' }],
  ...over,
});

beforeEach(async () => {
  await duplicationHistoryStorage.clear(LIB);
  await duplicationHistoryStorage.clear('/other.xml');
});

describe('duplicationHistoryStorage', () => {
  it('records an operation and reads it back with its details', async () => {
    await duplicationHistoryStorage.record(entry({
      summary: 'Merged 2 sets, 1 file to trash',
      backupPath: '/lib/newlib.xml.backup.1',
      details: [
        { action: 'merged', trackName: 'A' },
        { action: 'trashed', from: '/music/dup.mp3' },
      ],
    }));

    const list = await duplicationHistoryStorage.list(LIB);
    expect(list).toHaveLength(1);
    expect(list[0].summary).toBe('Merged 2 sets, 1 file to trash');
    expect(list[0].backupPath).toBe('/lib/newlib.xml.backup.1');
    expect(list[0].details).toHaveLength(2);
    expect(list[0].details[1]).toMatchObject({ action: 'trashed', from: '/music/dup.mp3' });
  });

  it('returns newest first', async () => {
    await duplicationHistoryStorage.record(entry({ summary: 'old', timestamp: new Date('2026-01-01T10:00:00Z') }));
    await duplicationHistoryStorage.record(entry({ summary: 'new', timestamp: new Date('2026-01-02T10:00:00Z') }));
    const list = await duplicationHistoryStorage.list(LIB);
    expect(list.map((e) => e.summary)).toEqual(['new', 'old']);
  });

  it('keeps libraries separate', async () => {
    await duplicationHistoryStorage.record(entry({ summary: 'mine' }));
    await duplicationHistoryStorage.record(entry({ libraryPath: '/other.xml', summary: 'theirs' }));
    const list = await duplicationHistoryStorage.list(LIB);
    expect(list.map((e) => e.summary)).toEqual(['mine']);
  });

  it('records failures so a bad operation is visible', async () => {
    await duplicationHistoryStorage.record(entry({
      summary: 'Merged 1 set, 1 file could not be trashed',
      details: [{ action: 'failed', from: '/music/locked.mp3', error: 'EPERM' }],
    }));
    const [row] = await duplicationHistoryStorage.list(LIB);
    expect(row.details[0]).toMatchObject({ action: 'failed', error: 'EPERM' });
  });

  it('clear removes only that library history', async () => {
    await duplicationHistoryStorage.record(entry());
    await duplicationHistoryStorage.record(entry({ libraryPath: '/other.xml' }));
    await duplicationHistoryStorage.clear(LIB);
    expect(await duplicationHistoryStorage.list(LIB)).toHaveLength(0);
    expect(await duplicationHistoryStorage.list('/other.xml')).toHaveLength(1);
  });
});
