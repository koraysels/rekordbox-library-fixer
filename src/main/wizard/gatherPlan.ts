import * as path from 'path';
import type { DbTrack } from '../rekordboxDbParser';
import { referenceKey } from '../convert/applyConversions';
import { isStreamingLocation } from '../streamingLocation';
import { driveName, isInsideFolder, isVolumeMounted, volumeRoot } from './volumes';
import type { GatherMove, GatherStepPlan } from './types';

/** Room left free on the music folder's drive after a cross-drive gather. */
export const HEADROOM_BYTES = 1024 ** 3;

/** Past this many ` (n)` names the folder is not one a person keeps; give up rather than spin. */
const MAX_SUFFIX = 10_000;

/**
 * Where a file lands in the music folder: under the name of the folder it came
 * from, so `~/Downloads/Promos/a.mp3` becomes `<music>/Promos/a.mp3`.
 */
export function gatherDestination(source: string, musicFolder: string): string {
  return path.join(musicFolder, path.basename(path.dirname(source)), path.basename(source));
}

export interface ClashDeps {
  exists: (p: string) => boolean;
  sameContent: (a: string, b: string) => Promise<boolean>;
}

/**
 * The name a file is gathered to, never one already in use.
 *
 * `taken` holds the `referenceKey` of every destination already planned this run,
 * so two sources with the same folder and file name get two names. A name with a
 * file on it is only used when that file is byte-for-byte the source — then the
 * file is reused, not copied. Otherwise the next of `name (2).ext`, `name (3).ext`…
 */
export async function resolveClash(
  dest: string,
  source: string,
  taken: Set<string>,
  deps: ClashDeps,
): Promise<{ to: string; reuseExisting: boolean }> {
  const ext = path.extname(dest);
  const stem = dest.slice(0, dest.length - ext.length);
  for (let n = 1; n <= MAX_SUFFIX; n++) {
    const candidate = n === 1 ? dest : `${stem} (${n})${ext}`;
    if (taken.has(referenceKey(candidate))) {continue;}
    if (!deps.exists(candidate)) {return { to: candidate, reuseExisting: false };}
    if (await deps.sameContent(source, candidate)) {return { to: candidate, reuseExisting: true };}
  }
  throw new Error(`No free name for ${path.basename(dest)} in ${path.dirname(dest)}`);
}

export interface GatherPlanDeps extends ClashDeps {
  platform: NodeJS.Platform;
  /**
   * A plain file, not a folder. rekordbox libraries hold entries whose location is
   * a folder or a truncated path; gathering one would move a whole folder of music.
   */
  isRegularFile: (p: string) => boolean;
  fileSize: (p: string) => number;
  freeBytes: (dir: string) => number;
  /**
   * Which physical file a path names (`fileIdentity` in `sameContent.ts`). Optional,
   * but the wizard passes it: two spellings of one file (`/Volumes/Macintosh HD/...`
   * and `/...`) are otherwise two moves, and the second finds its file gone.
   */
  fileId?: (p: string) => string | undefined;
}

const baseKey = (p: string) => referenceKey(path.basename(p));

function formatBytes(bytes: number): string {
  if (bytes >= HEADROOM_BYTES) {return `${(bytes / HEADROOM_BYTES).toFixed(1)} GB`;}
  return `${Math.ceil(bytes / 1024 ** 2)} MB`;
}

function driveLabel(p: string, platform: NodeJS.Platform): string {
  const name = driveName(p, platform);
  return name === '/' ? 'this computer\'s drive' : name;
}

/**
 * Which tracks the gather step moves into the music folder, and where to.
 *
 * Left out: streaming tracks, tracks already inside the folder, and files that are
 * not there on a plugged-in drive (relocation's business) — a location that names
 * a folder counts as not there. A track on an unplugged
 * drive is never moved; it is counted under its drive so the user can plug it in.
 * Entries sharing one file move together as one move. A move crosses drives when
 * the file's volume is not the music folder's; those are copied, so they need
 * room — the plan refuses up front when the music folder's drive lacks it plus
 * `HEADROOM_BYTES`, rather than failing halfway.
 */
