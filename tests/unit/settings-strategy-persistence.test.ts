import { describe, it, expect, beforeEach } from 'vitest';

describe('resolution strategy persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.localStorage.removeItem('rekordbox-settings');
  });

  it('writes the chosen strategy into localStorage', async () => {
    const { useSettingsStore } = await import('../../src/renderer/stores/settingsStore');
    useSettingsStore.getState().setResolutionStrategy('keep-preferred-path');
    const raw = localStorage.getItem('rekordbox-settings');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.resolutionStrategy).toBe('keep-preferred-path');
  });

  it('restores the strategy when the store is rehydrated', async () => {
    localStorage.setItem('rekordbox-settings', JSON.stringify({
      state: { resolutionStrategy: 'keep-preferred-path' },
      version: 1,
    }));
    const { useSettingsStore } = await import('../../src/renderer/stores/settingsStore');
    await (useSettingsStore.persist as any)?.rehydrate?.();
    expect(useSettingsStore.getState().resolutionStrategy).toBe('keep-preferred-path');
  });
});
