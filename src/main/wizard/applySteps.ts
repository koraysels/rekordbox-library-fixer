/**
 * Applying a wizard step: one backup, one library write, and only then any file
 * sent to the Trash. Every apply refuses up front while rekordbox runs, and a
 * write that fails comes back as the step's error, never as a throw.
 */
import * as path from 'path';
import { computeDeletablePaths } from '../safeDeletePaths';
import { referenceKey } from '../convert/applyConversions';
import { isStreamingLocation } from '../streamingLocation';
import { CLOSE_REKORDBOX } from './gatherApply';
import { convertDeps } from './convertDeps';
import { driveName, isVolumeMounted } from './volumes';
import { reportProgress, type WizardContext } from './context';
import type {
  ConvertStepPlan, DuplicatesStepPlan, RelocateStepPlan, RemoveStepPlan, StepDetail, StepPlan, StepResult,
} from './types';
import type { WizardDeps } from './wizardDeps';

export const NEEDS_KEY = 'The rekordbox database needs its key before it can be changed.';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const backupFor = (ctx: WizardContext, deps: WizardDeps) =>
  deps.backupPath?.(ctx.dbPath) ?? `${ctx.dbPath}.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;

const emptyResult = (plan: StepPlan): StepResult => ({ step: plan.step, changed: 0, details: [], cancelled: false });

const writing = (ctx: WizardContext, plan: StepPlan) =>
  reportProgress(ctx, plan.step, 0, 1, 'Writing the library…');

/** Apply one step's plan. One backup, one write; nothing happens while rekordbox runs. */
export async function applyStep(plan: StepPlan, ctx: WizardContext, deps: WizardDeps): Promise<StepResult> {
  const empty = emptyResult(plan);
  if (!ctx.key) {return { ...empty, error: NEEDS_KEY };}
  if (deps.isRunning()) {return { ...empty, error: CLOSE_REKORDBOX };}
  try {
    switch (plan.step) {
      case 'relocate': return applyRelocate(plan, ctx, deps);
      case 'remove': return applyRemove(plan, ctx, deps);
      case 'duplicates': return await applyDuplicates(plan, ctx, deps);
      case 'gather':
        return await deps.applyGather(plan, {
          dbPath: ctx.dbPath,
          key: ctx.key,
          backupPath: backupFor(ctx, deps),
          signal: ctx.signal,
          onProgress: (current, total, name) => reportProgress(ctx, 'gather', current, total, `Moving ${name}`),
          checkRunning: deps.isRunning,
          trash: deps.trash,
        });
      case 'convert': return await applyConvert(plan, ctx, deps);
    }
  } catch (e) {
    return { ...empty, error: errorText(e) };
  }
}

function applyRelocate(plan: RelocateStepPlan, ctx: WizardContext, deps: WizardDeps): StepResult {
  const result = emptyResult(plan);
  if (ctx.signal.aborted) {return { ...result, cancelled: true };}
  const relocations = plan.apply.flatMap((a) => a.trackIds.map((trackId) => ({ trackId, newLocation: a.to })));
  if (relocations.length === 0) {return result;}

  writing(ctx, plan);
  const outcome = deps.relocateTracksInDb(ctx.dbPath, ctx.key, relocations, {
    backupPath: backupFor(ctx, deps), checkRunning: deps.isRunning,
  });
  const skipped = new Map(outcome.skipped.map((s) => [s.trackId, s.reason]));
  for (const a of plan.apply) {
    const reasons = a.trackIds.map((id) => skipped.get(id)).filter((r): r is string => !!r);
    result.details.push(reasons.length === a.trackIds.length
      ? { action: 'failed', trackName: a.name, from: a.location, to: a.to, error: `Not relocated: ${reasons[0]}` }
      : { action: 'relocated', trackName: a.name, from: a.location, to: a.to });
  }
  return { ...result, changed: outcome.tracksRelocated, backupPath: outcome.backupPath };
}

/**
 * Remove the planned entries — except any whose drive has been unplugged since
 * the plan. Checked twice: against the plan's location before the write, and
 * inside the write against the database's own location, where a file on an
 * unplugged drive, or one the app is not allowed to look at, counts as there.
 */
function applyRemove(plan: RemoveStepPlan, ctx: WizardContext, deps: WizardDeps): StepResult {
  const result = emptyResult(plan);
  if (ctx.signal.aborted) {return { ...result, cancelled: true };}
  const mounted = (p: string) => isVolumeMounted(p, deps.platform, deps.exists, deps.isMountPoint);

  const removing = plan.remove.filter((r) => {
    if (isStreamingLocation(r.location)) {return false;}
    if (mounted(r.location)) {return true;}
    result.details.push({
      action: 'failed', trackName: r.name, from: r.location,
      error: `Kept: drive ${driveName(r.location, deps.platform)} is not plugged in`,
    });
    return false;
  });
  const ids = removing.flatMap((r) => r.trackIds);
  if (ids.length === 0) {return result;}

  writing(ctx, plan);
  const outcome = deps.removeEntriesFromDb(ctx.dbPath, ctx.key, ids, {
    backupPath: backupFor(ctx, deps),
    checkRunning: deps.isRunning,
    // Only a file known to be gone lets its entry go: one the app may not look at stays.
    fileExists: (p) => !deps.isGone(p) || !mounted(p),
  });
  const kept = new Map(outcome.kept.map((k) => [k.trackId, k.reason]));
  for (const r of removing) {
    const reasons = r.trackIds.map((id) => kept.get(id)).filter((x): x is string => !!x);
    result.details.push(reasons.length === r.trackIds.length
      ? { action: 'failed', trackName: r.name, from: r.location, error: `Kept: ${reasons[0]}` }
      : { action: 'removed', trackName: r.name, from: r.location });
  }
  return { ...result, changed: outcome.entriesRemoved, backupPath: outcome.backupPath };
}

/**
 * Merge, then trash the extra files — each only if, in the library as the merge
 * left it, no entry uses it by path or as the same file under another spelling.
 * A library that cannot be read back keeps every file.
 */
async function applyDuplicates(plan: DuplicatesStepPlan, ctx: WizardContext, deps: WizardDeps): Promise<StepResult> {
  const result = emptyResult(plan);
  if (ctx.signal.aborted) {return { ...result, cancelled: true };}
  const merges = plan.merges.filter((m) => m.removeIds.length > 0);
  if (merges.length === 0) {return result;}

  writing(ctx, plan);
  const outcome = deps.mergeDuplicateEntries(
    ctx.dbPath, ctx.key,
    merges.map(({ keepId, removeIds }) => ({ keepId, removeIds })),
    { backupPath: backupFor(ctx, deps), checkRunning: deps.isRunning },
  );
  result.changed = outcome.entriesRemoved;
  result.backupPath = outcome.backupPath;
  for (const m of merges) {result.details.push({ action: 'merged', trackName: m.keepName });}

  const candidates = merges.flatMap((m) => m.trashPaths);
  if (candidates.length > 0) {await trashUnused(candidates, ctx, deps, result.details);}
  return result;
}

async function trashUnused(
  candidates: string[], ctx: WizardContext, deps: WizardDeps, details: StepDetail[],
): Promise<void> {
  let remaining: string[];
  try {
    const library = await deps.parseDb(ctx.dbPath, ctx.key);
    remaining = [...library.tracks.values()].map((t) => t.location).filter(Boolean);
  } catch (e) {
    for (const p of candidates) {
      details.push({ action: 'failed', from: p, error: `Kept: could not confirm nothing else uses it (${errorText(e)})` });
    }
    return;
  }

  // A folder alias keeps the file name, so only same-named entries need their identity checked.
  const byName = new Map<string, string[]>();
  for (const loc of remaining) {
    const name = referenceKey(path.basename(loc));
    const list = byName.get(name);
    if (list) {list.push(loc);} else {byName.set(name, [loc]);}
  }
  const usedUnderAnotherName = (p: string): boolean => {
    const id = deps.fileId(p);
    return id !== undefined && (byName.get(referenceKey(path.basename(p))) ?? []).some((o) => deps.fileId(o) === id);
  };

  for (const p of computeDeletablePaths(candidates, remaining, deps.isRegularFile)) {
    if (usedUnderAnotherName(p)) {continue;}
    try {
      await deps.trash(p);
      details.push({ action: 'trashed', from: p });
    } catch (e) {
      details.push({ action: 'failed', from: p, error: `Could not move to the Trash: ${errorText(e)}` });
    }
  }
}

/** The converter's own run: AIFF, originals to the Trash once the library points at the new files. */
async function applyConvert(plan: ConvertStepPlan, ctx: WizardContext, deps: WizardDeps): Promise<StepResult> {
  const result = emptyResult(plan);
  const runDeps = convertDeps({
    ffmpeg: deps.ffmpegStatus(),
    operationId: ctx.operationId,
    signal: ctx.signal,
    emit: (p) => reportProgress(ctx, 'convert', p.current, p.total, p.message),
    trash: deps.trash,
  });
  if (plan.items.length === 0) {return result;}

  const run = await deps.runConversion({
    libraryPath: ctx.dbPath,
    dbKey: ctx.key,
    profileId: ctx.profileId,
    target: 'aiff',
    trashOriginals: true,
    items: plan.items,
  }, { ...runDeps, checkRunning: deps.isRunning });

  const nameOf = (p: string) => path.basename(p);
  for (const s of run.switchedItems) {
    result.details.push({ action: 'converted', trackName: nameOf(s.from), from: s.from, to: s.to });
  }
  for (const f of run.failed) {
    result.details.push({ action: 'failed', trackName: nameOf(f.from), from: f.from, error: f.error });
  }
  for (const c of run.conflicts) {
    result.details.push({ action: 'failed', trackName: nameOf(c), from: c, error: 'Another track is converted to the same file' });
  }
  for (const n of run.notTrashed ?? []) {
    result.details.push({ action: 'failed', trackName: nameOf(n.from), from: n.from, error: `Could not move to the Trash: ${n.error}` });
  }
  return {
    ...result,
    changed: run.switched,
    backupPath: run.backupPath,
    cancelled: run.cancelled,
    ...(run.error ? { error: run.error } : {}),
  };
}
