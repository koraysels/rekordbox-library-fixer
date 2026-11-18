import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FolderOpen, Play, X, CheckCircle, AlertCircle, SkipForward } from 'lucide-react';
import { formatFileSize } from '../../utils';
import type { TrackPayload } from '../../../main/ipcContract';
import type { LibraryData } from '../../types';
import {
  CLASH_NOTE, dbKeyFor, isDatabaseLibrary, readLibraryAgain,
  type Mode, type Phase, type Progress, type Result,
} from './shared';
import { ProgressBar } from '../ui/ProgressBar';

interface Preview {
  total: number;
  conflicts: number;
  missing: number;
  totalSizeBytes: number;
}

interface ConsolidatePanelProps {
  tracks: TrackPayload[];
  libraryPath: string;
  hasLibrary: boolean;
  /** The library as it is after a run changed it. */
  onLibraryChanged?: (data: LibraryData) => void;
}

/**
 * Copy or move every track to one destination — an external SSD before a gig,
 * usually — and point the library at the new locations: in the rekordbox
 * database for a database library, in the XML for an XML one.
 */
export const ConsolidatePanel: React.FC<ConsolidatePanelProps> = ({
  tracks, libraryPath, hasLibrary, onLibraryChanged,
}) => {
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<Mode>('copy');
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const operationIdRef = useRef<string>('');
  const cancelledRef = useRef(false);

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
    if (folder) {setDestination(folder);}
  }, []);

  const runPreview = useCallback(async () => {
    if (!destination || !hasLibrary) {return;}
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
    if (!destination || !hasLibrary) {return;}
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
        options: { destination, mode },
        dbKey: dbKeyFor(libraryPath),
      });
      if (res.success && res.data) {
        // A cancelled run still wrote what it had done, so it is shown too.
        setResult(res.data);
        setPhase(cancelledRef.current ? 'cancelled' : 'done');
        if (res.data.entriesUpdated > 0) {
          const fresh = await readLibraryAgain(libraryPath);
          if (fresh) {onLibraryChanged?.(fresh);}
        }
      } else {
        setError(res.error ?? 'Consolidation failed');
        setPhase('idle');
      }
    } catch {
      setError('Consolidation failed');
      setPhase('idle');
    }
  }, [destination, hasLibrary, tracks, libraryPath, mode, onLibraryChanged]);

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

  return (
    <div className="bg-white rounded-te shadow-sm p-te-md mt-te-md">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-semibold text-te-grey-800">Consolidate Library</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-te-amber-100 text-te-amber-600 border border-te-amber-200">Beta / Untested</span>
      </div>
      <p className="text-sm text-te-grey-500 font-te-mono mb-te-md">
        Copy or move all tracks to a single destination (e.g. an external SSD) and point the library at them
        {isDatabaseLibrary(libraryPath) ? ' in the rekordbox database. Close rekordbox first; a backup is taken.' : ' in the XML.'}
      </p>

      {!hasLibrary && (
        <p className="text-sm text-te-grey-400 italic">Load a library first to consolidate.</p>
      )}

      {hasLibrary && (
        <div className="space-y-te-md">
          {/* Destination */}
          <div>
            <label htmlFor="consolidate-destination" className="block text-xs font-medium text-te-grey-600 mb-1 uppercase">Destination folder</label>
            <div className="flex gap-2">
              <input
                id="consolidate-destination"
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

          <p className="text-xs text-te-grey-500 font-te-mono">{CLASH_NOTE}</p>

          {/* Preview */}
          {preview && phase === 'previewed' && (
            <div className="bg-te-grey-100 rounded-te p-te-sm text-sm font-te-mono space-y-1">
              <div className="font-semibold text-te-grey-700">Preview</div>
              <div>{preview.total} tracks — {formatFileSize(preview.totalSizeBytes)}</div>
              {preview.conflicts > 0 && (
                <div className="text-amber-600">{preview.conflicts} already at the destination — reused if identical, otherwise saved as &quot;(2)&quot;</div>
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
              <ProgressBar
                label={mode === 'copy' ? 'Copying files' : 'Moving files'}
                value={progress.current}
                max={progress.total}
                unit="files"
              />
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
              {result.backupPath && (
                <div className="text-xs text-te-grey-500">
                  {result.entriesUpdated ?? 0} library entr{result.entriesUpdated === 1 ? 'y' : 'ies'} updated. A backup was saved first.
                </div>
              )}
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
  );
};
