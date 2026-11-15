/**
 * What a step's screen says: its title, what will happen, the list behind the
 * count, and where the set-aside cases are dealt with by hand. Pure, so the
 * wording can be tested without rendering, and one generic screen serves all
 * five steps.
 */
import type { StepPlan, WizardStepId } from '../../main/wizard/types';

export interface StepListItem { key: string; primary: string; secondary?: string; note?: string }

export interface StepText {
  title: string;
  /** What confirming does, with the count. Empty when there is nothing to apply. */
  lead: string;
  items: StepListItem[];
  confirmLabel: string;
  /** Listed under "Check these yourself"; the wizard does not decide them. */
  setAside: StepListItem[];
  /** Why the step cannot run as planned; the confirm is then off. */
  blocked?: string;
}

export const SET_ASIDE_HEADING = 'Check these yourself';
export const DONE_NOTE = 'Sync your USB sticks from rekordbox so they get these changes.';

/** The Advanced page where a step's set-aside cases are handled by hand. */
export const ADVANCED_ROUTE: Record<WizardStepId, { path: string; label: string }> = {
  relocate: { path: '/relocate', label: 'Open Track Relocation' },
  remove: { path: '/maintenance', label: 'Open Maintenance' },
  duplicates: { path: '/', label: 'Open Duplicate Detection' },
  gather: { path: '/maintenance', label: 'Open Maintenance' },
  convert: { path: '/convert', label: 'Open Convert' },
};

export function stepTitle(step: WizardStepId, playerName: string): string {
  switch (step) {
    case 'relocate': return 'Find moved tracks';
    case 'remove': return "Remove entries that can't be found";
    case 'duplicates': return 'Merge duplicates';
    case 'gather': return 'Move everything into your music folder';
    case 'convert': return `Make every track play on your ${playerName}`;
  }
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const baseName = (p: string) => p.split(/[\\/]/).pop() || p;
const gigabytes = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;
const who = (name: string, artist: string) => (artist ? `${name} — ${artist}` : name);

export function describePlan(plan: StepPlan, playerName: string): StepText {
  const title = stepTitle(plan.step, playerName);
  const asideOf = (items: Array<{ trackIds: string[]; name: string; artist: string; location: string; why: string }>) =>
    items.map((s) => ({ key: s.trackIds.join(',') || s.location, primary: who(s.name, s.artist), secondary: s.location, note: s.why }));

  switch (plan.step) {
    case 'relocate': {
      const n = plan.apply.length;
      return {
        title,
        lead: n ? `${count(n, 'track was', 'tracks were')} found in a new place. Their entries will point there.` : '',
        items: plan.apply.map((a) => ({
          key: a.trackIds.join(','),
          primary: who(a.name, a.artist),
          secondary: a.to,
          note: `${Math.round(a.confidence * 100)} % match`,
        })),
        confirmLabel: `Relocate ${count(n, 'track', 'tracks')}`,
        setAside: asideOf(plan.setAside),
      };
    }
    case 'remove': {
      const n = plan.remove.length;
      return {
        title,
        lead: n ? `${count(n, 'entry points', 'entries point')} at a file that is gone and could not be found anywhere. They will be removed from your collection.` : '',
        items: plan.remove.map((r) => ({ key: r.trackIds.join(','), primary: who(r.name, r.artist), secondary: r.location })),
        confirmLabel: `Remove ${count(n, 'entry', 'entries')}`,
        setAside: asideOf(plan.setAside),
      };
    }
    case 'duplicates': {
      const merges = plan.merges.filter((m) => m.removeIds.length > 0);
      const removed = merges.reduce((sum, m) => sum + m.removeIds.length, 0);
      const files = merges.reduce((sum, m) => sum + m.trashPaths.length, 0);
      const trash = files ? ` ${count(files, 'extra file goes', 'extra files go')} to the Trash.` : '';
      return {
        title,
        lead: removed
          ? `${count(merges.length, 'track has', 'tracks have')} duplicates. ${count(removed, 'entry', 'entries')} will be merged into the one with the most cues and playlists.${trash}`
          : '',
        items: merges.map((m) => ({
          key: m.keepId,
          primary: who(m.keepName, m.artist),
          note: `${count(m.removeIds.length, 'duplicate', 'duplicates')}${m.trashPaths.length ? `, ${count(m.trashPaths.length, 'file', 'files')} to the Trash` : ''}`,
        })),
        confirmLabel: `Merge ${count(merges.length, 'track', 'tracks')}`,
        setAside: asideOf(plan.setAside),
      };
    }
    case 'gather': {
      const n = plan.moves.length;
      const cross = plan.bytesCrossDrive > 0 ? ` ${gigabytes(plan.bytesCrossDrive)} is copied from other drives, then the originals go to the Trash.` : '';
      return {
        title,
        lead: n ? `${count(n, 'file is', 'files are')} outside your music folder and will be moved in.${cross}` : '',
        items: plan.moves.map((m) => ({
          key: m.from,
          primary: m.name || baseName(m.from),
          secondary: m.to,
          note: m.reuseExisting ? 'already there, reused' : undefined,
        })),
        confirmLabel: `Move ${count(n, 'file', 'files')}`,
        setAside: plan.unplugged.map((u) => ({
          key: u.drive,
          primary: `Plug in ${u.drive} to include these`,
          note: count(u.count, 'track', 'tracks'),
        })),
        blocked: plan.refusal,
      };
    }
    case 'convert': {
      const tracks = plan.items.reduce((sum, i) => sum + i.trackIds.length, 0);
      return {
        title,
        lead: tracks
          ? `${count(tracks, 'track does', 'tracks do')} not play on your ${playerName}. They will be converted to AIFF, and the originals moved to the Trash.`
          : '',
        items: plan.items.map((i) => ({
          key: i.from,
          primary: baseName(i.from),
          secondary: i.to,
          note: i.readiness === 'reusable' ? 'already converted, reused' : undefined,
        })),
        confirmLabel: `Convert ${count(tracks, 'track', 'tracks')}`,
        setAside: asideOf(plan.setAside),
        blocked: plan.ffmpeg.state === 'unsupported'
          ? "Converting isn't available on this computer: there is no ffmpeg build for it."
          : undefined,
      };
    }
  }
}
