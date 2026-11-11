import { describe, it, expect, beforeEach, vi } from 'vitest';

async function freshStore() {
  vi.resetModules();
  const mod = await import('@renderer/stores/settingsStore');
  return mod.useSettingsStore;
}

describe('wizard settings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('default to no music folder and the wizard', async () => {
    const store = await freshStore();
    expect(store.getState().musicFolder).toBe('');
    expect(store.getState().appMode).toBe('wizard');
  });

  it('setters update and persist', async () => {
    const store = await freshStore();
    store.getState().setMusicFolder('/Users/dj/Music/Library');
    store.getState().setAppMode('advanced');
    expect(store.getState().musicFolder).toBe('/Users/dj/Music/Library');
    expect(store.getState().appMode).toBe('advanced');
    const stored = JSON.parse(localStorage.getItem('rekordbox-settings') ?? '{}');
    expect(stored.state.musicFolder).toBe('/Users/dj/Music/Library');
    expect(stored.state.appMode).toBe('advanced');
  });

  it('an older saved state without these fields rehydrates with the defaults', async () => {
    localStorage.setItem('rekordbox-settings', JSON.stringify({
      state: { rekordboxDbKey: 'ab'.repeat(32), oldestPlayer: 'cdj2000' },
      version: 1,
    }));
    const store = await freshStore();
    await store.persist.rehydrate();
    expect(store.getState().rekordboxDbKey).toBe('ab'.repeat(32));
    expect(store.getState().musicFolder).toBe('');
    expect(store.getState().appMode).toBe('wizard');
  });
});
