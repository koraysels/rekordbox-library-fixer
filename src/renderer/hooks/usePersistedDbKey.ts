import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { looksLikeDbKey } from '../utils/keyExtractionCommand';

/**
 * Keeps the pasted database key in a file the main process owns as well as in
 * the settings store. Browser storage can come back empty, and then the load
 * screen asked for the key all over again; the file refills it.
 */
export function usePersistedDbKey(): void {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getSavedDbKey) { return; }

    if (!useSettingsStore.getState().rekordboxDbKey.trim()) {
      void api.getSavedDbKey().then((saved) => {
        if (saved && !useSettingsStore.getState().rekordboxDbKey.trim()) {
          useSettingsStore.getState().setRekordboxDbKey(saved);
        }
      }).catch(() => undefined);
    }

    let last = useSettingsStore.getState().rekordboxDbKey;
    if (looksLikeDbKey(last)) { void api.saveDbKey(last).catch(() => undefined); }
    return useSettingsStore.subscribe((state) => {
      if (state.rekordboxDbKey === last) { return; }
      last = state.rekordboxDbKey;
      if (looksLikeDbKey(last)) { void api.saveDbKey(last).catch(() => undefined); }
    });
  }, []);
}
