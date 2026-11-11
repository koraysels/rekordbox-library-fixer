import type { MissingTrack, RelocationCandidate } from '../trackRelocator';
import { isStreamingLocation } from '../streamingLocation';
import type { RelocateStepPlan, WizardTrackRef } from './types';

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

/**
 * Split the missing tracks into the ones the wizard relocates on one confirm
 * (best match at or above the threshold) and the ones it sets aside with their
 * best guess. A track with no candidate at all is left out: the remove step
 * decides about it.
 */
export function planRelocations(
  missing: MissingTrack[],
  candidates: Map<string, RelocationCandidate[]>,
  threshold = WIZARD_RELOCATE_THRESHOLD,
): RelocateStepPlan {
  const plan: RelocateStepPlan = { step: 'relocate', apply: [], setAside: [] };
  for (const track of missing) {
    if (isStreamingLocation(track.originalLocation)) {continue;}
    const best = bestCandidate(candidates.get(track.id));
    if (!best) {continue;}
    if (best.confidence >= threshold) {
      plan.apply.push({ ...refOf(track), to: best.path, confidence: best.confidence });
    } else {
      plan.setAside.push({
        ...refOf(track),
        why: `Best match is ${Math.round(best.confidence * 100)} %`,
        bestGuess: { path: best.path, confidence: best.confidence },
      });
    }
  }
  return plan;
}
