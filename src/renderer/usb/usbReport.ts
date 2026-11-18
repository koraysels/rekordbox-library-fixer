import { notOnStickReasons } from '../../main/usb/usbCheck';
import type {
  NotOnStickEntry, NotOnStickReason, PlaylistCheck, UsbCheckResult, UsbStick,
} from '../../main/ipcContract';

/**
 * The USB check's result arranged for the page: which playlists fall short,
 * what each reason adds up to, which stick to check. Free of React so it is
 * tested without rendering.
 */

/** A playlist the stick does not carry in full: entries left out, or the whole list absent. */
export const isIncomplete = (p: PlaylistCheck) => !p.onStick || p.notOnStick.length > 0;

export type PlaylistStatus = 'complete' | 'incomplete' | 'empty-on-stick' | 'not-on-stick';

export function playlistStatus(p: PlaylistCheck): PlaylistStatus {
  if (!p.onStick) {return 'not-on-stick';}
  if (p.notOnStick.length === 0) {return 'complete';}
  return p.stickCount === 0 ? 'empty-on-stick' : 'incomplete';
}

/** Incomplete playlists first, the most entries short at the top; complete ones after, in library order. */
export function orderPlaylists(playlists: PlaylistCheck[]): PlaylistCheck[] {
  const short = playlists.filter(isIncomplete)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.notOnStick.length - a.p.notOnStick.length || a.i - b.i)
    .map(({ p }) => p);
  return [...short, ...playlists.filter((p) => !isIncomplete(p))];
}

/** The reasons that occur, in the order a fix is worth doing, with their counts. */
export function reasonCounts(result: UsbCheckResult): Array<{ reason: NotOnStickReason; count: number }> {
  return notOnStickReasons
    .map((reason) => ({ reason, count: result.totals.byReason[reason] ?? 0 }))
    .filter((r) => r.count > 0);
}

export interface ReasonGroup {
  reason: NotOnStickReason;
  /** For `drive-unplugged`, one group per drive. */
  drive?: string;
  entries: NotOnStickEntry[];
}

/** One playlist's missing entries grouped by reason (unplugged ones per drive), in reason order. */
export function groupByReason(entries: NotOnStickEntry[]): ReasonGroup[] {
  const groups = new Map<string, ReasonGroup>();
  for (const e of entries) {
    const key = e.reason === 'drive-unplugged' ? `${e.reason}\u0000${e.drive ?? ''}` : e.reason;
    const group = groups.get(key) ?? { reason: e.reason, ...(e.reason === 'drive-unplugged' ? { drive: e.drive } : {}), entries: [] };
    group.entries.push(e);
    groups.set(key, group);
  }
  const rank = (r: NotOnStickReason) => notOnStickReasons.indexOf(r);
  return [...groups.values()].sort((a, b) => rank(a.reason) - rank(b.reason) || b.entries.length - a.entries.length);
}

/**
 * Which stick to check: the only one there is; or, of several, the one checked
 * before if it is still plugged in; otherwise none, so the page asks.
 */
export function pickStick(sticks: UsbStick[], previous: string | null): UsbStick | null {
  if (sticks.length === 1) {return sticks[0];}
  return sticks.find((s) => s.root === previous) ?? null;
}

export const playlistPath = (path: string[]) => path.join(' / ');
