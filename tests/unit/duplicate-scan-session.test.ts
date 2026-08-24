import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startDuplicateScan, cancelDuplicateScan, getScanSnapshot,
  subscribeScan, consumeScanResult, resetScanSession,
} from '../../src/renderer/scan/duplicateScanSession';

/** Hold the streaming callbacks so a test can drive the scan by hand. */
let onSet: (payload: any) => void;
let onProgress: (payload: any) => void;
let finish: (response: any) => void;
let stoppedSets: boolean;
let stoppedProgress: boolean;

beforeEach(() => {
  resetScanSession();
  stoppedSets = false;
  stoppedProgress = false;
  const api = (window as any).electronAPI;
  api.onDuplicateScanSet = vi.fn((cb: any) => { onSet = cb; return () => { stoppedSets = true; }; });
  api.onDuplicateScanProgress = vi.fn((cb: any) => { onProgress = cb; return () => { stoppedProgress = true; }; });
  api.findDuplicates = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  api.cancelDuplicateScan = vi.fn(async () => ({ success: true }));
});

const scan = () => startDuplicateScan({
  libraryPath: '/lib.xml',
  tracks: [{ id: '1' }, { id: '2' }],
  scanOptions: { pathPreferences: ['/music'] },
});

describe('duplicate scan session', () => {
  it('marks itself as scanning while the main process works', async () => {
    const running = scan();
    expect(getScanSnapshot().scanning).toBe(true);
    finish({ success: true, data: [] });
    await running;
    expect(getScanSnapshot().scanning).toBe(false);
  });

  it('keeps streamed sets outside the component', async () => {
    // The page unmounts on a tab switch; the sets must survive it.
    const running = scan();
    onSet({ set: { id: 'a', tracks: [] } });
    onSet({ set: { id: 'b', tracks: [] } });
    expect(getScanSnapshot().sets.map((s: any) => s.id)).toEqual(['a', 'b']);
    finish({ success: true, data: [] });
    await running;
  });

  it('replaces a set that grew rather than listing it twice', async () => {
    const running = scan();
    onSet({ set: { id: 'a', tracks: [1] } });
    onSet({ set: { id: 'a', tracks: [1, 2] } });
    expect(getScanSnapshot().sets).toHaveLength(1);
    expect(getScanSnapshot().sets[0].tracks).toHaveLength(2);
    finish({ success: true, data: [] });
    await running;
  });

  it('tells subscribers about progress', async () => {
    const seen: any[] = [];
    const stop = subscribeScan(() => seen.push(getScanSnapshot().progress));
    const running = scan();
    onProgress({ type: 'progress', current: 1, total: 2, setsFound: 0, operationId: 'op1' });
    expect(seen.at(-1)).toMatchObject({ current: 1, total: 2 });
    stop();
    finish({ success: true, data: [] });
    await running;
  });

  it('holds the result for a page that was on another tab', async () => {
    const running = scan();
    finish({ success: true, data: [{ id: 'a' }] });
    await running;
    const pending = consumeScanResult();
    expect(pending?.duplicates).toHaveLength(1);
    // Only handed out once, so it cannot be applied twice.
    expect(consumeScanResult()).toBeNull();
  });

  it('stamps the path preferences onto the result', async () => {
    const running = scan();
    finish({ success: true, data: [{ id: 'a' }] });
    const result = await running;
    expect(result.duplicates[0].pathPreferences).toEqual(['/music']);
  });

  it('reports a cancelled scan as cancelled, keeping what it found', async () => {
    const running = scan();
    finish({ success: true, data: [{ id: 'a' }], cancelled: true });
    const result = await running;
    expect(result.cancelled).toBe(true);
    expect(result.duplicates).toHaveLength(1);
  });

  it('passes the failure through instead of an empty success', async () => {
    const running = scan();
    finish({ success: false, error: 'disk on fire' });
    const result = await running;
    expect(result.error).toBe('disk on fire');
  });

  it('unsubscribes from the streams when the scan ends', async () => {
    const running = scan();
    finish({ success: true, data: [] });
    await running;
    expect(stoppedSets).toBe(true);
    expect(stoppedProgress).toBe(true);
  });

  it('refuses to start a second scan on top of a running one', async () => {
    const running = scan();
    onSet({ set: { id: 'a', tracks: [] } });
    await scan();
    expect((window as any).electronAPI.findDuplicates).toHaveBeenCalledTimes(1);
    finish({ success: true, data: [] });
    await running;
  });

  it('cancels through the operation id the main process reported', async () => {
    const running = scan();
    onProgress({ type: 'start', current: 0, total: 2, setsFound: 0, operationId: 'op7' });
    expect(await cancelDuplicateScan()).toBe(true);
    expect((window as any).electronAPI.cancelDuplicateScan).toHaveBeenCalledWith('op7');
    finish({ success: true, data: [] });
    await running;
  });

  it('cannot cancel when no scan is running', async () => {
    expect(await cancelDuplicateScan()).toBe(false);
  });
});
