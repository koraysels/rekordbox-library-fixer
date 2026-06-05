import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Wrench, FolderOpen, Play, X, CheckCircle, AlertCircle, SkipForward, Info, Filter, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../ui';
import { useAppContext } from '../../AppWithRouter';
import { formatFileSize } from '../../utils';

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

const QualityInfo: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-te-grey-400 hover:text-te-orange focus:outline-none"
        aria-label="Quality scoring info"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className="absolute z-50 left-5 top-0 w-64 bg-white border border-te-grey-200 rounded-te shadow-lg p-3 text-xs font-te-mono text-te-grey-700 space-y-1"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="font-semibold text-te-grey-800 mb-1">Quality scoring</div>
          <div><span className="text-green-600 font-semibold">WAV / AIFF</span> — always top tier</div>
          <div><span className="text-blue-600 font-semibold">FLAC</span> — top tier only when "Prefer FLAC" is on</div>
          <div><span className="text-te-grey-500 font-semibold">MP3 / AAC / OGG</span> — scored by bitrate &amp; size</div>
        </div>
      )}
    </span>
  );
};

type ConflictResolution = 'skip' | 'overwrite' | 'quality';
type Mode = 'copy' | 'move';
type Phase = 'idle' | 'previewing' | 'previewed' | 'running' | 'done' | 'cancelled';

