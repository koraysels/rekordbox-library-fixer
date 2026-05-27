import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Wrench, FolderOpen, Play, X, CheckCircle, AlertCircle, SkipForward, Info } from 'lucide-react';
import { PageHeader } from '../ui';
import { useAppContext } from '../../AppWithRouter';
import { formatFileSize } from '../../utils';

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

  const tracks = libraryData ? Array.from(libraryData.tracks.values()) : [];
  const hasLibrary = tracks.length > 0;

  // Wire up progress listener
  useEffect(() => {
    const unsub = window.electronAPI.onConsolidateProgress?.((p: any) => {
      if (p.operationId === operationIdRef.current) {
        setProgress(p);
      }
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
    } catch (e) {
      setError('Preview failed');
      setPhase('idle');
    }
  }, [destination, hasLibrary, tracks]);

  const runConsolidate = useCallback(async () => {
    if (!destination || !hasLibrary) return;
    const operationId = `consolidate-${Date.now()}`;
    operationIdRef.current = operationId;
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
      if (res.success) {
        setResult(res.data);
        setPhase('done');
      } else {
        setError(res.error ?? 'Consolidation failed');
        setPhase('idle');
      }
    } catch (e) {
      setError('Consolidation failed');
      setPhase('idle');
    }
  }, [destination, hasLibrary, tracks, libraryPath, mode, conflictResolution, preferLossless]);

  const cancel = useCallback(async () => {
    await window.electronAPI.cancelConsolidate?.(operationIdRef.current);
    setPhase('cancelled');
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setPreview(null);
    setProgress(null);
    setResult(null);
    setError(null);
    setPreferLossless(false);
  }, []);

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="p-te-lg h-full overflow-auto">
      <PageHeader title="Maintenance" icon={Wrench} />

      {/* Consolidate Library */}
      <div className="bg-white rounded-te shadow-sm p-te-md mt-te-md">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-te-grey-800">Consolidate Library</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">Beta / Untested</span>
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
                <button onClick={pickDestination} className="btn-secondary flex items-center gap-1 px-3">
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mode */}
            <div>
              <label className="block text-xs font-medium text-te-grey-600 mb-2 uppercase">Operation</label>
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
            </div>

            {/* Conflict resolution */}
            <div>
              <label className="block text-xs font-medium text-te-grey-600 mb-2 uppercase">When file already exists at destination</label>
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
            </div>

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
                  <span className="text-green-600">{progress.succeeded} copied</span>
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
                    <button onClick={reset} className="btn-secondary">Reset</button>
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
