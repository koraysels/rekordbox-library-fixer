/**
 * The wizard's main-process service: one check, then per step a plan and an
 * apply. Free of Electron — `src/main/ipc/wizard.ts` wires it to the window.
 *
 * Every check and every plan reads the database again, so each step works from
 * the library as the previous step left it, and as rekordbox may have changed
 * it in between.
 */
import type { Track } from '../rekordboxParser';
import type { DbLibrary, DbTrack } from '../rekordboxDbParser';
import type { MissingTrack, RelocationCandidate, RelocationOptions } from '../trackRelocator';
import type { ConvertCandidate, TrackPayload } from '../ipcContract';
import { referenceKey } from '../convert/applyConversions';
import { isStreamingLocation } from '../streamingLocation';
import { isInsideFolder, isVolumeMounted, volumeRoot } from './volumes';
import { planRelocations } from './relocatePlan';
import { planRemovals } from './removePlan';
import { planDuplicates } from './duplicatesPlan';
import { planGather } from './gatherPlan';
import type {
  ConvertStepPlan, SetAsideItem, StepPlan, WizardCheck, WizardStepId,
} from './types';
import type { WizardDeps } from './wizardDeps';
import { CANCELLED, reportProgress as progress, throwIfCancelled, type WizardContext } from './context';

export { applyStep } from './applySteps';
export { CANCELLED, throwIfCancelled } from './context';
export type { WizardContext, WizardProgress } from './context';

export const NEEDS_MUSIC_FOLDER = 'Choose your music folder first — the wizard looks there for moved tracks.';

/**
 * Which file names count as a candidate at all: the Relocate page's default.
 * The wizard's own 90 % bar is applied on top of it, in `planRelocations`.
 */
const SEARCH_MATCH_THRESHOLD = 0.7;
const SEARCH_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.flac', '.aiff', '.aif'];

const DUPLICATE_OPTIONS = {
  useFingerprint: false,
  useMetadata: true,
  metadataFields: ['artist', 'title', 'duration'],
};

const mountedIn = (deps: WizardDeps) => (p: string) => isVolumeMounted(p, deps.platform, deps.exists, deps.isMountPoint);

/** A track with a file location on a drive that is plugged in: the only kind a step may touch. */
function onMountedDrive(t: DbTrack, deps: WizardDeps): boolean {
  return !!t.location && !isStreamingLocation(t.location) && mountedIn(deps)(t.location);
}

function withoutStreaming(library: DbLibrary): DbTrack[] {
  return [...library.tracks.values()].filter((t) => t.location && !isStreamingLocation(t.location));
}

/**
 * Missing files on plugged-in drives. A file on an unplugged drive is not lost,
 * and neither is one the app is not allowed to look at: neither is missing.
 */
async function findMissing(library: DbLibrary, deps: WizardDeps): Promise<MissingTrack[]> {
  const mounted = mountedIn(deps);
  const missing = await deps.relocator.findMissingTracks(library.tracks);
  return missing.filter((t) => !t.unreadable && !isStreamingLocation(t.originalLocation) && mounted(t.originalLocation));
}

async function findDuplicateSets(library: DbLibrary, ctx: WizardContext, deps: WizardDeps) {
  const cancelToken = { get cancelled() { return ctx.signal.aborted; } };
  const scan = await deps.detector.findDuplicates(
    withoutStreaming(library) as unknown as Track[], DUPLICATE_OPTIONS, { cancelToken },
  );
  if (scan.cancelled) {throw new Error(CANCELLED);}
  return scan.duplicates;
}

async function findUnplayableOnMountedDrives(
  library: DbLibrary, ctx: WizardContext, deps: WizardDeps,
): Promise<ConvertCandidate[]> {
  const tracks = new Map([...library.tracks].filter(([, t]) => onMountedDrive(t, deps)));
  return deps.findUnplayable({ tracks: tracks as unknown as Map<string, TrackPayload> }, ctx.profileId);
}

/** The summary: what each step would find. No relocation search — that is the relocate step's. */
export async function runCheck(ctx: WizardContext, deps: WizardDeps): Promise<WizardCheck> {
  const total = 4;
  progress(ctx, 'check', 0, total, 'Reading your library…');
  const library = await deps.parseDb(ctx.dbPath, ctx.key);
  throwIfCancelled(ctx.signal);

  progress(ctx, 'check', 1, total, 'Looking for missing files…');
  const mounted = mountedIn(deps);
  const unplugged = new Set<string>();
  let outsideFolder = 0;
  for (const t of withoutStreaming(library)) {
    if (!mounted(t.location)) {
      unplugged.add(volumeRoot(t.location, deps.platform));
      continue;
    }
    if (ctx.musicFolder && !isInsideFolder(t.location, ctx.musicFolder)
      && deps.exists(t.location) && deps.isRegularFile(t.location)) {
      outsideFolder++;
    }
  }
  const missing = await findMissing(library, deps);
  throwIfCancelled(ctx.signal);

  progress(ctx, 'check', 2, total, 'Looking for duplicates…');
  const duplicates = await findDuplicateSets(library, ctx, deps);

  progress(ctx, 'check', 3, total, 'Checking what your player can play…');
  const unplayable = (await findUnplayableOnMountedDrives(library, ctx, deps)).filter((c) => !c.unreachable);
  throwIfCancelled(ctx.signal);

  progress(ctx, 'check', total, total, 'Done');
  return {
    libraryPath: ctx.dbPath,
    checkedAt: new Date().toISOString(),
    missing: missing.length,
    duplicates: duplicates.length,
    outsideFolder,
    unplayable: unplayable.length,
    unpluggedDrives: [...unplugged],
  };
}

