import { upsertDuplicateSet } from '../utils/upsertDuplicateSet';

export interface ScanProgress {
  current: number;
  total: number;
  trackName?: string;
  setsFound: number;
}

export interface ScanResult {
  duplicates: any[];
  cancelled: boolean;
  error?: string;
}

export interface ScanSnapshot {
  scanning: boolean;
  libraryPath: string;
  progress: ScanProgress | null;
  /** Sets streamed so far, kept even while no component is mounted. */
  sets: any[];
  operationId: string | null;
  /** A finished scan waiting to be picked up by whoever mounts next. */
  result: ScanResult | null;
}

const EMPTY: ScanSnapshot = {
  scanning: false, libraryPath: '', progress: null, sets: [], operationId: null, result: null,
};

/**
 * The duplicate scan lives here rather than inside the Duplicate Detection
 * page, because switching tabs unmounts that page. The scan itself always ran
 * on in the main process, but every streamed result and the progress went with
 * the component, so coming back showed nothing and the scan looked interrupted.
 *
 * Module state survives navigation: the page subscribes on mount and picks up
 * whatever happened while it was away, including a scan that finished.
 */
let state: ScanSnapshot = EMPTY;
const listeners = new Set<() => void>();

const emit = (next: Partial<ScanSnapshot>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export const subscribeScan = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const getScanSnapshot = (): ScanSnapshot => state;

/** The page applies a finished scan once, then clears it. */
export const consumeScanResult = (): ScanResult | null => {
  const { result } = state;
  if (result) { emit({ result: null }); }
  return result;
};

export const resetScanSession = (): void => { emit({ ...EMPTY }); };

export async function startDuplicateScan(args: {
  libraryPath: string;
  tracks: any[];
  scanOptions: any;
}): Promise<ScanResult> {
  if (state.scanning) { return { duplicates: state.sets, cancelled: false }; }

  emit({
    scanning: true,
    libraryPath: args.libraryPath,
    progress: { current: 0, total: args.tracks.length, setsFound: 0 },
    sets: [],
    operationId: null,
    result: null,
  });

  // Sets stream in while the main process scans; each one is upserted so a
  // growing set replaces its earlier version instead of appearing twice.
  const stopSets = window.electronAPI.onDuplicateScanSet(({ set }: any) => {
    emit({
      sets: upsertDuplicateSet(state.sets, {
        ...set,
        pathPreferences: args.scanOptions.pathPreferences,
      }),
    });
  });
  const stopProgress = window.electronAPI.onDuplicateScanProgress((p: any) => {
    if (p.operationId) { emit({ operationId: p.operationId }); }
    if (p.type === 'progress' || p.type === 'start') {
      emit({
        progress: {
          current: p.current, total: p.total, trackName: p.trackName, setsFound: p.setsFound,
        },
      });
    }
  });

  try {
    const response = await window.electronAPI.findDuplicates({
      tracks: args.tracks,
      ...args.scanOptions,
    });

    const result: ScanResult = response.success
      ? {
        duplicates: (response.data ?? []).map((duplicate: any) => ({
          ...duplicate,
          pathPreferences: args.scanOptions.pathPreferences,
        })),
        cancelled: !!response.cancelled,
      }
      : { duplicates: [], cancelled: false, error: response.error || 'Scan failed' };

    emit({ result });
    return result;
  } catch {
    const result: ScanResult = { duplicates: [], cancelled: false, error: 'Failed to scan for duplicates' };
    emit({ result });
    return result;
  } finally {
    stopSets();
    stopProgress();
    emit({ scanning: false, progress: null, operationId: null });
  }
}

export async function cancelDuplicateScan(): Promise<boolean> {
  const id = state.operationId;
  if (!id) { return false; }
  try {
    await window.electronAPI.cancelDuplicateScan(id);
    return true;
  } catch {
    return false;
  }
}
