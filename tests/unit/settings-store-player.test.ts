import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@renderer/stores/settingsStore';

describe('oldestPlayer', () => {
  beforeEach(() => { localStorage.clear(); });

  it('oldestPlayer persists and defaults to cdj2000', async () => {
    expect(useSettingsStore.getState().oldestPlayer).toBe('cdj2000');
    useSettingsStore.getState().setOldestPlayer('cdj2000');
    const stored = JSON.parse(localStorage.getItem('rekordbox-settings') ?? '{}');
    expect(stored.state.oldestPlayer).toBe('cdj2000');
  });
});
