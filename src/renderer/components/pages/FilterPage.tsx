import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Filter, FolderOpen, Play, X, CheckCircle, AlertCircle, SkipForward, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../ui';
import { useAppContext } from '../../AppWithRouter';
import { formatFileSize } from '../../utils';

type FilterField = 'artist' | 'album' | 'genre' | 'rating' | 'bpm' | 'year' | 'format';
type FilterOp = 'contains' | 'equals' | 'gte' | 'lte';
type Mode = 'copy' | 'move';
type ConflictResolution = 'skip' | 'overwrite' | 'quality';
type Phase = 'idle' | 'previewing' | 'previewed' | 'running' | 'done' | 'cancelled';

interface FilterRule {
  id: string;
  field: FilterField;
  op: FilterOp;
  value: string;
}

interface Preview {
  matchedTracks: number;
  total: number;
  conflicts: number;
  missing: number;
  totalSizeBytes: number;
}

interface Progress {
  current: number;
  total: number;
  currentFile: string;
  succeeded: number;
  skipped: number;
  failed: number;
}

interface Result {
  succeeded: number;
  skipped: number;
  failed: number;
  errors: { file: string; error: string }[];
}

const FIELD_LABELS: Record<FilterField, string> = {
  artist: 'Artist', album: 'Album', genre: 'Genre',
  rating: 'Rating (0–5)', bpm: 'BPM', year: 'Year', format: 'Format (e.g. wav)',
};

const OPS_FOR_FIELD: Record<FilterField, { value: FilterOp; label: string }[]> = {
  artist: [{ value: 'contains', label: 'contains' }, { value: 'equals', label: 'equals' }],
  album:  [{ value: 'contains', label: 'contains' }, { value: 'equals', label: 'equals' }],
  genre:  [{ value: 'contains', label: 'contains' }, { value: 'equals', label: 'equals' }],
  format: [{ value: 'equals', label: 'equals' }],
  rating: [{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }, { value: 'equals', label: '=' }],
  bpm:    [{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }],
  year:   [{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }, { value: 'equals', label: '=' }],
};

let ruleCounter = 0;
const newRule = (): FilterRule => ({
  id: String(++ruleCounter),
  field: 'artist',
  op: 'contains',
  value: '',
});

