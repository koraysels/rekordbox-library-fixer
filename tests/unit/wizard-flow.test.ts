import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isEmptyPlan, stepsFor, stepsForRun } from '@renderer/wizard/wizardFlow';
import type { StepPlan, WizardCheck } from '../../src/main/wizard/types';

const check = (over: Partial<WizardCheck> = {}): WizardCheck => ({
  libraryPath: '/lib/master.db',
  checkedAt: '2026-11-11T10:00:00.000Z',
  missing: 0,
  duplicates: 0,
  outsideFolder: 0,
  unplayable: 0,
  unpluggedDrives: [],
  ...over,
});

const ref = { trackIds: ['1'], name: 'Track', artist: 'Artist', location: '/a/track.mp3' };
const aside = { ...ref, why: 'Not sure' };
const ffmpeg = { installed: true } as never;

describe('stepsForRun', () => {
  it('keeps the steps already behind, and adds one a previous step made necessary', () => {
    // Relocate pointed tracks outside the music folder: gather joins the run.
    expect(stepsForRun(check({ missing: 1, outsideFolder: 4 }), ['relocate'])).toEqual(['relocate', 'remove', 'gather']);
  });

  it('drops a step the latest check no longer calls for, unless it is behind', () => {
    expect(stepsForRun(check({ duplicates: 0 }), ['relocate', 'remove'])).toEqual(['relocate', 'remove']);
    expect(stepsForRun(check(), [])).toEqual([]);
  });
});

describe('stepsFor', () => {
  it('a clean library has no steps', () => {
    expect(stepsFor(check())).toEqual([]);
  });

  it('missing tracks bring both relocate and remove', () => {
    expect(stepsFor(check({ missing: 3 }))).toEqual(['relocate', 'remove']);
  });

  it('every count brings its step, in the fixed order', () => {
    expect(stepsFor(check({ unplayable: 1, outsideFolder: 2, duplicates: 4, missing: 5 })))
      .toEqual(['relocate', 'remove', 'duplicates', 'gather', 'convert']);
  });

  it('skips the steps with nothing to do', () => {
    expect(stepsFor(check({ duplicates: 2, unplayable: 7 }))).toEqual(['duplicates', 'convert']);
    expect(stepsFor(check({ outsideFolder: 1 }))).toEqual(['gather']);
  });
});

describe('isEmptyPlan', () => {
  it('relocate: empty without matches to apply, even with tracks set aside', () => {
    expect(isEmptyPlan({ step: 'relocate', apply: [], setAside: [aside] })).toBe(true);
    expect(isEmptyPlan({ step: 'relocate', apply: [{ ...ref, to: '/b/track.mp3', confidence: 0.95 }], setAside: [] })).toBe(false);
  });

  it('remove: empty without entries to remove', () => {
    expect(isEmptyPlan({ step: 'remove', remove: [], setAside: [aside] })).toBe(true);
    expect(isEmptyPlan({ step: 'remove', remove: [ref], setAside: [] })).toBe(false);
  });

  it('duplicates: empty without a merge that removes something', () => {
    const merge = { keepId: '1', removeIds: ['2'], keepName: 'Track', artist: 'Artist', trashPaths: [] };
    expect(isEmptyPlan({ step: 'duplicates', merges: [], setAside: [aside] })).toBe(true);
    expect(isEmptyPlan({ step: 'duplicates', merges: [{ ...merge, removeIds: [] }], setAside: [] })).toBe(true);
    expect(isEmptyPlan({ step: 'duplicates', merges: [merge], setAside: [] })).toBe(false);
  });

  it('gather: empty without moves, whatever is unplugged', () => {
    const base: StepPlan = { step: 'gather', moves: [], unplugged: [{ drive: 'USB', count: 4 }], bytesCrossDrive: 0, freeBytes: 0 };
    expect(isEmptyPlan(base)).toBe(true);
    expect(isEmptyPlan({
      ...base,
      moves: [{ trackIds: ['1'], name: 'Track', from: '/a/x.mp3', to: '/m/a/x.mp3', crossDrive: false, reuseExisting: false, bytes: 10 }],
    })).toBe(false);
  });

  it('convert: empty without items to convert', () => {
    expect(isEmptyPlan({ step: 'convert', items: [], setAside: [aside], ffmpeg })).toBe(true);
    expect(isEmptyPlan({
      step: 'convert',
      items: [{ from: '/a/x.flac', to: '/a/x.aiff', readiness: 'ready' } as never],
      setAside: [],
      ffmpeg,
    })).toBe(false);
  });
});

describe('useWizardStore', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  const freshStore = async () => (await import('@renderer/wizard/wizardStore')).useWizardStore;

  it('keeps one saved check per library and persists it', async () => {
    const store = await freshStore();
    store.getState().setCheck('/lib/master.db', check({ missing: 2 }));
    expect(store.getState().byLibrary['/lib/master.db']).toEqual({ check: check({ missing: 2 }), done: [] });
    const stored = JSON.parse(localStorage.getItem('rekordbox-wizard') ?? '{}');
    expect(stored.state.byLibrary['/lib/master.db'].check.missing).toBe(2);
  });

  it('markDone records a step once', async () => {
    const store = await freshStore();
    store.getState().setCheck('/lib/master.db', check({ missing: 2 }));
    store.getState().markDone('/lib/master.db', 'relocate');
    store.getState().markDone('/lib/master.db', 'relocate');
    expect(store.getState().byLibrary['/lib/master.db'].done).toEqual(['relocate']);
  });

  it('a new check starts with no steps done', async () => {
    const store = await freshStore();
    store.getState().setCheck('/lib/master.db', check({ missing: 2 }));
    store.getState().markDone('/lib/master.db', 'relocate');
    store.getState().setCheck('/lib/master.db', check({ duplicates: 1 }));
    expect(store.getState().byLibrary['/lib/master.db']).toEqual({ check: check({ duplicates: 1 }), done: [] });
  });

  it('markDone without a saved check does nothing', async () => {
    const store = await freshStore();
    store.getState().markDone('/other.db', 'gather');
    expect(store.getState().byLibrary['/other.db']).toBeUndefined();
  });

  it('reset forgets one library only', async () => {
    const store = await freshStore();
    store.getState().setCheck('/a.db', check());
    store.getState().setCheck('/b.db', check());
    store.getState().reset('/a.db');
    expect(Object.keys(store.getState().byLibrary)).toEqual(['/b.db']);
  });
});