export async function planGather(
  tracks: Map<string, DbTrack>,
  musicFolder: string,
  deps: GatherPlanDeps,
): Promise<GatherStepPlan> {
  const plan: GatherStepPlan = { step: 'gather', moves: [], unplugged: [], bytesCrossDrive: 0, freeBytes: 0 };
  if (!musicFolder) {return plan;}

  const keys = new Map<string, string>();
  const fileKey = (p: string): string => {
    let key = keys.get(p);
    if (key === undefined) {
      const id = deps.fileId?.(p);
      key = id !== undefined ? `id:${id}` : `path:${referenceKey(p)}`;
      keys.set(p, key);
    }
    return key;
  };

  const unplugged = new Map<string, number>();
  const groups = new Map<string, DbTrack[]>();
  const insideByName = new Map<string, string[]>();
  for (const t of tracks.values()) {
    const loc = t.location;
    if (!loc || isStreamingLocation(loc)) {continue;}
    if (isInsideFolder(loc, musicFolder)) {
      const list = insideByName.get(baseKey(loc));
      if (list) {list.push(loc);} else {insideByName.set(baseKey(loc), [loc]);}
      continue;
    }
    if (!isVolumeMounted(loc, deps.platform, deps.exists)) {
      const drive = volumeRoot(loc, deps.platform);
      unplugged.set(drive, (unplugged.get(drive) ?? 0) + 1);
      continue;
    }
    // A folder, or anything else that is not a plain file, is left out like a missing one.
    if (!deps.exists(loc) || !deps.isRegularFile(loc)) {continue;}
    const key = fileKey(loc);
    const group = groups.get(key);
    if (group) {group.push(t);} else {groups.set(key, [t]);}
  }
  plan.unplugged = [...unplugged].map(([drive, count]) => ({ drive, count }));

  if (!isVolumeMounted(musicFolder, deps.platform, deps.exists)) {
    plan.refusal = `Plug in ${driveLabel(musicFolder, deps.platform)} — your music folder is on it`;
    return plan;
  }

  const musicRoot = volumeRoot(musicFolder, deps.platform);
  const taken = new Set<string>();
  for (const [key, group] of groups) {
    const from = group[0].location;
    // Already in the folder under another spelling (a folder alias keeps the file
    // name, so only same-named entries are checked): moving it would break that entry.
    if (deps.fileId && (insideByName.get(baseKey(from)) ?? []).some((p) => fileKey(p) === key)) {continue;}

    const { to, reuseExisting } = await resolveClash(gatherDestination(from, musicFolder), from, taken, deps);
    // The "existing identical file" is the source itself, reached another way.
    if (reuseExisting && deps.fileId && fileKey(to) === key) {continue;}
    taken.add(referenceKey(to));

    const move: GatherMove = {
      trackIds: group.map((t) => t.id),
      name: group[0].name,
      from,
      to,
      crossDrive: volumeRoot(from, deps.platform) !== musicRoot,
      reuseExisting,
      bytes: deps.fileSize(from),
    };
    plan.moves.push(move);
    if (move.crossDrive && !reuseExisting) {plan.bytesCrossDrive += move.bytes;}
  }

  const drive = driveLabel(musicFolder, deps.platform);
  let free: number | undefined;
  try { free = deps.freeBytes(musicFolder); } catch { free = undefined; }
  plan.freeBytes = free ?? 0;
  // Same-drive renames take no room, so headroom is only asked of a gather that copies.
  if (plan.bytesCrossDrive > 0) {
    const needs = plan.bytesCrossDrive + HEADROOM_BYTES;
    if (free === undefined) {
      plan.refusal = `Could not tell how much room is left on ${drive}`;
    } else if (needs > free) {
      plan.refusal = `Not enough space on ${drive}: needs ${formatBytes(needs)}, has ${formatBytes(free)}`;
    }
  }
  return plan;
}
