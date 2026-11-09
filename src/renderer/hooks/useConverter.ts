import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { duplicationHistoryStorage } from '../db/duplicationHistoryDb';
import { applyConversionSwitches, switchedItems } from '../convert/switchedItems';
import { buildConversionEntry } from '../convert/conversionHistory';
import { candidateKey, filterByReason, groupByReason, isConvertible } from '../convert/reasons';
import type { LibraryData, ShowNotification } from '../types';
import type {
  ConvertCandidate, ConvertPreviewItem, ConvertProgress, ConvertRunResult, FfmpegStatus,
  PlayerProfileId, TargetFormat,
} from '../../main/ipcContract';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isDatabase = (libraryPath: string) => /\.db$/i.test(libraryPath);

interface Options {
  libraryData: LibraryData | null;
  libraryPath: string;
  showNotification: ShowNotification;
  setLibraryData: (data: LibraryData) => void;
}

/** State and bridge calls for the Convert page; what a run means lives in `../convert`. */
export function useConverter({ libraryData, libraryPath, showNotification, setLibraryData }: Options) {
  const oldestPlayer = useSettingsStore((s) => s.oldestPlayer);
  // Starts from the setting; changing it here is for this look only.
  const [profileId, setProfileId] = useState<PlayerProfileId>(oldestPlayer);
  const [target, setTarget] = useState<TargetFormat>('aiff');
  const [trashOriginals, setTrashOriginals] = useState(false);
  const [candidates, setCandidates] = useState<ConvertCandidate[]>([]);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reasonFilter, setReasonFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<ConvertPreviewItem[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [ffmpeg, setFfmpeg] = useState<FfmpegStatus | null>(null);
  const [installPercent, setInstallPercent] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState<ConvertProgress | null>(null);
  const [result, setResult] = useState<ConvertRunResult | null>(null);
  // Counts runs, so per-run UI state (the progress dialog's "Cancelling…") starts fresh each time.
  const [runNumber, setRunNumber] = useState(0);
  const operationId = useRef<string | null>(null);
  const previewToken = useRef(0);
  const live = useRef({ libraryData, setLibraryData });
  live.current = { libraryData, setLibraryData };

  const database = isDatabase(libraryPath);

  useEffect(() => {
    let cancelled = false;
    void window.electronAPI.getFfmpegStatus().then((s) => { if (!cancelled) { setFfmpeg(s); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => window.electronAPI.onConversionProgress((p) => setProgress(p)), []);

  // A different look at the library, target or player is a different run: preview again.
  const invalidate = () => { previewToken.current++; setPreview(null); setPreviewing(false); };

  const visible = useMemo(() => filterByReason(candidates, reasonFilter), [candidates, reasonFilter]);
  const reasons = useMemo(() => groupByReason(candidates), [candidates]);
  const selectedCandidates = useMemo(
    () => candidates.filter((c) => isConvertible(c) && selected.has(candidateKey(c))),
    [candidates, selected]
  );

  const scan = useCallback(async () => {
    if (!libraryData) { return; }
    setScanning(true);
    setResult(null);
    invalidate();
    try {
      const res = await window.electronAPI.findUnplayable({
        tracks: Array.from(libraryData.tracks.values()),
        profileId,
      });
      if (!res.success || !res.data) {
        showNotification('error', `Could not check the library: ${res.error ?? 'unknown error'}`);
        return;
      }
      setCandidates(res.data);
      setSelected(new Set());
      setReasonFilter('');
      setScanned(true);
    } catch (e) {
      showNotification('error', `Could not check the library: ${errorMessage(e)}`);
    } finally {
      setScanning(false);
    }
  }, [libraryData, profileId, showNotification]);

  const toggle = (c: ConvertCandidate) => {
    if (!isConvertible(c)) { return; }
    invalidate();
    setSelected((prev) => {
      const next = new Set(prev);
      const key = candidateKey(c);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const selectAllVisible = () => {
    invalidate();
    setSelected((prev) => new Set([...prev, ...visible.filter(isConvertible).map(candidateKey)]));
  };
  const clearSelection = () => { invalidate(); setSelected(new Set()); };

  const chooseTarget = (t: TargetFormat) => { invalidate(); setTarget(t); };
  const chooseProfile = (id: PlayerProfileId) => { invalidate(); setProfileId(id); };

  const runPreview = useCallback(async () => {
    if (selectedCandidates.length === 0) { return; }
    const token = ++previewToken.current;
    setPreviewing(true);
    try {
      const res = await window.electronAPI.previewConversion({ candidates: selectedCandidates, profileId, target });
      // The inputs changed while this was running: its answer is about something else now.
      if (token !== previewToken.current) { return; }
      if (!res.success || !res.data) {
        showNotification('error', `Could not preview: ${res.error ?? 'unknown error'}`);
        return;
      }
      setPreview(res.data);
    } catch (e) {
      if (token === previewToken.current) { showNotification('error', `Could not preview: ${errorMessage(e)}`); }
    } finally {
      if (token === previewToken.current) { setPreviewing(false); }
    }
  }, [selectedCandidates, profileId, target, showNotification]);

  const finish = useCallback(async (items: ConvertPreviewItem[], outcome: ConvertRunResult) => {
    const names: Record<string, string> = {};
    for (const c of candidates) { names[c.location] = [c.artist, c.name].filter(Boolean).join(' - '); }
    void duplicationHistoryStorage.record(buildConversionEntry({ libraryPath, items, result: outcome, names }));

    const switched = switchedItems(items, outcome);
    const current = live.current.libraryData;
    if (current && switched.length > 0) {
      live.current.setLibraryData(applyConversionSwitches(current, switched));
      const gone = new Set(switched.map((i) => i.from));
      setCandidates((prev) => prev.filter((c) => !gone.has(c.location)));
      setSelected((prev) => new Set([...prev].filter((k) => !gone.has(k))));
    }
    setPreview(null);
    setResult(outcome);
    if (outcome.error) {
      showNotification('error', `Nothing was changed in the library: ${outcome.error}`, { important: true });
    } else {
      showNotification(
        outcome.failed.length ? 'warning' : 'success',
        `${outcome.cancelled ? 'Cancelled — ' : ''}Converted ${outcome.switched} entr${outcome.switched === 1 ? 'y' : 'ies'}`
        + (outcome.failed.length ? `, ${outcome.failed.length} failed` : ''),
        { important: true }
      );
    }
  }, [candidates, libraryPath, showNotification]);

  const run = useCallback(async () => {
    if (!preview || running) { return; }
    const items = preview;
    setRunNumber((n) => n + 1);
    setRunning(true);
    setShowProgress(true);
    setProgress(null);
    setResult(null);
    let stop: (() => void) | undefined;
    try {
      // The only place ffmpeg is fetched: after the DJ clicked the button that says so.
      if (ffmpeg?.state === 'missing') {
        setInstallPercent(0);
        stop = window.electronAPI.onFfmpegInstallProgress((p) => setInstallPercent(p.percent));
        const installed = await window.electronAPI.installFfmpeg();
        stop();
        stop = undefined;
        setInstallPercent(null);
        if (!installed.success) {
          showNotification('error', `Could not download ffmpeg: ${installed.error ?? 'unknown error'}`);
          return;
        }
        setFfmpeg({ state: 'ready', path: installed.data?.path ?? '' });
      }
      const id = `convert-${Date.now()}`;
      operationId.current = id;
      const res = await window.electronAPI.runConversion({
        operationId: id,
        libraryPath,
        dbKey: database ? useSettingsStore.getState().rekordboxDbKey : undefined,
        profileId,
        target,
        trashOriginals: database && trashOriginals,
        items,
      });
      if (!res.success || !res.data) {
        showNotification('error', `Conversion failed: ${res.error ?? 'unknown error'}`, { important: true });
        return;
      }
      await finish(items, res.data);
    } catch (e) {
      showNotification('error', `Conversion failed: ${errorMessage(e)}`, { important: true });
    } finally {
      stop?.();
      setInstallPercent(null);
      operationId.current = null;
      setRunning(false);
    }
  }, [preview, running, ffmpeg, libraryPath, database, profileId, target, trashOriginals, finish, showNotification]);

  const cancel = useCallback(async () => {
    if (operationId.current) { await window.electronAPI.cancelConversion(operationId.current); }
  }, []);

  return {
    database, profileId, chooseProfile, target, chooseTarget, trashOriginals, setTrashOriginals,
    candidates, visible, reasons, scanned, scanning, scan,
    reasonFilter, setReasonFilter, selected, selectedCandidates, toggle, selectAllVisible, clearSelection,
    preview, previewing, runPreview, ffmpeg, installPercent,
    running, runNumber, showProgress, setShowProgress, progress, result, dismissResult: () => setResult(null),
    run, cancel,
  };
}
