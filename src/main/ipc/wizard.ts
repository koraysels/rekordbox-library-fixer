import { app, ipcMain, shell } from 'electron';
import { runtime, safeConsole, sendToWindow } from '../runtime';
import { ffmpegStatus } from '../convert/ffmpegBinary';
import { applyStep, planStep, runCheck, type WizardContext } from '../wizard/wizardService';
import { realWizardDeps, type WizardDeps } from '../wizard/wizardDeps';
import type {
  IpcResult, StepPlan, StepResult, WizardApplyPayload, WizardCheck, WizardPlanPayload, WizardRequest,
} from '../ipcContract';

/**
 * One wizard call at a time: a check, a plan and an apply all read or write the
 * same database, and the relocation search keeps one shared file index.
 */
const runs = new Map<string, AbortController>();

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Unknown error occurred');

function liveDeps(): WizardDeps {
  return realWizardDeps({
    relocator: runtime().trackRelocator,
    detector: runtime().duplicateDetector,
    trash: (p) => shell.trashItem(p),
    ffmpegStatus: () => ffmpegStatus(app.getPath('userData'), process.platform, process.arch),
  });
}

async function withRun<T>(
  request: WizardRequest,
  work: (ctx: WizardContext, deps: WizardDeps) => Promise<T>,
): Promise<IpcResult<T>> {
  const { operationId } = request;
  if (runs.size > 0) {
    return { success: false, error: 'The wizard is already busy — wait for it to finish or cancel it first.' };
  }
  const controller = new AbortController();
  runs.set(operationId, controller);
  try {
    // Named field by field: a payload's `step` or `plan` is not part of the context.
    const ctx: WizardContext = {
      operationId,
      dbPath: request.dbPath,
      key: request.key,
      musicFolder: request.musicFolder,
      profileId: request.profileId,
      searchPaths: request.searchPaths ?? [],
      signal: controller.signal,
      onProgress: (p) => sendToWindow('wizard-progress', p),
    };
    return { success: true, data: await work(ctx, liveDeps()) };
  } catch (error) {
    safeConsole.error('❌ wizard call failed:', error);
    return { success: false, error: errorText(error) };
  } finally {
    if (runs.get(operationId) === controller) {runs.delete(operationId);}
  }
}

/**
 * The fix-my-library wizard: one check, then per step a plan and an apply.
 * The renderer only sequences these; the work is in `src/main/wizard/`.
 */
export function registerWizardIpc(): void {
  ipcMain.handle('wizard-check', async (_e, data: WizardRequest): Promise<IpcResult<WizardCheck>> =>
    withRun(data, runCheck));

  ipcMain.handle('wizard-plan-step', async (_e, data: WizardPlanPayload): Promise<IpcResult<StepPlan>> =>
    withRun(data, (ctx, deps) => planStep(data.step, ctx, deps)));

  ipcMain.handle('wizard-apply-step', async (_e, data: WizardApplyPayload): Promise<IpcResult<StepResult>> =>
    withRun(data, (ctx, deps) => applyStep(data.plan, ctx, deps)));

  ipcMain.handle('cancel-wizard', async (_e, operationId: string): Promise<IpcResult> => {
    const controller = runs.get(operationId);
    if (!controller) {return { success: false, error: 'Operation not found' };}
    controller.abort();
    return { success: true };
  });
}
