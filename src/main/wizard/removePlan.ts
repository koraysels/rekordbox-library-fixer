import type { MissingTrack, RelocationCandidate } from '../trackRelocator';
import { isStreamingLocation } from '../streamingLocation';
import { driveName } from './volumes';
import { bestCandidate, refOf } from './relocatePlan';
import type { RemoveStepPlan } from './types';

/** Why an entry whose file the app may not look at is left alone. */
export const NO_ACCESS =
  "The app isn't allowed to look at this file, so it may still be there. Give it access (on a Mac: System Settings › Privacy & Security › Files and Folders), then check again.";

/**
 * The entries the wizard removes: still missing after relocation, on a drive
 * that is plugged in, and with no relocation candidate at any confidence from a
 * search that covered every folder. An entry on an unplugged drive is never
 * removed — its file is not lost — and one with even a weak guess is left for
 * the user to look at. When the search could not look everywhere
 * (`incomplete`, the reason in words), "no candidate" proves nothing, and every
 * entry is left for the user.
 */
export function planRemovals(
  missing: MissingTrack[],
  candidates: Map<string, RelocationCandidate[]>,
  isMounted: (p: string) => boolean,
  platform: NodeJS.Platform = process.platform,
  incomplete?: string,
): RemoveStepPlan {
  const plan: RemoveStepPlan = { step: 'remove', remove: [], setAside: [] };
  for (const track of missing) {
    const location = track.originalLocation;
    if (isStreamingLocation(location)) {continue;}
    if (!isMounted(location)) {
      plan.setAside.push({ ...refOf(track), why: `Drive ${driveName(location, platform)} is not plugged in` });
      continue;
    }
    if (track.unreadable) {
      plan.setAside.push({ ...refOf(track), why: NO_ACCESS });
      continue;
    }
    const best = bestCandidate(candidates.get(track.id));
    if (best) {
      plan.setAside.push({
        ...refOf(track),
        why: 'Might be found by hand',
        bestGuess: { path: best.path, confidence: best.confidence },
      });
      continue;
    }
    if (incomplete || !candidates.has(track.id)) {
      plan.setAside.push({ ...refOf(track), why: incomplete ?? 'Not searched for' });
      continue;
    }
    plan.remove.push(refOf(track));
  }
  return plan;
}
