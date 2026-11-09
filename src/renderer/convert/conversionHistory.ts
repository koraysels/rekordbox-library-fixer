import type { ActivityDetail, ActivityEntry } from '../db/duplicationHistoryDb';
import type { ConvertPreviewItem, ConvertRunResult } from '../../main/ipcContract';
import { switchedItems } from './switchedItems';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One Activity entry for a run: a line per file, old path to new path, and how it went. */
export function buildConversionEntry(run: {
  libraryPath: string;
  items: ConvertPreviewItem[];
  result: ConvertRunResult;
  names?: Record<string, string>;
  now?: Date;
}): Omit<ActivityEntry, 'id'> {
  const { items, result } = run;
  const done = new Set(switchedItems(items, result).map((i) => i.from));
  const failedWhy = new Map(result.failed.map((f) => [f.from, f.error]));
  const conflicts = new Set(result.conflicts);

  const details: ActivityDetail[] = items.map((item) => {
    const trackName = run.names?.[item.from];
    if (done.has(item.from)) { return { action: 'converted', trackName, from: item.from, to: item.to }; }
    if (conflicts.has(item.from) || item.readiness === 'conflict') {
      return { action: 'failed', trackName, from: item.from, to: item.to, error: 'A different file already has the output name' };
    }
    const error = failedWhy.get(item.from)
      ?? result.error
      ?? (result.cancelled ? 'Cancelled before this file' : 'Not switched in the library');
    return { action: 'failed', trackName, from: item.from, to: item.to, error };
  });

  const converted = done.size;
  let summary = `Converted ${converted} of ${plural(items.length, 'file')}`;
  if (result.trashed) { summary += `, ${result.trashed} original${result.trashed === 1 ? '' : 's'} moved to the Trash`; }
  if (result.cancelled) { summary += ' (cancelled)'; }
  if (result.error) { summary = `Conversion failed: ${result.error}`; }

  return {
    libraryPath: run.libraryPath,
    timestamp: run.now ?? new Date(),
    type: 'conversion',
    summary,
    backupPath: result.backupPath,
    details,
  };
}
