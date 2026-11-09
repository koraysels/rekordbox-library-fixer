import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ConvertPanel } from '../../src/renderer/components/convert/ConvertPanel';
import { useSettingsStore } from '../../src/renderer/stores/settingsStore';

const candidate = {
  trackIds: ['1'], location: '/m/a.flac', name: 'Song', artist: 'Artist',
  reasons: [{ kind: 'format', format: 'flac' }], facts: { format: 'flac' },
};
const gone = {
  trackIds: ['2'], location: '/m/gone.flac', name: 'Gone', artist: 'Nobody',
  reasons: [{ kind: 'format', format: 'flac' }], facts: null, unreachable: true,
};
const broken = {
  trackIds: ['3'], location: '/m/broken.flac', name: 'Broken', artist: 'Someone',
  reasons: [{ kind: 'format', format: 'flac' }], facts: null, unreadable: true,
};
const previewItem = {
  trackIds: ['1'], from: '/m/a.flac', to: '/m/a.aif', readiness: 'new',
  out: { format: 'aiff', sampleRate: 44100, bitDepth: 16, bitrateKbps: 1411 },
};
const library = () => ({
  libraryPath: '', playlists: [],
  tracks: new Map<string, any>([['1', { id: '1', name: 'Song', artist: 'Artist', location: '/m/a.flac' }]]),
});

let api: any;
beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ oldestPlayer: 'cdj2000', rekordboxDbKey: 'k'.repeat(64) });
  api = (window as any).electronAPI;
  Object.assign(api, {
    findUnplayable: vi.fn(async () => ({ success: true, data: [candidate, gone] })),
    previewConversion: vi.fn(async () => ({ success: true, data: [previewItem] })),
    getFfmpegStatus: vi.fn(async () => ({ state: 'ready', path: '/ff' })),
    installFfmpeg: vi.fn(async () => ({ success: true, data: { path: '/ff' } })),
    onFfmpegInstallProgress: vi.fn(() => () => undefined),
    runConversion: vi.fn(async () => ({
      success: true,
      data: { switched: 1, switchedItems: [{ trackIds: ['1'], from: '/m/a.flac', to: '/m/a.aif' }], failed: [], conflicts: [], trashed: 0, cancelled: false },
    })),
    cancelConversion: vi.fn(async () => ({ success: true })),
    onConversionProgress: vi.fn(() => () => undefined),
  });
});

function setup(libraryPath = '/x/master.db') {
  const lib = { ...library(), libraryPath };
  const setLibraryData = vi.fn();
  const onOpenRelocation = vi.fn();
  render(
    <ConvertPanel
      libraryData={lib} libraryPath={libraryPath} showNotification={vi.fn()}
      setLibraryData={setLibraryData} onOpenRelocation={onOpenRelocation}
    />
  );
  return { setLibraryData, onOpenRelocation, user: userEvent.setup() };
}

async function scanSelectPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /scan/i }));
  await screen.findByText('Song');
  await user.click(screen.getByRole('button', { name: /select all/i }));
  await user.click(screen.getByRole('button', { name: /preview/i }));
  await screen.findByText('/m/a.aif');
}

