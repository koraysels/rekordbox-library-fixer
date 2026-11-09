import { describeReason, type UnplayableReason } from '../../main/convert/playerProfiles';
import type { ConvertCandidate } from '../../main/ipcContract';

/** One word for a kind of problem, to filter by: "FLAC isn't supported" and "96 kHz …" are different keys. */
export function reasonLabel(reason: UnplayableReason): string {
  return describeReason(reason);
}

export const candidateKey = (c: ConvertCandidate) => c.location;

/** The distinct reasons across the list, with how many files each touches, most common first. */
export function groupByReason(candidates: ConvertCandidate[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    for (const label of new Set(c.reasons.map(reasonLabel))) { counts.set(label, (counts.get(label) ?? 0) + 1); }
  }
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Everything when `label` is empty; otherwise the files that have that reason. */
export function filterByReason(candidates: ConvertCandidate[], label: string): ConvertCandidate[] {
  if (!label) { return candidates; }
  return candidates.filter((c) => c.reasons.some((r) => reasonLabel(r) === label));
}

/** Files that can be converted: a file that could not be read is listed, never selectable. */
export const isConvertible = (c: ConvertCandidate) => !c.unreachable;
