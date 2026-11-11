import * as fs from 'fs';
import * as path from 'path';
import { parseDb } from '../rekordboxDbParser';
import { realIsRegularFile, relocateTracksInDb, type RelocateOutcome } from '../rekordboxDbRelocator';
import { isRekordboxRunning } from '../rekordboxRunning';
import { computeDeletablePaths } from '../safeDeletePaths';
import { referenceKey } from '../convert/applyConversions';
import { fileIdentity, sameContent } from './sameContent';
import type { GatherMove, GatherStepPlan, StepDetail, StepResult } from './types';

export const CLOSE_REKORDBOX = 'Close rekordbox to continue';

/** The file operations gathering makes, injectable so a test can fail one. */
export interface GatherFs {
  rename: (from: string, to: string) => Promise<void>;
  /** Called with `COPYFILE_EXCL`: a copy never replaces a file. */
  copyFile: (from: string, to: string, mode: number) => Promise<void>;
  unlink: (p: string) => Promise<void>;
  mkdir: (dir: string) => Promise<void>;
  /** Anything at the path, a dangling symlink included — a rename would replace it. */
  exists: (p: string) => boolean;
  size: (p: string) => number;
  sameContent: (a: string, b: string) => Promise<boolean>;
  fileId: (p: string) => string | undefined;
  isRegularFile: (p: string) => boolean;
}

const realFs: GatherFs = {
  rename: (from, to) => fs.promises.rename(from, to),
  copyFile: (from, to, mode) => fs.promises.copyFile(from, to, mode),
  unlink: (p) => fs.promises.unlink(p),
  mkdir: async (dir) => { await fs.promises.mkdir(dir, { recursive: true }); },
  exists: (p) => { try { fs.lstatSync(p); return true; } catch { return false; } },
  size: (p) => fs.statSync(p).size,
  sameContent: (a, b) => sameContent(a, b),
  fileId: fileIdentity,
  isRegularFile: realIsRegularFile,
};

export interface GatherApplyContext {
  dbPath: string;
  key: string;
  backupPath: string;
  signal: AbortSignal;
  onProgress: (current: number, total: number, name: string) => void;
  checkRunning?: () => boolean;
  /** Move a file to the OS Trash. */
  trash: (p: string) => Promise<void>;
  fsOps?: Partial<GatherFs>;
  /** Every location in the library after the write. Defaults to re-reading the database. */
  locationsAfter?: () => Promise<Iterable<string>>;
}

type Placed = { move: GatherMove; kind: 'moved' | 'copied' | 'reused' };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const occupied = (to: string) => new Error(`Something is already at ${to}; it was left alone`);

/** Copy to `<to>.part`, check the size, then rename into place — never over a file. */
async function copyInto(move: GatherMove, io: GatherFs): Promise<void> {
  const part = `${move.to}.part`;
  try {
    await io.copyFile(move.from, part, fs.constants.COPYFILE_EXCL);
  } catch (e) {
    // EEXIST: a `.part` that is not ours. Anything else may have left a partial copy of ours.
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {await io.unlink(part).catch(() => undefined);}
    throw e;
  }
  try {
    const want = io.size(move.from);
    const got = io.size(part);
    if (got !== want) {throw new Error(`The copy is ${got} bytes but the original is ${want}`);}
    if (io.exists(move.to)) {throw occupied(move.to);}
    await io.rename(part, move.to);
  } catch (e) {
    await io.unlink(part).catch(() => undefined);
    throw e;
  }
}

/** Put one file in place. Throws, with nothing left behind, when it cannot. */
async function place(move: GatherMove, io: GatherFs): Promise<Placed['kind']> {
  // A folder (an entry whose location is a folder or a truncated path) is never
  // renamed or copied: that would carry a whole folder of music with it.
  if (!io.isRegularFile(move.from)) {throw new Error(`${move.from} is not a file; it was left alone`);}
  if (move.reuseExisting) {
    if (!(await io.sameContent(move.from, move.to))) {
      throw new Error(`The file at ${move.to} is no longer the same as this one`);
    }
    return 'reused';
  }
  await io.mkdir(path.dirname(move.to));
  if (io.exists(move.to)) {throw occupied(move.to);}
  if (!move.crossDrive) {
    try {
      await io.rename(move.from, move.to);
      return 'moved';
    } catch (e) {
      // Two mounts the path alone could not tell apart: copy instead.
      if ((e as NodeJS.ErrnoException).code !== 'EXDEV') {throw e;}
    }
  }
  await copyInto(move, io);
  return 'copied';
}

/** Undo file work, newest first. A reused file was there before and is never touched. */
async function putBack(placed: Placed[], io: GatherFs): Promise<StepDetail[]> {
  const failures: StepDetail[] = [];
  for (const { move, kind } of [...placed].reverse()) {
    try {
      if (kind === 'moved') {
        if (io.exists(move.from)) {throw new Error(`something is now at ${move.from}`);}
        await io.rename(move.to, move.from);
      } else if (kind === 'copied') {
        // The copy is only expendable while the original is still there.
        if (!io.exists(move.from)) {throw new Error(`the original at ${move.from} is gone, so the copy was kept`);}
        await io.unlink(move.to);
      }
    } catch (e) {
      failures.push({ action: 'failed', trackName: move.name, from: move.to, to: move.from, error: `Could not be put back: ${errorText(e)}` });
    }
  }
  return failures;
}

