import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MusicFolderSetting } from '@renderer/components/ui/MusicFolderSetting';
import { SettingsPanel } from '@renderer/components/SettingsPanel';
import { useSettingsStore } from '@renderer/stores/settingsStore';

const pick = () => window.electronAPI.selectFolder as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({ musicFolder: '' });
});

describe('MusicFolderSetting', () => {
  it('chooses a folder when none is set', async () => {
    pick().mockResolvedValue('/Users/dj/Music');
    render(<MusicFolderSetting />);
    expect(screen.getByText('Not chosen yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    await waitFor(() => expect(useSettingsStore.getState().musicFolder).toBe('/Users/dj/Music'));
  });

  it('changes a folder already set, and keeps it when the picker is closed', async () => {
    useSettingsStore.setState({ musicFolder: '/Users/dj/Wrong' });
    render(<MusicFolderSetting />);
    expect(screen.getByTestId('music-folder-path')).toHaveTextContent('/Users/dj/Wrong');

    pick().mockResolvedValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    await waitFor(() => expect(pick()).toHaveBeenCalledTimes(1));
    expect(useSettingsStore.getState().musicFolder).toBe('/Users/dj/Wrong');

    pick().mockResolvedValue('/Volumes/SSD/Music');
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    await waitFor(() => expect(useSettingsStore.getState().musicFolder).toBe('/Volumes/SSD/Music'));
  });

  it('sits in Settings next to the oldest player', () => {
    useSettingsStore.setState({ musicFolder: '/Users/dj/Music' });
    render(
      <SettingsPanel
        scanOptions={useSettingsStore.getState().scanOptions}
        setScanOptions={() => undefined}
        resolutionStrategy="keep-highest-quality"
        setResolutionStrategy={() => undefined}
      />,
    );
    expect(screen.getByText('Oldest player you play on')).toBeInTheDocument();
    expect(screen.getByText('Music folder')).toBeInTheDocument();
    expect(screen.getByTestId('music-folder-path')).toHaveTextContent('/Users/dj/Music');
  });
});
