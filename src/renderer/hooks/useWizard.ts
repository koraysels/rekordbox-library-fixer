import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../AppWithRouter';
import { useSettingsStore } from '../stores/settingsStore';
import { duplicationHistoryStorage } from '../db/duplicationHistoryDb';
import { useWizardStore } from '../wizard/wizardStore';
import { historyEntryFor } from '../wizard/wizardHistory';
import type {
  StepPlan, StepResult, WizardCheck, WizardProgress, WizardRequest, WizardStepId,
} from '../../main/ipcContract';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

let lastId = 0;
const newOperationId = (kind: string) => `wizard-${kind}-${Date.now()}-${++lastId}`;

/**
 * The bridge calls the wizard screens make. Sequencing lives in the screens and
 * `../wizard/wizardFlow`; this hook only calls the main process, keeps the
 * saved check, and after a write records history and reloads the library.
 */
export function useWizard() {
  const { libraryPath, onLoadFromDb } = useAppContext();
  const key = useSettingsStore((s) => s.rekordboxDbKey);
  const musicFolder = useSettingsStore((s) => s.musicFolder);
  const profileId = useSettingsStore((s) => s.oldestPlayer);
  const searchPaths = useSettingsStore((s) => s.relocationOptions.searchPaths);
  const searchDepth = useSettingsStore((s) => s.relocationOptions.searchDepth);
  const setCheck = useWizardStore((s) => s.setCheck);
  const markDone = useWizardStore((s) => s.markDone);

  const [progress, setProgress] = useState<WizardProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationId = useRef<string | null>(null);

  // Progress from another call (a finished one, or another window) is not ours.
  useEffect(() => window.electronAPI.onWizardProgress((p) => {
    if (p.operationId === operationId.current) {setProgress(p);}
  }), []);

  const request = useCallback((kind: string): WizardRequest => ({
    operationId: newOperationId(kind),
    dbPath: libraryPath,
    key,
    musicFolder,
    profileId,
    searchPaths,
    searchDepth,
  }), [libraryPath, key, musicFolder, profileId, searchPaths, searchDepth]);

  /** Run one bridge call as the current operation; a failure lands in `error` and returns null. */
  const run = useCallback(async <T>(
    req: WizardRequest,
    call: () => Promise<{ success: boolean; data?: T; error?: string }>,
  ): Promise<T | null> => {
    operationId.current = req.operationId;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const res = await call();
      if (!res.success || res.data === undefined) {
        setError(res.error ?? 'Something went wrong');
        return null;
      }
      return res.data;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      if (operationId.current === req.operationId) {operationId.current = null;}
      setBusy(false);
    }
  }, []);

  /** Check the library as it is now; the result is saved and every step starts not done. */
  const check = useCallback(async (): Promise<WizardCheck | null> => {
    const req = request('check');
    const result = await run(req, () => window.electronAPI.wizardCheck(req));
    if (result) {setCheck(req.dbPath, result);}
    return result;
  }, [request, run, setCheck]);

  const plan = useCallback(async (step: WizardStepId): Promise<StepPlan | null> => {
    const req = request(`plan-${step}`);
    return run(req, () => window.electronAPI.wizardPlanStep({ ...req, step }));
  }, [request, run]);

  /**
   * Apply a confirmed plan. Anything that happened is recorded in History, even
   * when the step stopped part-way or wrote nothing — files moved by a gather
   * whose write failed and could not be put back are only on record there. A
   * refusal has no details and records nothing. The library is reloaded only
   * when it was written; the step counts as done only when it finished without
   * an error or a cancel.
   */
  const apply = useCallback(async (stepPlan: StepPlan): Promise<StepResult | null> => {
    const req = request(`apply-${stepPlan.step}`);
    const result = await run(req, () => window.electronAPI.wizardApplyStep({ ...req, plan: stepPlan }));
    if (!result) {return null;}

    const wrote = result.changed > 0 || !!result.backupPath;
    const happened = wrote || result.details.length > 0;
    if (happened) {await duplicationHistoryStorage.record(historyEntryFor(result, req.dbPath));}
    if (result.error) {setError(result.error);}
    if (!result.error && !result.cancelled) {markDone(req.dbPath, stepPlan.step);}
    if (wrote) {onLoadFromDb?.(req.dbPath);}
    return result;
  }, [request, run, markDone, onLoadFromDb]);

  const cancel = useCallback(async () => {
    const id = operationId.current;
    if (id) {await window.electronAPI.cancelWizard(id);}
  }, []);

  return { check, plan, apply, cancel, progress, busy, error };
}
