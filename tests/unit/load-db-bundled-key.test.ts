import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useLibrary } from '../../src/renderer/hooks/useLibrary';
import { useSettingsStore } from '../../src/renderer/stores/settingsStore';

const OLD = 'ab'.repeat(32);
const BUNDLED = 'cd'.repeat(32);
const library = { libraryPath: '/rb/master.db', tracks: new Map(), playlists: [] };

const api = () => window.electronAPI as unknown as {
  parseRekordboxDb: ReturnType<typeof vi.fn>;
  getBundledDbKey: ReturnType<typeof vi.fn>;
};

/** A database that opens only with `works`. */
const opensWith = (works: string) => vi.fn(async ({ key }: { key: string }) => (
  key === works ? { success: true, data: library } : { success: false, error: 'file is not a database' }
));

async function load(dbPath = '/rb/master.db') {
  const notify = vi.fn();
  const { result } = renderHook(() => useLibrary(notify));
  await waitFor(() => expect(result.current.startupComplete).toBe(true));
  let opened: boolean | undefined;
  await act(async () => { opened = await result.current.loadFromDb(dbPath); });
  return { opened, result, notify };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.assign(window.electronAPI, { getBundledDbKey: vi.fn(async () => BUNDLED) });
});

describe('opening the database with the bundled key', () => {
  it('tries the bundled key once when the saved one no longer opens the database', async () => {
    // An older release's bundled key, kept in settings; a rekordbox update changed it.
    useSettingsStore.setState({ rekordboxDbKey: OLD });
    Object.assign(window.electronAPI, { parseRekordboxDb: opensWith(BUNDLED) });
    const { opened, result } = await load();

    expect(opened).toBe(true);
    expect(result.current.libraryData).not.toBeNull();
    expect(api().parseRekordboxDb.mock.calls.map(([a]) => a.key)).toEqual([OLD, BUNDLED]);
    // Writes use the key in settings: it is now the one that worked.
    expect(useSettingsStore.getState().rekordboxDbKey).toBe(BUNDLED);
  });

  it('does not retry with the same key, and reports the failure', async () => {
    useSettingsStore.setState({ rekordboxDbKey: BUNDLED });
    Object.assign(window.electronAPI, { parseRekordboxDb: opensWith('ef'.repeat(32)) });
    const { opened, notify } = await load();

    expect(opened).toBe(false);
    expect(api().parseRekordboxDb).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('error', 'file is not a database');
  });

  it('keeps a pasted key that works, without asking for the bundled one to be tried', async () => {
    useSettingsStore.setState({ rekordboxDbKey: OLD });
    Object.assign(window.electronAPI, { parseRekordboxDb: opensWith(OLD) });
    const { opened } = await load();

    expect(opened).toBe(true);
    expect(api().parseRekordboxDb).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().rekordboxDbKey).toBe(OLD);
  });

  it('uses the bundled key when settings hold none', async () => {
    useSettingsStore.setState({ rekordboxDbKey: '' });
    Object.assign(window.electronAPI, { parseRekordboxDb: opensWith(BUNDLED) });
    const { opened } = await load();

    expect(opened).toBe(true);
    expect(useSettingsStore.getState().rekordboxDbKey).toBe(BUNDLED);
  });

  it('asks for a key when there is neither', async () => {
    useSettingsStore.setState({ rekordboxDbKey: '' });
    Object.assign(window.electronAPI, {
      getBundledDbKey: vi.fn(async () => ''),
      parseRekordboxDb: opensWith(BUNDLED),
    });
    const { opened, notify } = await load();

    expect(opened).toBe(false);
    expect(api().parseRekordboxDb).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('error', expect.stringMatching(/needs its key/));
  });
});
