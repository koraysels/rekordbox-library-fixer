import type { DuplicateSet } from '../duplicateDetector';
import type { DbPlaylist, DbTrack } from '../rekordboxDbParser';
import { computeDeletablePaths } from '../safeDeletePaths';
import { referenceKey } from '../convert/applyConversions';
import { isFlac, isUniversalLossless } from '../audioQuality';
import { isStreamingLocation } from '../streamingLocation';
import { isInsideFolder } from './volumes';
import type { DuplicateMerge, DuplicatesStepPlan, SetAsideItem } from './types';

export const NOT_CERTAIN = 'Not certain these are the same recording';
export const FILE_MISSING = 'A file is missing';

/** Two files are only compared byte for byte when their lengths are this close (seconds). */
const DURATION_TOLERANCE_SEC = 1;

export interface DuplicatesPlanDeps {
  sameContent: (a: string, b: string) => Promise<boolean>;
  exists: (p: string) => boolean;
  durationOf?: (t: DbTrack) => number | undefined;
}

/** Per track id, how many playlist slots it fills — folders are walked, not counted. */
export function playlistSlots(playlists: DbPlaylist[]): Map<string, number> {
  const slots = new Map<string, number>();
  const walk = (nodes: DbPlaylist[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === 'PLAYLIST') {
        for (const id of node.tracks) {slots.set(id, (slots.get(id) ?? 0) + 1);}
      }
      walk(node.children);
    }
  };
  walk(playlists);
  return slots;
}

/** WAV/AIFF over FLAC over lossy: the order the CDJs care about. */
const losslessRank = (t: DbTrack) => (isUniversalLossless(t.location) ? 2 : isFlac(t.location) ? 1 : 0);

/** rekordbox ids are numbers stored as text; compare them as numbers when they are. */
function compareIds(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {return na - nb;}
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The entry a merge keeps: the one the DJ has put the most work into (cues, loops
 * and playlist slots), then the best-sounding file, then the one already in the
 * music folder, then the lowest id so the same library always gives the same answer.
 */
export function pickKeeper(tracks: DbTrack[], slots: Map<string, number>, musicFolder: string): DbTrack {
  const work = (t: DbTrack) => t.cues.length + t.loops.length + (slots.get(t.id) ?? 0);
  const inside = (t: DbTrack) => (isInsideFolder(t.location, musicFolder) ? 1 : 0);
  const better = (a: DbTrack, b: DbTrack): number =>
    work(b) - work(a)
    || losslessRank(b) - losslessRank(a)
    || (b.bitrate ?? 0) - (a.bitrate ?? 0)
    || (b.size ?? 0) - (a.size ?? 0)
    || inside(b) - inside(a)
    || compareIds(a.id, b.id);
  return [...tracks].sort(better)[0];
}

const setAsideOf = (tracks: DbTrack[], why: string): SetAsideItem => ({
  trackIds: tracks.map((t) => t.id),
  name: tracks[0].name,
  artist: tracks[0].artist,
  location: tracks[0].location,
  why,
});

/** One track per distinct file (by `referenceKey`), in set order. */
function distinctFiles(tracks: DbTrack[]): DbTrack[] {
  const seen = new Map<string, DbTrack>();
  for (const t of tracks) {
    const key = referenceKey(t.location);
    if (!seen.has(key)) {seen.set(key, t);}
  }
  return [...seen.values()];
}

/**
 * Whether the distinct files are certainly one recording. Size and duration are a
 * cheap filter first, so only likely duplicates are read; the content comparison
 * decides. A size or duration rekordbox does not know does not rule a pair out —
 * the byte comparison still has to pass.
 */
async function sameRecording(files: DbTrack[], deps: DuplicatesPlanDeps): Promise<boolean> {
  const durationOf = deps.durationOf ?? ((t: DbTrack) => t.duration);
  const [first, ...rest] = files;
  for (const other of rest) {
    if (first.size !== undefined && other.size !== undefined && first.size !== other.size) {return false;}
    const da = durationOf(first);
    const db = durationOf(other);
    if (da !== undefined && db !== undefined && Math.abs(da - db) > DURATION_TOLERANCE_SEC) {return false;}
  }
  for (const other of rest) {
    if (!(await deps.sameContent(first.location, other.location))) {return false;}
  }
  return true;
}

/**
 * The duplicates the wizard merges on one confirm, and the sets it leaves to the user.
 *
 * Sure means: every file in the set is there, and either the entries all point at
 * one file, or the files are byte-for-byte identical. Anything else is set aside.
 * Streaming entries and entries already gone from the library are left out of a
 * set, and no entry takes part in two merges.
 *
 * A file goes in `trashPaths` only when no entry left after every merge still uses
 * it, and only when the content comparison already proved it a regular file.
 */
export async function planDuplicates(
  sets: DuplicateSet[],
  tracks: Map<string, DbTrack>,
  playlists: DbPlaylist[],
  musicFolder: string,
  deps: DuplicatesPlanDeps,
): Promise<DuplicatesStepPlan> {
  const slots = playlistSlots(playlists);
  const claimed = new Set<string>();
  const provenFiles = new Set<string>();
  const sure: DbTrack[][] = [];
  const setAside: SetAsideItem[] = [];

  for (const set of sets) {
    const members: DbTrack[] = [];
    for (const ref of set.tracks) {
      const t = tracks.get(ref.id);
      if (!t || claimed.has(t.id) || isStreamingLocation(t.location)) {continue;}
      if (members.some((m) => m.id === t.id)) {continue;}
      members.push(t);
    }
    if (members.length < 2) {continue;}

    const files = distinctFiles(members);
    if (files.some((f) => !deps.exists(f.location))) {
      setAside.push(setAsideOf(members, FILE_MISSING));
      continue;
    }
    if (files.length > 1) {
      if (!(await sameRecording(files, deps))) {
        setAside.push(setAsideOf(members, NOT_CERTAIN));
        continue;
      }
      for (const f of files) {provenFiles.add(referenceKey(f.location));}
    }
    for (const t of members) {claimed.add(t.id);}
    sure.push(members);
  }

  const removed = new Set<string>();
  const merges = sure.map((members) => {
    const keeper = pickKeeper(members, slots, musicFolder);
    const removeIds = members.filter((t) => t.id !== keeper.id).map((t) => t.id);
    for (const id of removeIds) {removed.add(id);}
    return { keeper, members, removeIds };
  });

  const remaining: string[] = [];
  for (const t of tracks.values()) {
    if (!removed.has(t.id)) {remaining.push(t.location);}
  }
  // A file listed by one merge is not listed again by another: trashing it twice fails.
  const listed = new Set<string>();
  const isProvenFile = (p: string) => provenFiles.has(referenceKey(p)) && !listed.has(referenceKey(p));

  return {
    step: 'duplicates',
    merges: merges.map(({ keeper, members, removeIds }): DuplicateMerge => {
      const trashPaths = computeDeletablePaths(
        members.filter((t) => t.id !== keeper.id).map((t) => t.location),
        remaining,
        isProvenFile,
      );
      for (const p of trashPaths) {listed.add(referenceKey(p));}
      return { keepId: keeper.id, removeIds, keepName: keeper.name, artist: keeper.artist, trashPaths };
    }),
    setAside,
  };
}
