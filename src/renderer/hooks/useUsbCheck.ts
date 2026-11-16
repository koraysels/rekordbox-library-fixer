import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { pickStick } from '../usb/usbReport';
import type { UsbCheckResult, UsbStick } from '../../main/ipcContract';

/** The stick checked last, so coming back to the page (or rescanning) keeps it when several are plugged in. */
let lastStickRoot: string | null = null;

/**
 * Finds the plugged-in sticks and checks the chosen one against the library
 * database. Read-only on both sides. A check that finishes after the DJ picked
 * another stick is dropped, so a slow stick cannot overwrite a newer result.
 */
export function useUsbCheck(libraryPath: string, enabled: boolean) {
  const [sticks, setSticks] = useState<UsbStick[] | null>(null);
  const [stick, setStick] = useState<UsbStick | null>(null);
  const [result, setResult] = useState<UsbCheckResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);

  const check = useCallback(async (target: UsbStick) => {
    const id = ++run.current;
    lastStickRoot = target.root;
    setStick(target);
    setResult(null);
    setError(null);
    setChecking(true);
    try {
      const res = await window.electronAPI.usbCheckStick({
        stickRoot: target.root,
        dbPath: libraryPath,
        key: useSettingsStore.getState().rekordboxDbKey,
      });
      if (id !== run.current) {return;}
      if (res.success && res.data) {setResult(res.data);} else {setError(res.error ?? 'The stick could not be read.');}
    } catch (e) {
      if (id === run.current) {setError(e instanceof Error ? e.message : String(e));}
    } finally {
      if (id === run.current) {setChecking(false);}
    }
  }, [libraryPath]);

  const rescan = useCallback(async () => {
    ++run.current;
    setSearching(true);
    setChecking(false);
    setError(null);
    setResult(null);
    try {
      const res = await window.electronAPI.usbFindSticks();
      const found = res.success && res.data ? res.data : [];
      if (!res.success) {setError(res.error ?? 'Looking for sticks failed.');}
      setSticks(found);
      const chosen = pickStick(found, lastStickRoot);
      setStick(chosen);
      if (chosen) {void check(chosen);}
    } catch (e) {
      setSticks([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }, [check]);

  useEffect(() => {
    if (enabled) {void rescan();}
  }, [enabled, rescan]);

  return { sticks, stick, result, searching, checking, error, rescan, choose: check };
}