/**
 * Gather files into the music folder and point their entries at the new place.
 *
 * Refuses before touching a file when the plan carries a refusal or rekordbox is
 * running. Then, one move at a time (cancel stops between moves): a reused file
 * needs nothing; same drive is a rename that never replaces a file; another drive
 * is copy, verify, rename into place. One database write switches every entry that
 * was placed. If that write fails, every rename is undone and every copy deleted,
 * so the library and the disk are as they were. Only after the write, an original
 * that was copied or reused goes to the Trash — and only when no entry in the
 * library as it now stands still uses it.
 */
export async function applyGather(plan: GatherStepPlan, ctx: GatherApplyContext): Promise<StepResult> {
  const io: GatherFs = { ...realFs, ...ctx.fsOps };
  const result: StepResult = { step: 'gather', changed: 0, details: [], cancelled: false };
  if (plan.refusal) {return { ...result, error: plan.refusal };}
  const running = ctx.checkRunning ?? isRekordboxRunning;
  if (running()) {return { ...result, error: CLOSE_REKORDBOX };}

  const placed: Placed[] = [];
  const total = plan.moves.length;
  for (let i = 0; i < total; i++) {
    if (ctx.signal.aborted) {
      result.cancelled = true;
      break;
    }
    const move = plan.moves[i];
    ctx.onProgress(i + 1, total, move.name);
    try {
      placed.push({ move, kind: await place(move, io) });
    } catch (e) {
      result.details.push({ action: 'failed', trackName: move.name, from: move.from, to: move.to, error: errorText(e) });
    }
  }
  if (placed.length === 0) {return result;}

  let outcome: RelocateOutcome;
  try {
    outcome = relocateTracksInDb(
      ctx.dbPath,
      ctx.key,
      placed.flatMap(({ move }) => move.trackIds.map((trackId) => ({ trackId, newLocation: move.to }))),
      { backupPath: ctx.backupPath, checkRunning: running },
    );
  } catch (e) {
    const stuck = await putBack(placed, io);
    result.details.push(...stuck);
    result.error = `The library was not changed: ${errorText(e)}. `
      + (stuck.length ? `${stuck.length} file(s) could not be put back — see the list.` : 'Every file was put back where it was.');
    return result;
  }
  result.backupPath = outcome.backupPath;

  // An entry gone from the library since the plan was not switched. A file none
  // of whose entries were switched goes back where it was.
  const skipped = new Set(outcome.skipped.map((s) => s.trackId));
  const switched = placed.filter(({ move }) => move.trackIds.some((id) => !skipped.has(id)));
  const orphaned = placed.filter(({ move }) => move.trackIds.every((id) => skipped.has(id)));
  const stuck = await putBack(orphaned, io);
  for (const { move } of orphaned) {
    if (!stuck.some((d) => d.from === move.to)) {
      result.details.push({ action: 'failed', trackName: move.name, from: move.from, to: move.to, error: 'Its entry is no longer in the library; the file was left where it was' });
    }
  }
  result.details.push(...stuck);

  result.changed = switched.length;
  for (const { move, kind } of switched) {
    result.details.push({ action: kind === 'reused' ? 'relocated' : kind, trackName: move.name, from: move.from, to: move.to });
  }

  // Only a fully switched move's original is a candidate, like the converter.
  const leftBehind = switched.filter(({ move, kind }) => kind !== 'moved' && !move.trackIds.some((id) => skipped.has(id)));
  if (leftBehind.length) {await trashOriginals(leftBehind, ctx, io, result);}
  return result;
}

async function libraryLocations(dbPath: string, key: string): Promise<string[]> {
  const library = await parseDb(dbPath, key);
  return [...library.tracks.values()].map((t) => t.location);
}

async function trashOriginals(
  leftBehind: Placed[],
  ctx: GatherApplyContext,
  io: GatherFs,
  result: StepResult,
): Promise<void> {
  let remaining: Iterable<string>;
  try {
    remaining = await (ctx.locationsAfter ?? (() => libraryLocations(ctx.dbPath, ctx.key)))();
  } catch (e) {
    for (const { move } of leftBehind) {
      const error = `Kept: could not confirm nothing else uses it (${errorText(e)})`;
      result.details.push({ action: 'failed', trackName: move.name, from: move.from, error });
    }
    return;
  }

  const byFrom = new Map(leftBehind.map(({ move }) => [referenceKey(move.from), move]));
  for (const p of computeDeletablePaths(leftBehind.map(({ move }) => move.from), remaining, io.isRegularFile)) {
    const move = byFrom.get(referenceKey(p));
    if (!move) {continue;}
    // The original and the file the entry now uses are one file under two spellings.
    const id = io.fileId(p);
    if (id !== undefined && id === io.fileId(move.to)) {continue;}
    try {
      await ctx.trash(p);
      result.details.push({ action: 'trashed', trackName: move.name, from: p });
    } catch (e) {
      result.details.push({ action: 'failed', trackName: move.name, from: p, error: `Could not move to the Trash: ${errorText(e)}` });
    }
  }
}
