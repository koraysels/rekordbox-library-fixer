import type { MissingTrack, RelocationCandidate } from '../trackRelocator';
import { isStreamingLocation } from '../streamingLocation';
import { referenceKey } from '../convert/applyConversions';
import type { RelocateStepPlan, SetAsideItem, WizardTrackRef } from './types';

/** The relocation threshold the wizard trusts without asking (confidence is 0–1). */
export const WIZARD_RELOCATE_THRESHOLD = 0.9;

export const refOf = (t: MissingTrack): WizardTrackRef => ({
  trackIds: [t.id], name: t.name, artist: t.artist, location: t.originalLocation,
});

export function bestCandidate(candidates: RelocationCandidate[] | undefined): RelocationCandidate | undefined {
  let best: RelocationCandidate | undefined;
  for (const c of candidates ?? []) {
    if (!best || c.confidence > best.confidence) {best = c;}
  }
  return best;
}

export const SEVERAL_FILES = 'Several files have this name';
export const SHARED_TARGET = 'Another missing track matches the same file';

const percent = (c: number) => Math.round(c * 100);

/**
 * Split the missing tracks into the ones the wizard relocates on one confirm
 * and the ones it sets aside with their best guess. Sure means one-to-one:
 * exactly one candidate at or above the threshold, and no other missing track
 * (another file) heading for the same target — otherwise one track's cues and
 * beatgrid would land on another song. A track with no candidate at all is left
 * out: the remove step decides about it.
 */
export function planRelocations(
  missing: MissingTrack[],
  candidates: Map<string, RelocationCandidate[]>,
  threshold = WIZARD_RELOCATE_THRESHOLD,
): RelocateStepPlan {
  const plan: RelocateStepPlan = { step: 'relocate', apply: [], setAside: [] };
  const aside = (track: MissingTrack, why: string, best: RelocationCandidate): SetAsideItem => ({
    ...refOf(track), why, bestGuess: { path: best.path, confidence: best.confidence },
  });

  const sure: Array<{ track: MissingTrack; best: RelocationCandidate }> = [];
  for (const track of missing) {
    if (isStreamingLocation(track.originalLocation)) {continue;}
    const list = candidates.get(track.id) ?? [];
    const best = bestCandidate(list);
    if (!best) {continue;}
    const above = list.filter((c) => c.confidence >= threshold);
    if (above.length === 0) {
      plan.setAside.push(aside(track, `Best match is ${percent(best.confidence)} %`, best));
    } else if (new Set(above.map((c) => referenceKey(c.path))).size > 1) {
      plan.setAside.push(aside(track, SEVERAL_FILES, best));
    } else {
      sure.push({ track, best });
    }
  }

  // The files each target would serve. Two entries of one file may share a
  // target; two different files may not.
  const sourcesOf = new Map<string, Set<string>>();
  for (const { track, best } of sure) {
    const key = referenceKey(best.path);
    const sources = sourcesOf.get(key) ?? new Set<string>();
    sources.add(referenceKey(track.originalLocation));
    sourcesOf.set(key, sources);
  }
  for (const { track, best } of sure) {
    if ((sourcesOf.get(referenceKey(best.path))?.size ?? 0) > 1) {
      plan.setAside.push(aside(track, SHARED_TARGET, best));
    } else {
      plan.apply.push({ ...refOf(track), to: best.path, confidence: best.confidence });
    }
  }
  return plan;
}
