import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ConsolidatePanel } from '../../src/renderer/components/maintenance/ConsolidatePanel';
import { FilterMovePanel } from '../../src/renderer/components/maintenance/FilterMovePanel';
import { useSettingsStore } from '../../src/renderer/stores/settingsStore';

const tracks = [
  { id: '1', name: 'Song', artist: 'A', location: '/m/a.mp3' },
  { id: '2', name: 'Other', artist: 'B', location: '/m/b.mp3' },
] as any[];

beforeEach(() => {
  (window as any).electronAPI.onConsolidateProgress = vi.fn(() => () => undefined);
  (window as any).electronAPI.onFilterProgress = vi.fn(() => () => undefined);
});

describe('ConsolidatePanel', () => {
  it('asks for a library before it offers to do anything', () => {
    render(<ConsolidatePanel tracks={[]} libraryPath="" hasLibrary={false} />);
    expect(screen.getByText(/Load a library first to consolidate/)).toBeTruthy();
  });

  it('offers a destination once a library is loaded', () => {
    render(<ConsolidatePanel tracks={tracks} libraryPath="/x/c.xml" hasLibrary />);
    expect(screen.getByLabelText('Destination folder')).toBeTruthy();
  });

  it('offers no way to overwrite a file at the destination', () => {
    render(<ConsolidatePanel tracks={tracks} libraryPath="/x/c.xml" hasLibrary />);
    expect(screen.queryByText(/Overwrite/i)).toBeNull();
    expect(screen.queryByText(/quality score/i)).toBeNull();
  });

  it('sends the database key for a database library, and reads the library again after', async () => {
    useSettingsStore.getState().setRekordboxDbKey('the-key');
    const consolidateLibrary = vi.fn(async () => ({
      success: true,
      data: { succeeded: 2, skipped: 0, failed: 0, errors: [], locationUpdates: {}, entriesUpdated: 2, backupPath: '/x/master.db.backup' },
    }));
    const fresh = { tracks: new Map(), playlists: [] };
    const parseRekordboxDb = vi.fn(async () => ({ success: true, data: fresh }));
    Object.assign((window as any).electronAPI, { consolidateLibrary, parseRekordboxDb });
    const onLibraryChanged = vi.fn();

    render(<ConsolidatePanel tracks={tracks} libraryPath="/x/master.db" hasLibrary onLibraryChanged={onLibraryChanged} />);
    fireEvent.change(screen.getByLabelText('Destination folder'), { target: { value: '/Volumes/SSD/Music' } });
    fireEvent.click(screen.getByText('Copy Library'));

    await waitFor(() => expect(onLibraryChanged).toHaveBeenCalledWith(fresh));
    expect(consolidateLibrary).toHaveBeenCalledWith(expect.objectContaining({
      libraryPath: '/x/master.db',
      dbKey: 'the-key',
      options: { destination: '/Volumes/SSD/Music', mode: 'copy' },
    }));
    expect(parseRekordboxDb).toHaveBeenCalledWith({ dbPath: '/x/master.db', key: 'the-key' });
  });

  it('subscribes to progress while it is mounted', () => {
    const { unmount } = render(<ConsolidatePanel tracks={tracks} libraryPath="/x/c.xml" hasLibrary />);
    expect((window as any).electronAPI.onConsolidateProgress).toHaveBeenCalled();
    unmount();
  });
});

describe('FilterMovePanel', () => {
  it('asks for a library before it offers to do anything', () => {
    render(<FilterMovePanel tracks={[]} libraryPath="" hasLibrary={false} />);
    expect(screen.getByText(/Load a library first/)).toBeTruthy();
  });

  it('starts with one empty rule', () => {
    render(<FilterMovePanel tracks={tracks} libraryPath="/x/c.xml" hasLibrary />);
    expect(screen.getByText('Filters')).toBeTruthy();
    expect(screen.getByDisplayValue('Artist')).toBeTruthy();
  });

  it('keeps its own destination, separate from the consolidate one', () => {
    // The two tools shared a file and were told apart only by an "f" prefix on
    // every piece of state; they are separate components now.
    render(
      <>
        <ConsolidatePanel tracks={tracks} libraryPath="/x/c.xml" hasLibrary />
        <FilterMovePanel tracks={tracks} libraryPath="/x/c.xml" hasLibrary />
      </>
    );
    expect(screen.getAllByLabelText('Destination folder')).toHaveLength(2);
  });
});