describe('ConvertPanel', () => {
  it('starts from the oldest-player setting and does not change it', async () => {
    const setOldestPlayer = vi.fn();
    useSettingsStore.setState({ setOldestPlayer });
    const { user } = setup();
    const select = screen.getByLabelText('Player') as HTMLSelectElement;
    expect(select.value).toBe('cdj2000');
    await user.click(screen.getByRole('button', { name: /scan/i }));
    await screen.findByText('Song');
    expect(api.findUnplayable).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'cdj2000' }));
    await user.selectOptions(select, 'cdj2000');
    expect(setOldestPlayer).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().oldestPlayer).toBe('cdj2000');
  });

  it('lists reasons in words and disables files that are not reachable', async () => {
    const { user, onOpenRelocation } = setup();
    await user.click(screen.getByRole('button', { name: /scan/i }));
    await screen.findByText('Song');
    expect(screen.getAllByText("FLAC isn't supported").length).toBeGreaterThan(0);
    expect(screen.getByText(/file not reachable/)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Gone/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Track Relocation/ }));
    expect(onOpenRelocation).toHaveBeenCalled();
  });

  it("says a file that is there but can't be parsed couldn't be read, not that it is unreachable", async () => {
    api.findUnplayable = vi.fn(async () => ({ success: true, data: [candidate, broken] }));
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /scan/i }));
    await screen.findByText('Broken');
    expect(screen.getByText(/couldn't read the file/)).toBeTruthy();
    expect(screen.queryByText(/file not reachable/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Broken/ })).toBeDisabled();
  });

  it('shows the MP3 warning only for MP3', async () => {
    const { user } = setup();
    const warning = 'MP3 is lossy, and its encoder delay can move cues by a few milliseconds.';
    expect(screen.queryByText(warning)).toBeNull();
    await user.click(screen.getByLabelText('MP3'));
    expect(screen.getByText(warning)).toBeTruthy();
    await user.click(screen.getByLabelText('AIFF'));
    expect(screen.queryByText(warning)).toBeNull();
  });

  it('hides the trash option and shows the notice for an XML library', () => {
    setup('/x/collection.xml');
    expect(screen.queryByLabelText('Move originals to Trash after switching')).toBeNull();
    expect(screen.getByText(/adds the converted files as new tracks without cues/)).toBeTruthy();
  });

  it('offers the trash option for a database library', () => {
    setup('/x/master.db');
    expect(screen.getByLabelText('Move originals to Trash after switching')).toBeTruthy();
    expect(screen.queryByText(/adds the converted files as new tracks/)).toBeNull();
  });

  it('keeps Convert disabled until there is a preview', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /scan/i }));
    await screen.findByText('Song');
    await user.click(screen.getByRole('button', { name: /select all/i }));
    expect(screen.queryByRole('button', { name: /^Convert 1 track/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /preview/i }));
    await screen.findByText('/m/a.aif');
    expect(screen.getByRole('button', { name: 'Convert 1 track' })).toBeEnabled();
  });

  it('asks before downloading ffmpeg', async () => {
    api.getFfmpegStatus = vi.fn(async () => ({ state: 'missing', sizeBytes: 31 * 1024 * 1024 }));
    const { user } = setup();
    await scanSelectPreview(user);
    const button = await screen.findByRole('button', { name: 'Download ffmpeg (31 MB) and convert' });
    expect(api.installFfmpeg).not.toHaveBeenCalled();
    expect(api.runConversion).not.toHaveBeenCalled();
    await user.click(button);
    await waitFor(() => expect(api.installFfmpeg).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.runConversion).toHaveBeenCalledTimes(1));
  });

  it('shows the USB sync line after a run', async () => {
    const { user, setLibraryData } = setup();
    await scanSelectPreview(user);
    await user.click(screen.getByRole('button', { name: 'Convert 1 track' }));
    await screen.findByText('Sync your USB from rekordbox so your sticks get the converted files.');
    const call = api.runConversion.mock.calls[0][0];
    expect(call).toMatchObject({ libraryPath: '/x/master.db', dbKey: 'k'.repeat(64), target: 'aiff', trashOriginals: false });
    expect(setLibraryData).toHaveBeenCalled();
    expect(within(screen.getByTestId('convert-summary')).getByText(/1 switched/)).toBeTruthy();
  });

  it('never sends trashOriginals for an XML library, even if it was ticked on a database one', async () => {
    const lib = library();
    const props = { libraryData: lib, showNotification: vi.fn(), setLibraryData: vi.fn() };
    const user = userEvent.setup();
    const { rerender } = render(<ConvertPanel {...props} libraryPath="/x/master.db" />);
    await user.click(screen.getByLabelText('Move originals to Trash after switching'));
    rerender(<ConvertPanel {...props} libraryPath="/x/collection.xml" />);
    await scanSelectPreview(user);
    await user.click(screen.getByRole('button', { name: 'Convert 1 track' }));
    await waitFor(() => expect(api.runConversion).toHaveBeenCalled());
    expect(api.runConversion.mock.calls[0][0]).toMatchObject({ libraryPath: '/x/collection.xml', trashOriginals: false });
    expect(api.runConversion.mock.calls[0][0].dbKey).toBeUndefined();
  });

  it('ignores a preview that lands after the target changed', async () => {
    let resolve: (v: any) => void = () => undefined;
    api.previewConversion = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /scan/i }));
    await screen.findByText('Song');
    await user.click(screen.getByRole('button', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /preview/i }));
    await user.click(screen.getByLabelText('WAV'));
    resolve({ success: true, data: [previewItem] });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('/m/a.aif')).toBeNull();
    expect(screen.getByRole('button', { name: /^Convert \d/ })).toBeDisabled();
  });

  it('Cancel works again on the next run after a cancelled one', async () => {
    const pending: Array<(v: any) => void> = [];
    api.runConversion = vi.fn(() => new Promise((r) => { pending.push(r); }));
    const { user } = setup();
    await scanSelectPreview(user);
    await user.click(screen.getByRole('button', { name: 'Convert 1 track' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(within(dialog).getByRole('button', { name: /Cancelling/ })).toBeDisabled();
    pending[0]({ success: true, data: { switched: 0, switchedItems: [], failed: [], conflicts: [], trashed: 0, cancelled: true } });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: /preview/i }));
    await screen.findByText('/m/a.aif');
    await user.click(screen.getByRole('button', { name: 'Convert 1 track' }));
    const again = await screen.findByRole('dialog');
    expect(within(again).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await user.click(within(again).getByRole('button', { name: 'Cancel' }));
    expect(api.cancelConversion).toHaveBeenCalledTimes(2);
    pending[1]({ success: true, data: { switched: 0, switchedItems: [], failed: [], conflicts: [], trashed: 0, cancelled: true } });
  });

  it('shows an error and stays usable when the run rejects', async () => {
    api.runConversion = vi.fn(async () => { throw new Error('a conversion is already running'); });
    const showNotification = vi.fn();
    const user = userEvent.setup();
    render(<ConvertPanel libraryData={library()} libraryPath="/x/master.db" showNotification={showNotification} setLibraryData={vi.fn()} />);
    await scanSelectPreview(user);
    await user.click(screen.getByRole('button', { name: 'Convert 1 track' }));
    await waitFor(() => expect(showNotification).toHaveBeenCalledWith(
      'error', expect.stringContaining('a conversion is already running'), expect.anything()
    ));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Convert 1 track' })).toBeEnabled();
  });
});