/** The music folder first, then the Relocate page's folders, each once. */
export function wizardSearchPaths(musicFolder: string, searchPaths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [musicFolder, ...searchPaths]) {
    if (!p || seen.has(referenceKey(p))) {continue;}
    seen.add(referenceKey(p));
    out.push(p);
  }
  return out;
}

/**
 * Relocation candidates for every missing track. A cancelled search throws
 * rather than return a partial map: to the remove step, a track not searched
 * would look like a track with no candidate, and be removed.
 */
async function searchCandidates(
  missing: MissingTrack[],
  step: WizardStepId,
  ctx: WizardContext,
  deps: WizardDeps,
): Promise<Map<string, RelocationCandidate[]>> {
  const candidates = new Map<string, RelocationCandidate[]>();
  if (missing.length === 0) {return candidates;}
  if (!ctx.musicFolder || !deps.exists(ctx.musicFolder)) {throw new Error(NEEDS_MUSIC_FOLDER);}

  const options: RelocationOptions = {
    searchPaths: wizardSearchPaths(ctx.musicFolder, ctx.searchPaths),
    searchDepth: ctx.searchDepth,
    matchThreshold: SEARCH_MATCH_THRESHOLD,
    includeSubdirectories: true,
    fileExtensions: SEARCH_EXTENSIONS,
  };
  progress(ctx, step, 0, missing.length, 'Indexing your music folders…');
  try {
    await deps.relocator.beginRelocationRun(options);
    for (let i = 0; i < missing.length; i++) {
      throwIfCancelled(ctx.signal);
      const track = missing[i];
      progress(ctx, step, i + 1, missing.length, `Searching for ${track.name}`);
      candidates.set(track.id, await deps.relocator.findRelocationCandidates(track, options));
    }
    throwIfCancelled(ctx.signal);
  } finally {
    deps.relocator.endRelocationRun();
  }
  return candidates;
}

const setAsideOf = (c: ConvertCandidate, why: string): SetAsideItem => ({
  trackIds: c.trackIds, name: c.name, artist: c.artist, location: c.location, why,
});

async function planConvert(library: DbLibrary, ctx: WizardContext, deps: WizardDeps): Promise<ConvertStepPlan> {
  progress(ctx, 'convert', 0, 1, 'Checking what your player can play…');
  const candidates = await findUnplayableOnMountedDrives(library, ctx, deps);
  throwIfCancelled(ctx.signal);
  const convertible = candidates.filter((c) => !c.unreachable && !c.unreadable);
  const preview = await deps.previewConversion(convertible, ctx.profileId, 'aiff');
  throwIfCancelled(ctx.signal);

  const byFrom = new Map(preview.map((item) => [referenceKey(item.from), item]));
  const plan: ConvertStepPlan = { step: 'convert', items: [], setAside: [], ffmpeg: deps.ffmpegStatus() };
  for (const c of candidates) {
    if (c.unreachable) {plan.setAside.push(setAsideOf(c, "The file can't be found"));continue;}
    if (c.unreadable) {plan.setAside.push(setAsideOf(c, "The file couldn't be read"));continue;}
    const item = byFrom.get(referenceKey(c.location));
    if (!item) {plan.setAside.push(setAsideOf(c, "The file couldn't be read"));continue;}
    if (item.readiness === 'conflict') {
      plan.setAside.push(setAsideOf(c, 'Another track would be converted to the same file'));
      continue;
    }
    plan.items.push(item);
  }
  progress(ctx, 'convert', 1, 1, 'Done');
  return plan;
}

/** What one step would do, from the library as it is now. */
export async function planStep(step: WizardStepId, ctx: WizardContext, deps: WizardDeps): Promise<StepPlan> {
  const library = await deps.parseDb(ctx.dbPath, ctx.key);
  throwIfCancelled(ctx.signal);

  switch (step) {
    case 'relocate': {
      const missing = await findMissing(library, deps);
      return planRelocations(missing, await searchCandidates(missing, step, ctx, deps));
    }
    case 'remove': {
      // Every missing track, plugged in or not: one on an unplugged drive, or one
      // the app may not look at, is listed to check, never removed.
      const all = (await deps.relocator.findMissingTracks(library.tracks))
        .filter((t) => !isStreamingLocation(t.originalLocation));
      const mounted = mountedIn(deps);
      const searchable = all.filter((t) => !t.unreadable && mounted(t.originalLocation));
      const candidates = await searchCandidates(searchable, step, ctx, deps);
      return planRemovals(all, candidates, mounted, deps.platform);
    }
    case 'duplicates': {
      progress(ctx, step, 0, 1, 'Looking for duplicates…');
      const sets = await findDuplicateSets(library, ctx, deps);
      const plan = await planDuplicates(sets, library.tracks, library.playlists, ctx.musicFolder, {
        sameContent: deps.sameContent, exists: deps.exists, fileId: deps.fileId,
      });
      throwIfCancelled(ctx.signal);
      progress(ctx, step, 1, 1, 'Done');
      return plan;
    }
    case 'gather': {
      progress(ctx, step, 0, 1, 'Planning the moves…');
      const plan = await planGather(library.tracks, ctx.musicFolder, {
        platform: deps.platform,
        exists: deps.exists,
        sameContent: deps.sameContent,
        isRegularFile: deps.isRegularFile,
        fileSize: deps.fileSize,
        freeBytes: deps.freeBytes,
        isMountPoint: deps.isMountPoint,
        fileId: deps.fileId,
      });
      progress(ctx, step, 1, 1, 'Done');
      return plan;
    }
    case 'convert':
      return planConvert(library, ctx, deps);
  }
}
