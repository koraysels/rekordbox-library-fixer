import { describe, it, expect } from 'vitest';
import { historyEntryFor } from '@renderer/wizard/wizardHistory';
import type { StepResult } from '../../src/main/wizard/types';

const now = new Date('2026-11-11T10:00:00.000Z');
const lib = '/Users/dj/Library/Pioneer/rekordbox/master.db';

const result = (over: Partial<StepResult>): StepResult => ({
  step: 'relocate', changed: 0, details: [], cancelled: false, ...over,
});

describe('historyEntryFor', () => {
  it('relocate: a relocation entry with backup and details', () => {
    const details: StepResult['details'] = [
      { action: 'relocated', trackName: 'A', from: '/old/a.mp3', to: '/new/a.mp3' },
      { action: 'failed', trackName: 'B', from: '/old/b.mp3', error: 'Not relocated: gone' },
    ];
    const entry = historyEntryFor(result({ step: 'relocate', changed: 12, backupPath: '/bk', details }), lib, now);
    expect(entry).toEqual({
      libraryPath: lib,
      timestamp: now,
      type: 'relocation',
      summary: 'Wizard: relocated 12 tracks',
      backupPath: '/bk',
      details,
    });
  });

  it('relocate: one track is singular', () => {
    expect(historyEntryFor(result({ step: 'relocate', changed: 1 }), lib, now).summary).toBe('Wizard: relocated 1 track');
  });

  it('remove: an entry-removal entry', () => {
    const details: StepResult['details'] = [{ action: 'removed', trackName: 'A', from: '/gone/a.mp3' }];
    const entry = historyEntryFor(result({ step: 'remove', changed: 3, details }), lib, now);
    expect(entry.type).toBe('entry-removal');
    expect(entry.summary).toBe('Wizard: removed 3 entries that could not be found');
    expect(entry.details).toEqual(details);
  });

  it('duplicates: a duplicate-merge entry counting removed entries and trashed files', () => {
    const entry = historyEntryFor(result({
      step: 'duplicates',
      changed: 5,
      details: [
        { action: 'merged', trackName: 'A' },
        { action: 'trashed', from: '/x/a (1).mp3' },
        { action: 'trashed', from: '/x/a (2).mp3' },
      ],
    }), lib, now);
    expect(entry.type).toBe('duplicate-merge');
    expect(entry.summary).toBe('Wizard: merged duplicates, 5 entries removed, 2 files moved to the Trash');
  });

  it('duplicates: no trash mention when nothing was trashed', () => {
    expect(historyEntryFor(result({ step: 'duplicates', changed: 1 }), lib, now).summary)
      .toBe('Wizard: merged duplicates, 1 entry removed');
  });

  it('gather: a consolidate entry', () => {
    const entry = historyEntryFor(result({ step: 'gather', changed: 300 }), lib, now);
    expect(entry.type).toBe('consolidate');
    expect(entry.summary).toBe('Wizard: moved 300 files into your music folder');
  });

  it('convert: a conversion entry', () => {
    const entry = historyEntryFor(result({ step: 'convert', changed: 12 }), lib, now);
    expect(entry.type).toBe('conversion');
    expect(entry.summary).toBe('Wizard: converted 12 tracks');
  });

  it('says when a step was cancelled', () => {
    expect(historyEntryFor(result({ step: 'convert', changed: 4, cancelled: true }), lib, now).summary)
      .toBe('Wizard: converted 4 tracks (cancelled)');
  });

  it('says when a step failed, with the reason', () => {
    expect(historyEntryFor(result({ step: 'gather', changed: 0, error: 'Disk full' }), lib, now).summary)
      .toBe('Wizard: moving into your music folder failed: Disk full');
  });

  it('defaults the timestamp to now', () => {
    const entry = historyEntryFor(result({ step: 'relocate', changed: 1 }), lib);
    expect(entry.timestamp).toBeInstanceOf(Date);
  });
});
