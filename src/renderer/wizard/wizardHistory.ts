import type { ActivityEntry } from '../db/duplicationHistoryDb';
import type { StepResult, WizardStepId } from '../../main/wizard/types';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const TYPE: Record<WizardStepId, ActivityEntry['type']> = {
  relocate: 'relocation',
  remove: 'entry-removal',
  duplicates: 'duplicate-merge',
  gather: 'consolidate',
  convert: 'conversion',
};

/** What a step did, in the words the History page shows. */
const DID: Record<WizardStepId, (r: StepResult) => string> = {
  relocate: (r) => `relocated ${count(r.changed, 'track', 'tracks')}`,
  remove: (r) => `removed ${count(r.changed, 'entry', 'entries')} that could not be found`,
  duplicates: (r) => {
    const trashed = r.details.filter((d) => d.action === 'trashed').length;
    const removed = `merged duplicates, ${count(r.changed, 'entry', 'entries')} removed`;
    return trashed > 0 ? `${removed}, ${count(trashed, 'file', 'files')} moved to the Trash` : removed;
  },
  gather: (r) => `moved ${count(r.changed, 'file', 'files')} into your music folder`,
  convert: (r) => `converted ${count(r.changed, 'track', 'tracks')}`,
};

/** The step's name for a failure line: "Wizard: <doing> failed: <why>". */
const DOING: Record<WizardStepId, string> = {
  relocate: 'finding moved tracks',
  remove: 'removing entries',
  duplicates: 'merging duplicates',
  gather: 'moving into your music folder',
  convert: 'converting',
};

/** What a step did, in plain words: the History line without its "Wizard: " prefix. */
export function describeResult(result: StepResult): string {
  const said = result.error ? `${DOING[result.step]} failed: ${result.error}` : DID[result.step](result);
  return result.cancelled && !result.error ? `${said} (cancelled)` : said;
}

/** One Activity-history entry per wizard step, like every other library-changing operation. */
export function historyEntryFor(result: StepResult, libraryPath: string, now: Date = new Date()): Omit<ActivityEntry, 'id'> {
  return {
    libraryPath,
    timestamp: now,
    type: TYPE[result.step],
    summary: `Wizard: ${describeResult(result)}`,
    backupPath: result.backupPath,
    details: result.details,
  };
}
