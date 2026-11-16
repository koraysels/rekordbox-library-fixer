import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { UsbCheckResult, UsbStick } from '../../src/main/ipcContract';

const context = { libraryPath: '/lib/master.db', libraryData: { tracks: new Map(), playlists: [] } as unknown };
vi.mock('@renderer/AppWithRouter', () => ({ useAppContext: () => context }));

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

import { UsbPage } from '@renderer/components/pages/UsbPage';
import { useSettingsStore } from '@renderer/stores/settingsStore';

const stick = (name: string, over: Partial<UsbStick> = {}): UsbStick => ({
  root: `/Volumes/${name}`, name, hasOneLibrary: false, hasSyncList: true, ...over,
});

const fakeResult: UsbCheckResult = {
  playlists: [
    {
      id: '1', path: ['Sets', 'Warm up'], libraryCount: 4, stickCount: 1, onStick: true, extraOnStick: 0,
      notOnStick: [
        { trackId: 't1', name: 'Far Away', artist: 'Someone', location: '/Volumes/DJ SSD/a.mp3', reason: 'drive-unplugged', drive: 'DJ SSD' },
        { trackId: 't2', name: 'Lost One', artist: 'Nobody', location: '/Music/lost.mp3', reason: 'missing' },
        { trackId: 't3', name: 'Online', artist: 'Stream', location: 'tidal:tracks:1', reason: 'streaming' },
      ],
    },
    { id: '2', path: ['Peak'], libraryCount: 5, stickCount: 5, onStick: true, extraOnStick: 0, notOnStick: [] },
    { id: '3', path: ['Closing'], libraryCount: 2, stickCount: 0, onStick: false, extraOnStick: 0, notOnStick: [] },
  ],
  totals: {
    byReason: { 'drive-unplugged': 1, 'missing': 1, 'no-access': 0, 'streaming': 1, 'not-synced-yet': 0 },
    byDrive: [{ drive: 'DJ SSD', entries: 1, tracks: 1 }],
    emptyOnStick: 0,
  },
  leftovers: [{ path: ['Old export'], stickCount: 12 }],
  missingOnStick: [['Closing']],
  notChecked: [{ id: '9', path: ['Smart', 'New this week'], stickCount: 8 }],
  stick: { tracks: 6, playlists: 3 },
  syncList: { present: true, allPlaylists: false, unknownIds: 0 },
};

let api: any;
beforeEach(() => {
  vi.clearAllMocks();
  context.libraryPath = '/lib/master.db';
  useSettingsStore.setState({ rekordboxDbKey: 'k'.repeat(64) });
  api = (window as any).electronAPI;
  Object.assign(api, {
    usbFindSticks: vi.fn(async () => ({ success: true, data: [stick('STICK', { hasOneLibrary: true })] })),
    usbCheckStick: vi.fn(async () => ({ success: true, data: fakeResult })),
  });
});

describe('UsbPage', () => {
  it('checks the only stick and shows the summary first, the drive to plug in on top', async () => {
    render(<UsbPage />);
    expect(await screen.findByText('2 playlists incomplete on STICK')).toBeInTheDocument();
    expect(api.usbCheckStick).toHaveBeenCalledWith({ stickRoot: '/Volumes/STICK', dbPath: '/lib/master.db', key: 'k'.repeat(64) });
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getByText('Plug in DJ SSD: 1 track')).toBeInTheDocument();
    expect(within(summary).getByText('File is gone: 1 entry')).toBeInTheDocument();
    expect(within(summary).getByText('Streaming track: 1 entry')).toBeInTheDocument();
    expect(within(summary).getByText(/^Only the Device Library \(CDJ-2000/)).toBeInTheDocument();
  });

  it('lists incomplete playlists with library against stick counts, and opens one to show why', async () => {
    render(<UsbPage />);
    const playlists = await screen.findByRole('region', { name: 'Playlists' });
    expect(within(playlists).getByText('1 of 4 on the stick')).toBeInTheDocument();
    expect(within(playlists).getByText('Not on the stick · 2 tracks in the library')).toBeInTheDocument();
    // Complete playlists wait behind the toggle.
    expect(within(playlists).queryByText('Peak')).not.toBeInTheDocument();
    fireEvent.click(within(playlists).getByLabelText(/Show complete ones too/));
    expect(within(playlists).getByText('Peak')).toBeInTheDocument();

    expect(screen.queryByText('Lost One')).not.toBeInTheDocument();
    fireEvent.click(within(playlists).getByRole('button', { name: /Sets \/ Warm up/ }));
    expect(await screen.findByText('Lost One')).toBeInTheDocument();
    expect(screen.getByText('On DJ SSD, not plugged in · 1')).toBeInTheDocument();
  });

  it('points missing files at Track Relocation', async () => {
    render(<UsbPage />);
    const summary = await screen.findByRole('region', { name: 'Summary' });
    fireEvent.click(within(summary).getByRole('button', { name: 'Open Track Relocation' }));
    expect(navigate).toHaveBeenCalledWith({ to: '/relocate' });
  });

  it('shows leftovers and smart playlists as not checked', async () => {
    render(<UsbPage />);
    const leftovers = await screen.findByRole('region', { name: 'Leftovers' });
    expect(within(leftovers).getByText('Old export')).toBeInTheDocument();
    expect(within(leftovers).getByText('12 on the stick')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Not checked' })).getByText('Smart / New this week')).toBeInTheDocument();
  });

  it('with several sticks asks which one, then checks the one picked', async () => {
    api.usbFindSticks.mockResolvedValue({ success: true, data: [stick('ONE'), stick('TWO')] });
    render(<UsbPage />);
    expect(await screen.findByText('Several sticks are plugged in. Which one?')).toBeInTheDocument();
    expect(api.usbCheckStick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'TWO' }));
    expect(await screen.findByText('2 playlists incomplete on TWO')).toBeInTheDocument();
    expect(api.usbCheckStick).toHaveBeenCalledWith(expect.objectContaining({ stickRoot: '/Volumes/TWO' }));
  });

  it('says so when no stick is plugged in', async () => {
    api.usbFindSticks.mockResolvedValue({ success: true, data: [] });
    render(<UsbPage />);
    expect(await screen.findByText(/No rekordbox USB stick found/)).toBeInTheDocument();
  });

  it('an XML library gets a short message instead of a check', async () => {
    context.libraryPath = '/exports/rekordbox.xml';
    render(<UsbPage />);
    expect(screen.getByText(/needs the database open, not an XML export/)).toBeInTheDocument();
    expect(api.usbFindSticks).not.toHaveBeenCalled();
  });
});
