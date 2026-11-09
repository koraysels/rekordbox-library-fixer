import React from 'react';
import type { ConvertRunResult } from '../../../main/ipcContract';

/** What a run did, in numbers, and what to do next. */
export const ConvertResultSummary: React.FC<{ result: ConvertRunResult; onDismiss: () => void }> = ({ result, onDismiss }) => {
  const problems = [
    ...result.failed.map((f) => `${f.from.split(/[\\/]/).pop()}: ${f.error}`),
    ...(result.skipped ?? []).map((s) => `Entry ${s.trackId} left alone: ${s.reason}`),
    ...(result.notTrashed ?? []).map((n) => `${n.from.split(/[\\/]/).pop()}: ${n.error}`),
  ];
  return (
    <div data-testid="convert-summary" className="mx-4 mt-3 p-3 rounded-te border-2 border-te-grey-300 bg-te-cream space-y-2">
      {result.error ? (
        <p className="text-sm font-te-mono normal-case text-te-red-500">
          Nothing was changed in the library: {result.error}. Converted files are kept next to the originals.
        </p>
      ) : (
        <p className="text-sm font-te-mono normal-case te-value">
          {result.cancelled ? 'Cancelled. ' : ''}
          {result.switched} switched · {result.failed.length} failed · {result.conflicts.length} conflicts · {result.trashed} trashed
        </p>
      )}
      {problems.length > 0 && (
        <ul className="text-xs font-te-mono normal-case text-te-grey-600 list-disc ml-5 max-h-32 overflow-y-auto">
          {problems.map((p, i) => <li key={i} className="break-all">{p}</li>)}
        </ul>
      )}
      {result.backupPath && (
        <p className="text-xs font-te-mono normal-case text-te-grey-600">Backed up first: {result.backupPath.split(/[\\/]/).pop()}</p>
      )}
      {result.switched > 0 && (
        <p className="text-sm font-te-mono normal-case te-value">Sync your USB from rekordbox so your sticks get the converted files.</p>
      )}
      <button type="button" onClick={onDismiss} className="btn-secondary text-xs">Dismiss</button>
    </div>
  );
};
