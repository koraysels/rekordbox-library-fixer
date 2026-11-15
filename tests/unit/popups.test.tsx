import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppFooter } from '@renderer/components/ui/AppFooter';
import { SettingsPanel } from '@renderer/components/SettingsPanel';
import { MissingTrackItem } from '@renderer/components/MissingTrackItem';
import { useSettingsStore } from '@renderer/stores/settingsStore';
import type { LibraryData } from '@renderer/types';

const library = {
  tracks: new Map([['1', { id: '1' }]]),
  playlists: [
    { name: 'Warmup', type: 'PLAYLIST', tracks: ['1'] },
    { name: 'Sets', type: 'FOLDER', tracks: [], children: [{ name: 'Peak', type: 'PLAYLIST', tracks: ['1'] }] },
  ],
} as unknown as LibraryData;

const playlistsButton = () => screen.getByRole('button', { name: /2 PLAYLISTS/ });

describe('AppFooter playlist overview', () => {
  it('opens a dialog named by its title', async () => {
    const user = userEvent.setup();
    render(<AppFooter libraryData={library} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(playlistsButton());
    const dialog = screen.getByRole('dialog', { name: 'Playlist Overview' });
    expect(dialog).toHaveTextContent('Warmup');
    expect(dialog).toHaveTextContent('Peak');
    expect(playlistsButton()).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes with the named close button', async () => {
    const user = userEvent.setup();
    render(<AppFooter libraryData={library} />);
    await user.click(playlistsButton());
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(playlistsButton()).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<AppFooter libraryData={library} />);
    await user.click(playlistsButton());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(playlistsButton()).toHaveFocus();
  });

  it('closes on a press outside', async () => {
    const user = userEvent.setup();
    render(<AppFooter libraryData={library} />);
    await user.click(playlistsButton());
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Keep Highest Quality info', () => {
  const showSettings = (setResolutionStrategy = vi.fn()) => {
    render(
      <SettingsPanel
        scanOptions={useSettingsStore.getState().scanOptions}
        setScanOptions={() => undefined}
        resolutionStrategy="keep-oldest"
        setResolutionStrategy={setResolutionStrategy}
      />,
    );
    return setResolutionStrategy;
  };

  it('is described by the scoring tip', () => {
    showSettings();
    expect(screen.getByRole('button', { name: 'Quality scoring info' })).toHaveAccessibleDescription(
      expect.stringContaining('WAV / AIFF'),
    );
  });

  it('opens on press without choosing the strategy, and closes on Escape', async () => {
    const user = userEvent.setup();
    showSettings();
    const radio = screen.getByRole('radio', { name: /Keep Highest Quality/ });
    expect(radio).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Quality scoring info' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Quality scoring');
    expect(radio).not.toBeChecked();
    await user.click(screen.getByText('Quality scoring'));
    expect(radio).not.toBeChecked();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('closes on a second press', async () => {
    const user = userEvent.setup();
    showSettings();
    const info = screen.getByRole('button', { name: 'Quality scoring info' });
    await user.click(info);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.click(info);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });
});

describe('MissingTrackItem actions', () => {
  const track = { id: 't1', name: 'Lost Song', artist: 'Someone', originalLocation: '/gone/lost.mp3' };
  const showRow = (over: Partial<React.ComponentProps<typeof MissingTrackItem>> = {}) => {
    const props = {
      track,
      isSelected: false,
      onToggleSelection: vi.fn(),
      onFindCandidates: vi.fn(),
      onRemoveRelocation: vi.fn(),
      hasRelocation: true,
      relocationPath: '/found/lost.mp3',
      isFindingCandidates: false,
      isLoadingThis: false,
      ...over,
    };
    render(<MissingTrackItem {...props} />);
    return props;
  };

  it('finds and removes without selecting the row', async () => {
    const user = userEvent.setup();
    const props = showRow();
    await user.click(screen.getByRole('button', { name: 'Find' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(props.onFindCandidates).toHaveBeenCalledWith(track);
    expect(props.onRemoveRelocation).toHaveBeenCalledWith(track);
    expect(props.onToggleSelection).not.toHaveBeenCalled();
  });

  it('keeps Find focusable but inert while a search runs', async () => {
    const user = userEvent.setup();
    const props = showRow({ isFindingCandidates: true });
    const find = screen.getByRole('button', { name: 'Find' });
    expect(find).toHaveAttribute('aria-disabled', 'true');
    await user.click(find);
    expect(props.onFindCandidates).not.toHaveBeenCalled();
    expect(props.onToggleSelection).not.toHaveBeenCalled();
    expect(find).toHaveAccessibleDescription(expect.stringContaining('Find Candidates'));
  });
});
