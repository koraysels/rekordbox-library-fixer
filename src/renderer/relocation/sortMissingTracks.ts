export type MissingTrackSort = 'library' | 'confidence';

/**
 * The best candidate's confidence (0–1), or undefined when there were none.
 * Recorded on a missing track by auto-relocate and by Find, so tracks that
 * nearly matched can be brought to the top and checked by hand.
 */
export function bestConfidenceOf(candidates: Array<{ confidence: number }>): number | undefined {
  if (candidates.length === 0) { return undefined; }
  return Math.max(...candidates.map((c) => c.confidence));
}

/**
 * Library order, or the closest near-misses first. A track with no score — never
 * searched, or nothing found — sorts last. Stable, and returns a new array.
 */
export function sortMissingTracks<T extends { bestConfidence?: number }>(
  tracks: T[],
  sort: MissingTrackSort
): T[] {
  if (sort === 'library') { return tracks; }
  return [...tracks].sort((a, b) => (b.bestConfidence ?? -1) - (a.bestConfidence ?? -1));
}
