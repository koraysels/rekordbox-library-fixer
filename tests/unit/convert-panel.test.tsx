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
      data: { switched: 1, failed: [], conflicts: [], trashed: 0, cancelled: false },
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
    const { user } = setup();
    const select = screen.getByLabelText('Player') as HTMLSelectElement;
    expect(select.value).toBe('cdj2000');
    await user.click(screen.getByRole('button', { name: /scan/i }));
    await screen.findByText('Song');
    expect(api.findUnplayable).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'cdj2000' }));
    await user.selectOptions(select, 'cdj2000');
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
});
