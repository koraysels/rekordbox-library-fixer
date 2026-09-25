import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FolderOpen, Play, X, CheckCircle, AlertCircle, SkipForward, Plus, Trash2 } from 'lucide-react';
import { formatFileSize } from '../../utils';
import type { TrackPayload } from '../../../main/ipcContract';
import type { ConflictResolution, Mode, Phase, Progress, Result } from './shared';

// ── Filter & Move types ──────────────────────────────────────────────────────
type FilterField = 'artist' | 'album' | 'genre' | 'rating' | 'bpm' | 'year' | 'format';
type FilterOp = 'contains' | 'equals' | 'gte' | 'lte';
interface FilterRule { id: string; field: FilterField; op: FilterOp; value: string; }

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
let _ruleCounter = 0;
const newRule = (): FilterRule => ({ id: String(++_ruleCounter), field: 'artist', op: 'contains', value: '' });

interface FilterMovePanelProps {
  tracks: TrackPayload[];
  libraryPath: string;
  hasLibrary: boolean;
}

/**
 * Take the part of the library that matches a set of rules — everything over
 * 128 BPM, everything rated four and up — and copy or move just that.
 */
export const FilterMovePanel: React.FC<FilterMovePanelProps> = ({
  tracks, libraryPath, hasLibrary,
}) => {
  const [fRules, setFRules] = useState<FilterRule[]>([newRule()]);
  const [fDest, setFDest] = useState('');
  const [fMode, setFMode] = useState<Mode>('copy');
  const [fConflict, setFConflict] = useState<ConflictResolution>('skip');
  const [fPhase, setFPhase] = useState<Phase>('idle');
  const [fPreview, setFPreview] = useState<{ matchedTracks: number; total: number; conflicts: number; missing: number; totalSizeBytes: number } | null>(null);
  const [fProgress, setFProgress] = useState<Progress | null>(null);
  const [fResult, setFResult] = useState<Result | null>(null);
  const [fError, setFError] = useState<string | null>(null);
  const fOpIdRef = useRef('');
  const fCancelledRef = useRef(false);

  /** A rule with no value is one the user is still typing; it filters nothing. */
  const fValidRules = fRules.filter(r => r.value.trim() !== '');


  useEffect(() => {
    const unsub = window.electronAPI.onFilterProgress?.((p: any) => {
      if (p.operationId === fOpIdRef.current) {setFProgress(p);}
    });
    return () => { unsub?.(); };
  }, []);


  const fReset = useCallback(() => {
    setFPhase('idle'); setFPreview(null); setFProgress(null); setFResult(null); setFError(null);
  }, []);

  const fPickDest = useCallback(async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {setFDest(folder);}
  }, []);

  const fUpdateRule = useCallback((id: string, patch: Partial<FilterRule>) => {
    setFRules(prev => prev.map(r => {
      if (r.id !== id) {return r;}
      const u = { ...r, ...patch };
      if (patch.field) {u.op = OPS_FOR_FIELD[patch.field][0].value;}
      return u;
    }));
    fReset();
  }, [fReset]);

  const fRunPreview = useCallback(async () => {
    if (!fDest || !hasLibrary || fValidRules.length === 0) {return;}
    setFPhase('previewing'); setFError(null);
    try {
      const res = await window.electronAPI.filterPreview({ tracks, filters: fValidRules, destination: fDest });
      if (res.success) { setFPreview(res.data); setFPhase('previewed'); }
      else { setFError(res.error ?? 'Preview failed'); setFPhase('idle'); }
    } catch { setFError('Preview failed'); setFPhase('idle'); }
  }, [fDest, hasLibrary, tracks, fValidRules]);

  const fRunFilter = useCallback(async () => {
    if (!fDest || !hasLibrary || fValidRules.length === 0) {return;}
    const opId = `filter-${Date.now()}`;
    fOpIdRef.current = opId; fCancelledRef.current = false;
    setFPhase('running'); setFProgress(null); setFResult(null); setFError(null);
    try {
      const res = await window.electronAPI.filterLibrary({
        operationId: opId, tracks, libraryPath: libraryPath ?? '',
        filters: fValidRules, options: { destination: fDest, mode: fMode, conflictResolution: fConflict },
      });
      if (res.success) {
        setFResult(res.data);
        setFPhase(fCancelledRef.current ? 'cancelled' : 'done');
      } else if (!fCancelledRef.current) {
        setFError(res.error ?? 'Operation failed');
        setFPhase('idle');
      }
    } catch { if (!fCancelledRef.current) { setFError('Operation failed'); setFPhase('idle'); } }
  }, [fDest, hasLibrary, tracks, libraryPath, fValidRules, fMode, fConflict]);

  const fCancel = useCallback(async () => {
    fCancelledRef.current = true;
    await window.electronAPI.cancelFilter?.(fOpIdRef.current);
    setFPhase('cancelled');
  }, []);

  const fPct = fProgress && fProgress.total > 0
    ? Math.round((fProgress.current / fProgress.total) * 100)
    : 0;

  return (
    <div className="bg-white rounded-te shadow-sm p-te-md mt-te-md">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-semibold text-te-grey-800">Filter &amp; Move</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-te-amber-100 text-te-amber-600 border border-te-amber-200">Beta / Untested</span>
      </div>
      <p className="text-sm text-te-grey-500 font-te-mono mb-te-md">
        Copy or move tracks matching your criteria to a destination folder. All filters must match (AND logic).
      </p>

      {!hasLibrary && <p className="text-sm text-te-grey-400 italic">Load a library first.</p>}

      {hasLibrary && (
        <div className="space-y-te-md">
          {/* Filter rules */}
          <div>
            <p className="block text-xs font-medium text-te-grey-600 mb-2 uppercase">Filters</p>
            <div className="space-y-2">
              {fRules.map(rule => (
                <div key={rule.id} className="flex gap-2 items-center">
                  <select value={rule.field} onChange={e => fUpdateRule(rule.id, { field: e.target.value as FilterField })}
                    className="border border-te-grey-300 rounded-te px-2 py-1.5 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-orange">
                    {(Object.keys(FIELD_LABELS) as FilterField[]).map(f => (
                      <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                    ))}
                  </select>
                  <select value={rule.op} onChange={e => fUpdateRule(rule.id, { op: e.target.value as FilterOp })}
                    className="border border-te-grey-300 rounded-te px-2 py-1.5 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-orange w-24">
                    {OPS_FOR_FIELD[rule.field].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input type="text" value={rule.value} placeholder="value"
                    onChange={e => fUpdateRule(rule.id, { value: e.target.value })}
                    className="flex-1 border border-te-grey-300 rounded-te px-3 py-1.5 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-orange" />
                  {fRules.length > 1 && (
                    <button onClick={() => { setFRules(prev => prev.filter(r => r.id !== rule.id)); fReset(); }}
                      className="text-te-grey-400 hover:text-te-red-500 transition-colors" aria-label="Remove filter">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setFRules(prev => [...prev, newRule()])}
              className="mt-2 flex items-center gap-1 text-xs text-te-orange hover:text-te-orange/80 font-te-mono transition-colors">
              <Plus className="w-3 h-3" /> Add filter
            </button>
          </div>

          {/* Destination */}
          <div>
            <label htmlFor="filter-destination" className="block text-xs font-medium text-te-grey-600 mb-1 uppercase">Destination folder</label>
            <div className="flex gap-2">
              <input id="filter-destination" type="text" value={fDest} placeholder="/Volumes/SSD/Filtered"
                onChange={e => { setFDest(e.target.value); fReset(); }}
                className="flex-1 border border-te-grey-300 rounded-te px-3 py-2 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-orange" />
              <button onClick={fPickDest} aria-label="Browse" className="btn-secondary flex items-center gap-1 px-3">
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
                  <input type="radio" name="filter-mode" value={m} checked={fMode === m}
                    onChange={() => { setFMode(m); fReset(); }} className="text-te-orange" />
                  <span className="text-sm capitalize text-te-grey-800">{m}</span>
                  <span className="text-xs text-te-grey-400">{m === 'copy' ? '(safe — originals kept)' : '(frees space — originals deleted)'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Conflict resolution */}
          <fieldset>
            <legend className="block text-xs font-medium text-te-grey-600 mb-2 uppercase">When file already exists at destination</legend>
            <div className="flex gap-4">
              {[{ value: 'skip', label: 'Skip' }, { value: 'overwrite', label: 'Overwrite' }, { value: 'quality', label: 'Keep higher quality' }].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="filter-conflict" value={opt.value} checked={fConflict === opt.value}
                    onChange={() => { setFConflict(opt.value as ConflictResolution); fReset(); }} className="text-te-orange" />
                  <span className="text-sm text-te-grey-800">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Preview result */}
          {fPreview && fPhase === 'previewed' && (
            <div className="bg-te-grey-100 rounded-te p-te-sm text-sm font-te-mono space-y-1">
              <div className="font-semibold text-te-grey-700">Preview</div>
              <div>{fPreview.matchedTracks} of {fPreview.total} tracks match — {formatFileSize(fPreview.totalSizeBytes)}</div>
              {fPreview.conflicts > 0 && <div className="text-te-amber-600">{fPreview.conflicts} conflicts at destination</div>}
              {fPreview.missing > 0 && <div className="text-te-grey-400">{fPreview.missing} source files not found (skipped)</div>}
            </div>
          )}

          {/* Progress */}
          {fPhase === 'running' && fProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-te-grey-500 font-te-mono">
                <span className="truncate max-w-xs">{fProgress.currentFile}</span>
                <span>{fProgress.current} / {fProgress.total}</span>
              </div>
              <div className="w-full bg-te-grey-200 rounded-full h-2">
                <div className="bg-te-orange h-2 rounded-full transition-all" style={{ width: `${fPct}%` }} />
              </div>
              <div className="flex gap-4 text-xs font-te-mono text-te-grey-500">
                <span className="text-green-600">{fProgress.succeeded} {fMode === 'copy' ? 'copied' : 'moved'}</span>
                <span className="text-te-grey-400">{fProgress.skipped} skipped</span>
                {fProgress.failed > 0 && <span className="text-red-500">{fProgress.failed} failed</span>}
              </div>
            </div>
          )}

          {/* Result */}
          {(fPhase === 'done' || fPhase === 'cancelled') && fResult && (
            <div className="bg-te-grey-100 rounded-te p-te-sm text-sm font-te-mono space-y-1">
              <div className="flex items-center gap-2 font-semibold text-te-grey-700">
                {fPhase === 'done' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-te-amber-500" />}
                {fPhase === 'done' ? 'Complete' : 'Cancelled'}
              </div>
              <div className="flex gap-4">
                <span className="text-green-600">{fResult.succeeded} {fMode === 'copy' ? 'copied' : 'moved'}</span>
                <span className="text-te-grey-400 flex items-center gap-1"><SkipForward className="w-3 h-3" />{fResult.skipped} skipped</span>
                {fResult.failed > 0 && <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fResult.failed} failed</span>}
              </div>
              {fResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-red-500 text-xs">Show errors</summary>
                  <ul className="mt-1 space-y-1 text-xs text-red-400 max-h-32 overflow-auto">
                    {fResult.errors.map((e, i) => <li key={i}>{e.file}: {e.error}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          {fError && <div className="text-sm text-red-500 font-te-mono">{fError}</div>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            {fPhase === 'running' ? (
              <button onClick={fCancel} className="btn-secondary flex items-center gap-2"><X className="w-4 h-4" /> Cancel</button>
            ) : (
              <>
                <button onClick={fRunPreview} disabled={!fDest || fValidRules.length === 0 || fPhase === 'previewing'}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-40">
                  {fPhase === 'previewing' ? 'Previewing…' : 'Preview'}
                </button>
                <button onClick={fRunFilter} disabled={!fDest || fValidRules.length === 0}
                  className="btn-primary flex items-center gap-2 disabled:opacity-40">
                  <Play className="w-4 h-4" />
                  {fMode === 'copy' ? 'Copy Filtered Tracks' : 'Move Filtered Tracks'}
                </button>
                {(fPhase === 'done' || fPhase === 'cancelled') && (
                  <button onClick={fReset} className="btn-secondary">Reset</button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>

  );
};
