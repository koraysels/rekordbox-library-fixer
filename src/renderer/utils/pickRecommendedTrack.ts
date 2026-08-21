const ext = (loc: string) => {
  const i = (loc || '').lastIndexOf('.');
  return i === -1 ? '' : loc.slice(i).toLowerCase();
};
const isUniversalLossless = (loc: string) => ['.wav', '.aiff', '.aif'].includes(ext(loc));
const isFlac = (loc: string) => ext(loc) === '.flac';

/**
 * Which copy of a duplicate set the current strategy would keep.
 * Shared by the duplicate row (to badge the recommended copy) and by the
 * delete-confirmation modal (to list only the copies that will be trashed),
 * so both agree on the winner. Mirrors the main process's resolution rules.
 * Returns null for the 'manual' strategy, where the user picks.
 */
export function pickRecommendedTrack(
  tracks: any[],
  resolutionStrategy: string,
  pathPreferences: string[] = [],
  preferLossless = false
): any | null {
  if (resolutionStrategy === 'manual' || !tracks || tracks.length === 0) { return null; }

  if (resolutionStrategy === 'keep-highest-quality') {
    const qualityScore = (t: any) => (t.bitrate || 0) + (t.size || 0) / 1000000;
    const tier = (t: any) => {
      if (isUniversalLossless(t.location || '')) { return 2; }
      if (preferLossless && isFlac(t.location || '')) { return 2; }
      return 0;
    };
    return tracks.reduce((best: any, current: any) => {
      const bt = tier(best); const ct = tier(current);
      if (ct > bt) { return current; }
      if (bt > ct) { return best; }
      return qualityScore(current) > qualityScore(best) ? current : best;
    });
  }

  if (resolutionStrategy === 'keep-newest') {
    return tracks.reduce((newest: any, current: any) => {
      if (!newest.dateModified) { return current; }
      if (!current.dateModified) { return newest; }
      return new Date(current.dateModified) > new Date(newest.dateModified) ? current : newest;
    });
  }

  if (resolutionStrategy === 'keep-oldest') {
    return tracks.reduce((oldest: any, current: any) => {
      if (!oldest.dateAdded) { return current; }
      if (!current.dateAdded) { return oldest; }
      return new Date(current.dateAdded) < new Date(oldest.dateAdded) ? current : oldest;
    });
  }

  if (resolutionStrategy === 'keep-preferred-path' && pathPreferences.length > 0) {
    const sorted = [...tracks].sort((a: any, b: any) => {
      const aMatch = pathPreferences.findIndex((pref) =>
        a.location && a.location.toLowerCase().includes(pref.toLowerCase()));
      const bMatch = pathPreferences.findIndex((pref) =>
        b.location && b.location.toLowerCase().includes(pref.toLowerCase()));
      if (aMatch !== -1 && bMatch !== -1) { return aMatch - bMatch; }
      if (aMatch !== -1) { return -1; }
      if (bMatch !== -1) { return 1; }
      return 0;
    });
    return sorted[0];
  }

  return tracks[0];
}
