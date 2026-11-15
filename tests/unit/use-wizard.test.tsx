import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { StepPlan, StepResult, WizardCheck } from '../../src/main/wizard/types';

const onLoadFromDb = vi.fn();
vi.mock('@renderer/AppWithRouter', () => ({
  useAppContext: () => ({ libraryPath: '/lib/master.db', onLoadFromDb }),
}));
const record = vi.fn(async () => {});
vi.mock('@renderer/db/duplicationHistoryDb', () => ({
  duplicationHistoryStorage: { record: (...a: unknown[]) => record(...(a as [])) },
}));

import { useWizard } from '@renderer/hooks/useWizard';
import { useWizardStore } from '@renderer/wizard/wizardStore';
import { useSettingsStore } from '@renderer/stores/settingsStore';

const check: WizardCheck = {
  libraryPath: '/lib/master.db', checkedAt: '2026-11-11T10:00:00.000Z',
  missing: 2, duplicates: 0, outsideFolder: 0, unplayable: 0, unpluggedDrives: [],
};
const plan: StepPlan = { step: 'relocate', apply: [], setAside: [] };

const api = {
  wizardCheck: vi.fn(),
  wizardPlanStep: vi.fn(),
  wizardApplyStep: vi.fn(),
  cancelWizard: vi.fn(async () => ({ success: true })),
  onWizardProgress: vi.fn(() => () => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window.electronAPI, api);
  useWizardStore.setState({ byLibrary: {} });
  useSettingsStore.setState({
    rekordboxDbKey: 'ab'.repeat(32), musicFolder: '/Music', oldestPlayer: 'cdj2000nxs' as never,
  });
});

describe('useWizard', () => {
  it('check sends the settings and saves the result for the library', async () => {
    api.wizardCheck.mockResolvedValue({ success: true, data: check });
    const { result } = renderHook(() => useWizard());
    await act(async () => { await result.current.check(); });
    expect(api.wizardCheck).toHaveBeenCalledWith(expect.objectContaining({
      dbPath: '/lib/master.db', key: 'ab'.repeat(32), musicFolder: '/Music',
    }));
    expect(useWizardStore.getState().byLibrary['/lib/master.db']).toEqual({ check, done: [] });
  });

  it('recheck updates the numbers but keeps the finished steps', async () => {
    useWizardStore.getState().setCheck('/lib/master.db', check);
    useWizardStore.getState().markDone('/lib/master.db', 'relocate');
    const after: WizardCheck = { ...check, missing: 0, outsideFolder: 5 };
    api.wizardCheck.mockResolvedValue({ success: true, data: after });
    const { result } = renderHook(() => useWizard());
    await act(async () => { await result.current.recheck(); });
    expect(useWizardStore.getState().byLibrary['/lib/master.db']).toEqual({ check: after, done: ['relocate'] });
  });

  it('a successful apply records history, marks the step done, then reloads', async () => {
    useWizardStore.getState().setCheck('/lib/master.db', check);
    const step: StepResult = { step: 'relocate', changed: 3, backupPath: '/bk', details: [], cancelled: false };
    api.wizardApplyStep.mockResolvedValue({ success: true, data: step });
    const { result } = renderHook(() => useWizard());
    await act(async () => { await result.current.apply(plan); });
    expect(api.wizardApplyStep).toHaveBeenCalledWith(expect.objectContaining({ plan }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ type: 'relocation', summary: 'Wizard: relocated 3 tracks' }));
    expect(useWizardStore.getState().byLibrary['/lib/master.db'].done).toEqual(['relocate']);
    expect(onLoadFromDb).toHaveBeenCalledWith('/lib/master.db');
  });

  it('a refused apply records nothing, is not done, and shows the reason', async () => {
    useWizardStore.getState().setCheck('/lib/master.db', check);
    api.wizardApplyStep.mockResolvedValue({
      success: true,
      data: { step: 'relocate', changed: 0, details: [], cancelled: false, error: 'Close rekordbox to continue' },
    });
    const { result } = renderHook(() => useWizard());
    await act(async () => { await result.current.apply(plan); });
    expect(record).not.toHaveBeenCalled();
    expect(onLoadFromDb).not.toHaveBeenCalled();
    expect(useWizardStore.getState().byLibrary['/lib/master.db'].done).toEqual([]);
    expect(result.current.error).toBe('Close rekordbox to continue');
  });

  it('a step that wrote nothing but left files behind is recorded, not reloaded and not done', async () => {
    useWizardStore.getState().setCheck('/lib/master.db', check);
    const stuck = {
      action: 'failed' as const, trackName: 'A', from: '/Music/A.mp3', to: '/Old/A.mp3',
      error: 'Could not be put back: something is now at /Old/A.mp3',
    };
    api.wizardApplyStep.mockResolvedValue({
      success: true,
      data: {
        step: 'gather', changed: 0, details: [stuck], cancelled: false,
        error: 'The library was not changed: disk I/O error. 1 file(s) could not be put back — see the list.',
      },
    });
    const { result } = renderHook(() => useWizard());
    await act(async () => { await result.current.apply({ step: 'gather', moves: [], setAside: [] } as never); });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ type: 'consolidate', details: [stuck] }));
    expect(onLoadFromDb).not.toHaveBeenCalled();
    expect(useWizardStore.getState().byLibrary['/lib/master.db'].done).toEqual([]);
    expect(result.current.error).toMatch(/could not be put back/);
  });

  it('a cancelled step that wrote is recorded and reloaded but not done', async () => {
    useWizardStore.getState().setCheck('/lib/master.db', check);
    api.wizardApplyStep.mockResolvedValue({
      success: true,
      data: { step: 'convert', changed: 2, backupPath: '/bk', details: [], cancelled: true },
    });
    const { result } = renderHook(() => useWizard());
    await act(async () => { await result.current.apply({ step: 'convert', items: [], setAside: [], ffmpeg: {} as never }); });
    expect(record).toHaveBeenCalledTimes(1);
    expect(onLoadFromDb).toHaveBeenCalledWith('/lib/master.db');
    expect(useWizardStore.getState().byLibrary['/lib/master.db'].done).toEqual([]);
  });

  it('a bridge failure lands in error and returns null', async () => {
    api.wizardPlanStep.mockResolvedValue({ success: false, error: 'The wizard is already busy' });
    const { result } = renderHook(() => useWizard());
    let planned: StepPlan | null = plan;
    await act(async () => { planned = await result.current.plan('relocate'); });
    expect(planned).toBeNull();
    expect(result.current.error).toBe('The wizard is already busy');
    expect(result.current.busy).toBe(false);
  });
});