export const FilterPage: React.FC = () => {
  const { libraryData, libraryPath } = useAppContext();

  const [rules, setRules] = useState<FilterRule[]>([newRule()]);
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<Mode>('copy');
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip');
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const operationIdRef = useRef('');
  const cancelledRef = useRef(false);

  const tracks = libraryData ? Array.from(libraryData.tracks.values()) : [];
  const hasLibrary = tracks.length > 0;
  const validRules = rules.filter(r => r.value.trim() !== '');

  useEffect(() => {
    const unsub = window.electronAPI.onFilterProgress?.((p: any) => {
      if (p.operationId === operationIdRef.current) setProgress(p);
    });
    return () => { unsub?.(); };
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setPreview(null);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  const pickDestination = useCallback(async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) setDestination(folder);
  }, []);

  const updateRule = useCallback((id: string, patch: Partial<FilterRule>) => {
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...patch };
      // Reset op to first valid option when field changes
      if (patch.field) {
        updated.op = OPS_FOR_FIELD[patch.field][0].value;
      }
      return updated;
    }));
    reset();
  }, [reset]);

  const runPreview = useCallback(async () => {
    if (!destination || !hasLibrary || validRules.length === 0) return;
    setPhase('previewing');
    setError(null);
    try {
      const res = await window.electronAPI.filterPreview({ tracks, filters: validRules, destination });
      if (res.success) { setPreview(res.data); setPhase('previewed'); }
      else { setError(res.error ?? 'Preview failed'); setPhase('idle'); }
    } catch { setError('Preview failed'); setPhase('idle'); }
  }, [destination, hasLibrary, tracks, validRules]);

  const runFilter = useCallback(async () => {
    if (!destination || !hasLibrary || validRules.length === 0) return;
    const operationId = `filter-${Date.now()}`;
    operationIdRef.current = operationId;
    cancelledRef.current = false;
    setPhase('running');
    setProgress(null);
    setResult(null);
    setError(null);
    try {
      const res = await window.electronAPI.filterLibrary({
        operationId, tracks, libraryPath: libraryPath ?? '',
        filters: validRules,
        options: { destination, mode, conflictResolution },
      });
      if (cancelledRef.current) return;
      if (res.success) { setResult(res.data); setPhase('done'); }
      else { setError(res.error ?? 'Operation failed'); setPhase('idle'); }
    } catch {
      if (!cancelledRef.current) { setError('Operation failed'); setPhase('idle'); }
    }
  }, [destination, hasLibrary, tracks, libraryPath, validRules, mode, conflictResolution]);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    await window.electronAPI.cancelFilter?.(operationIdRef.current);
    setPhase('cancelled');
  }, []);

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="p-te-lg h-full overflow-auto">
      <PageHeader title="Filter & Move" icon={Filter} />

      <div className="bg-white rounded-te shadow-sm p-te-md mt-te-md">
        <h3 className="font-semibold text-te-grey-800 mb-1">Filter tracks & copy/move to folder</h3>
        <p className="text-sm text-te-grey-500 font-te-mono mb-te-md">
          Select tracks matching your criteria and copy or move them to a destination folder.
          All filters must match (AND logic).
        </p>

        {!hasLibrary && (
          <p className="text-sm text-te-grey-400 italic">Load a library first.</p>
        )}

        {hasLibrary && (
          <div className="space-y-te-md">

            {/* Filter rules */}
            <div>
              <label className="block text-xs font-medium text-te-grey-600 mb-2 uppercase">Filters</label>
              <div className="space-y-2">
                {rules.map(rule => (
                  <div key={rule.id} className="flex gap-2 items-center">
                    <select
                      value={rule.field}
                      onChange={e => updateRule(rule.id, { field: e.target.value as FilterField })}
                      className="border border-te-grey-300 rounded-te px-2 py-1.5 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-orange"
                    >
                      {(Object.keys(FIELD_LABELS) as FilterField[]).map(f => (
                        <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                      ))}
                    </select>
                    <select
                      value={rule.op}
                      onChange={e => updateRule(rule.id, { op: e.target.value as FilterOp })}
                      className="border border-te-grey-300 rounded-te px-2 py-1.5 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-orange w-24"
                    >
                      {OPS_FOR_FIELD[rule.field].map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={rule.value}
                      onChange={e => updateRule(rule.id, { value: e.target.value })}
                      placeholder="value"
                      className="flex-1 border border-te-grey-300 rounded-te px-3 py-1.5 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-orange"
                    />
                    {rules.length > 1 && (
                      <button
                        onClick={() => { setRules(prev => prev.filter(r => r.id !== rule.id)); reset(); }}
                        className="text-te-grey-400 hover:text-te-red-500 transition-colors"
                        aria-label="Remove filter"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setRules(prev => [...prev, newRule()])}
                className="mt-2 flex items-center gap-1 text-xs text-te-orange hover:text-te-orange/80 font-te-mono transition-colors"
              >
                <Plus className="w-3 h-3" /> Add filter
              </button>
            </div>

            {/* Destination */}
            <div>
              <label className="block text-xs font-medium text-te-grey-600 mb-1 uppercase">Destination folder</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={destination}
                  onChange={e => { setDestination(e.target.value); reset(); }}
                  placeholder="/Volumes/SSD/Filtered"
                  className="flex-1 border border-te-grey-300 rounded-te px-3 py-2 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-orange"
                />
                <button onClick={pickDestination} aria-label="Browse" className="btn-secondary flex items-center gap-1 px-3">
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mode */}
            <fieldset>
              <legend className="block text-xs font-medium text-te-grey-600 mb-2 uppercase">Operation</legend>
              <div className="flex gap-3">
                {(['copy', 'move'] as Mode[]).map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="filter-mode" value={m} checked={mode === m}
                      onChange={() => { setMode(m); reset(); }} className="text-te-orange" />
                    <span className="text-sm capitalize text-te-grey-800">{m}</span>
                    <span className="text-xs text-te-grey-400">
                      {m === 'copy' ? '(safe — originals kept)' : '(frees space — originals deleted)'}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Conflict resolution */}
            <fieldset>
              <legend className="block text-xs font-medium text-te-grey-600 mb-2 uppercase">When file already exists at destination</legend>
              <div className="flex gap-4">
                {[
                  { value: 'skip', label: 'Skip' },
                  { value: 'overwrite', label: 'Overwrite' },
                  { value: 'quality', label: 'Keep higher quality' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="filter-conflict" value={opt.value}
                      checked={conflictResolution === opt.value}
                      onChange={() => { setConflictResolution(opt.value as ConflictResolution); reset(); }}
                      className="text-te-orange" />
                    <span className="text-sm text-te-grey-800">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Preview result */}
            {preview && phase === 'previewed' && (
              <div className="bg-te-grey-100 rounded-te p-te-sm text-sm font-te-mono space-y-1">
                <div className="font-semibold text-te-grey-700">Preview</div>
                <div>{preview.matchedTracks} of {preview.total} tracks match — {formatFileSize(preview.totalSizeBytes)}</div>
                {preview.conflicts > 0 && <div className="text-te-amber-600">{preview.conflicts} conflicts at destination</div>}
                {preview.missing > 0 && <div className="text-te-grey-400">{preview.missing} source files not found (skipped)</div>}
              </div>
            )}

            {/* Progress */}
            {phase === 'running' && progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-te-grey-500 font-te-mono">
                  <span className="truncate max-w-xs">{progress.currentFile}</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div className="w-full bg-te-grey-200 rounded-full h-2">
                  <div className="bg-te-orange h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-4 text-xs font-te-mono text-te-grey-500">
                  <span className="text-green-600">{progress.succeeded} {mode === 'copy' ? 'copied' : 'moved'}</span>
                  <span className="text-te-grey-400">{progress.skipped} skipped</span>
                  {progress.failed > 0 && <span className="text-red-500">{progress.failed} failed</span>}
                </div>
              </div>
            )}

            {/* Result */}
            {(phase === 'done' || phase === 'cancelled') && result && (
              <div className="bg-te-grey-100 rounded-te p-te-sm text-sm font-te-mono space-y-1">
                <div className="flex items-center gap-2 font-semibold text-te-grey-700">
                  {phase === 'done' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-te-amber-500" />}
                  {phase === 'done' ? 'Complete' : 'Cancelled'}
                </div>
                <div className="flex gap-4">
                  <span className="text-green-600">{result.succeeded} {mode === 'copy' ? 'copied' : 'moved'}</span>
                  <span className="text-te-grey-400 flex items-center gap-1"><SkipForward className="w-3 h-3" />{result.skipped} skipped</span>
                  {result.failed > 0 && <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{result.failed} failed</span>}
                </div>
                {result.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-red-500 text-xs">Show errors</summary>
                    <ul className="mt-1 space-y-1 text-xs text-red-400 max-h-32 overflow-auto">
                      {result.errors.map((e, i) => <li key={i}>{e.file}: {e.error}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {error && <div className="text-sm text-red-500 font-te-mono">{error}</div>}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {phase === 'running' ? (
                <button onClick={cancel} className="btn-secondary flex items-center gap-2">
                  <X className="w-4 h-4" /> Cancel
                </button>
              ) : (
                <>
                  <button
                    onClick={runPreview}
                    disabled={!destination || validRules.length === 0 || phase === 'previewing'}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-40"
                  >
                    {phase === 'previewing' ? 'Previewing…' : 'Preview'}
                  </button>
                  <button
                    onClick={runFilter}
                    disabled={!destination || validRules.length === 0}
                    className="btn-primary flex items-center gap-2 disabled:opacity-40"
                  >
                    <Play className="w-4 h-4" />
                    {mode === 'copy' ? 'Copy Filtered Tracks' : 'Move Filtered Tracks'}
                  </button>
                  {(phase === 'done' || phase === 'cancelled') && (
                    <button onClick={reset} className="btn-secondary">Reset</button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