interface Preview {
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

export const MaintenancePage: React.FC = () => {
  const { libraryData, libraryPath } = useAppContext();

  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<Mode>('copy');
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip');
  const [preferLossless, setPreferLossless] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const operationIdRef = useRef<string>('');
  const cancelledRef = useRef(false);

  // Filter & Move state
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

  const tracks = libraryData ? Array.from(libraryData.tracks.values()) : [];
  const hasLibrary = tracks.length > 0;
  const fValidRules = fRules.filter(r => r.value.trim() !== '');

  // Wire up progress listener
  useEffect(() => {
    const unsub = window.electronAPI.onConsolidateProgress?.((p: any) => {
      if (p.operationId === operationIdRef.current) {
        setProgress(p);
      }
    });
    return () => { unsub?.(); };
  }, []);

  useEffect(() => {
    const unsub = window.electronAPI.onFilterProgress?.((p: any) => {
      if (p.operationId === fOpIdRef.current) setFProgress(p);
    });
    return () => { unsub?.(); };
  }, []);

  const pickDestination = useCallback(async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) setDestination(folder);
  }, []);

  const runPreview = useCallback(async () => {
    if (!destination || !hasLibrary) return;
    setPhase('previewing');
    setError(null);
    try {
      const res = await window.electronAPI.consolidatePreview({ tracks, destination });
      if (res.success) {
        setPreview(res.data);
        setPhase('previewed');
      } else {
        setError(res.error ?? 'Preview failed');
        setPhase('idle');
      }
    } catch {
      setError('Preview failed');
      setPhase('idle');
    }
  }, [destination, hasLibrary, tracks]);

  const runConsolidate = useCallback(async () => {
    if (!destination || !hasLibrary) return;
    const operationId = `consolidate-${Date.now()}`;
    operationIdRef.current = operationId;
    cancelledRef.current = false;
    setPhase('running');
    setProgress(null);
    setResult(null);
    setError(null);
    try {
      const res = await window.electronAPI.consolidateLibrary({
        operationId,
        tracks,
        libraryPath: libraryPath ?? '',
        options: { destination, mode, conflictResolution, preferLossless },
      });
      if (cancelledRef.current) return;
      if (res.success) {
        setResult(res.data);
        setPhase('done');
      } else {
        setError(res.error ?? 'Consolidation failed');
        setPhase('idle');
      }
    } catch {
      if (!cancelledRef.current) {
        setError('Consolidation failed');
        setPhase('idle');
      }
    }
  }, [destination, hasLibrary, tracks, libraryPath, mode, conflictResolution, preferLossless]);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    await window.electronAPI.cancelConsolidate?.(operationIdRef.current);
    setPhase('cancelled');
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setPreview(null);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  // Filter & Move callbacks
  const fReset = useCallback(() => {
    setFPhase('idle'); setFPreview(null); setFProgress(null); setFResult(null); setFError(null);
  }, []);

  const fPickDest = useCallback(async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) setFDest(folder);
  }, []);

  const fUpdateRule = useCallback((id: string, patch: Partial<FilterRule>) => {
    setFRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const u = { ...r, ...patch };
      if (patch.field) u.op = OPS_FOR_FIELD[patch.field][0].value;
      return u;
    }));
    fReset();
  }, [fReset]);

  const fRunPreview = useCallback(async () => {
    if (!fDest || !hasLibrary || fValidRules.length === 0) return;
    setFPhase('previewing'); setFError(null);
    try {
      const res = await window.electronAPI.filterPreview({ tracks, filters: fValidRules, destination: fDest });
      if (res.success) { setFPreview(res.data); setFPhase('previewed'); }
      else { setFError(res.error ?? 'Preview failed'); setFPhase('idle'); }
    } catch { setFError('Preview failed'); setFPhase('idle'); }
  }, [fDest, hasLibrary, tracks, fValidRules]);

  const fRunFilter = useCallback(async () => {
    if (!fDest || !hasLibrary || fValidRules.length === 0) return;
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

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const fPct = fProgress && fProgress.total > 0
    ? Math.round((fProgress.current / fProgress.total) * 100)
    : 0;

  return (
    <div className="p-te-lg h-full overflow-auto">
      <PageHeader title="Maintenance" icon={Wrench} />

      {/* Consolidate Library */}
      <div className="bg-white rounded-te shadow-sm p-te-md mt-te-md">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-te-grey-800">Consolidate Library</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-te-amber-100 text-te-amber-600 border border-te-amber-200">Beta / Untested</span>
        </div>
        <p className="text-sm text-te-grey-500 font-te-mono mb-te-md">
          Copy or move all tracks to a single destination (e.g. an external SSD) and update the XML locations.
        </p>

        {!hasLibrary && (
          <p className="text-sm text-te-grey-400 italic">Load a library first to consolidate.</p>
        )}

        {hasLibrary && (
          <div className="space-y-te-md">
            {/* Destination */}
            <div>
              <label className="block text-xs font-medium text-te-grey-600 mb-1 uppercase">Destination folder</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={destination}
                  onChange={e => { setDestination(e.target.value); reset(); }}
                  placeholder="/Volumes/SSD/Music"
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
                    <input
                      type="radio"
                      name="mode"
                      value={m}
                      checked={mode === m}
                      onChange={() => { setMode(m); reset(); }}
                      className="text-te-orange"
                    />
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
              <div className="flex flex-col gap-2">
                {[
                  { value: 'skip', label: 'Skip', desc: 'Keep the existing destination file' },
                  { value: 'overwrite', label: 'Overwrite', desc: 'Always replace with source file' },
                  { value: 'quality', label: 'Use quality score', desc: 'Keep whichever is lossless or higher bitrate/sample rate' },
                ] .map(opt => (
                  <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="conflict"
                      value={opt.value}
                      checked={conflictResolution === opt.value}
                      onChange={() => { setConflictResolution(opt.value as ConflictResolution); reset(); }}
                      className="mt-0.5 text-te-orange"
                    />
                    <div>
                      <span className="text-sm font-medium text-te-grey-800">{opt.label}</span>
                      {opt.value === 'quality' && <QualityInfo />}
                      <span className="text-xs text-te-grey-400 ml-2 font-te-mono">{opt.desc}</span>
                    </div>
                  </label>
                ))}
                {conflictResolution === 'quality' && (
                  <label className="flex items-center gap-2 ml-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferLossless}
                      onChange={e => setPreferLossless(e.target.checked)}
                      className="text-te-orange"
                    />
                    <span className="text-sm text-te-grey-700">Prefer FLAC over lossy formats</span>
                  </label>
                )}
              </div>
            </fieldset>

            {/* Preview */}
            {preview && phase === 'previewed' && (
              <div className="bg-te-grey-100 rounded-te p-te-sm text-sm font-te-mono space-y-1">
                <div className="font-semibold text-te-grey-700">Preview</div>
                <div>{preview.total} tracks — {formatFileSize(preview.totalSizeBytes)}</div>
                {preview.conflicts > 0 && (
                  <div className="text-amber-600">{preview.conflicts} conflict{preview.conflicts !== 1 ? 's' : ''} at destination</div>
                )}
                {preview.missing > 0 && (
                  <div className="text-te-grey-400">{preview.missing} source files not found (will be skipped)</div>
                )}
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
                  <div
                    className="bg-te-orange h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
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
                  {phase === 'done' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-amber-500" />}
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
                      {result.errors.map((e, i) => (
                        <li key={i}>{e.file}: {e.error}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500 font-te-mono">{error}</div>
            )}

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
                    disabled={!destination || phase === 'previewing'}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-40"
                  >
                    {phase === 'previewing' ? 'Previewing…' : 'Preview'}
                  </button>
                  <button
                    onClick={runConsolidate}
                    disabled={!destination}
                    className="btn-primary flex items-center gap-2 disabled:opacity-40"
                  >
                    <Play className="w-4 h-4" />
                    {mode === 'copy' ? 'Copy Library' : 'Move Library'}
                  </button>
                  {(phase === 'done' || phase === 'cancelled') && (
                    <button onClick={() => { reset(); setPreferLossless(false); }} className="btn-secondary">Reset</button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter & Move */}
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
              <label className="block text-xs font-medium text-te-grey-600 mb-2 uppercase">Filters</label>
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
              <label className="block text-xs font-medium text-te-grey-600 mb-1 uppercase">Destination folder</label>
              <div className="flex gap-2">
                <input type="text" value={fDest} placeholder="/Volumes/SSD/Filtered"
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

      {/* Coming soon */}
      <div className="bg-white rounded-te shadow-sm p-te-md mt-te-md opacity-50">
        <h3 className="font-semibold text-te-grey-800 mb-1">Coming soon</h3>
        <ul className="text-sm text-te-grey-500 font-te-mono space-y-1 list-disc list-inside">
          <li>Find and remove orphan tracks</li>
          <li>Repair broken file references</li>
          <li>Optimise and clean up library metadata</li>
        </ul>
      </div>
    </div>
  );
};
