import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePersistedDbKey } from '../../src/renderer/hooks/usePersistedDbKey';
import { useSettingsStore } from '../../src/renderer/stores/settingsStore';

const KEY = 'cd'.repeat(32);

beforeEach(() => {
  useSettingsStore.setState({ rekordboxDbKey: '' });
  Object.assign((window as any).electronAPI, {
    getSavedDbKey: vi.fn(async () => KEY),
    saveDbKey: vi.fn(async () => ({ success: true })),
  });
});

describe('usePersistedDbKey', () => {
  it('refills an empty store from the saved copy', async () => {
    // Browser storage came back empty and the load screen asked again.
    renderHook(() => usePersistedDbKey());
    await waitFor(() => expect(useSettingsStore.getState().rekordboxDbKey).toBe(KEY));
  });

  it('saves a key as soon as one is pasted', async () => {
    (window as any).electronAPI.getSavedDbKey = vi.fn(async () => '');
    renderHook(() => usePersistedDbKey());
    act(() => useSettingsStore.getState().setRekordboxDbKey('ef'.repeat(32)));
    expect((window as any).electronAPI.saveDbKey).toHaveBeenCalledWith('ef'.repeat(32));
  });

  it('does not save a half-pasted key', () => {
    (window as any).electronAPI.getSavedDbKey = vi.fn(async () => '');
    renderHook(() => usePersistedDbKey());
    act(() => useSettingsStore.getState().setRekordboxDbKey('402fd4'));
    expect((window as any).electronAPI.saveDbKey).not.toHaveBeenCalled();
  });
});
