import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { EmptyLibraryState } from '../../src/renderer/components/ui/EmptyLibraryState';
import { useSettingsStore } from '../../src/renderer/stores/settingsStore';

const DB = {
  kind: 'database', path: '/Users/dj/Library/Pioneer/rekordbox/master.db',
  label: 'Rekordbox database (rekordbox)', size: 52428800, modified: '2026-09-20T10:00:00.000Z',
};
const DB6 = {
  kind: 'database', path: '/Users/dj/Library/Pioneer/rekordbox6/master.db',
  label: 'Rekordbox database (rekordbox6)', size: 41943040, modified: '2024-01-02T10:00:00.000Z',
};
const XML = {
  kind: 'xml', path: '/Users/dj/Documents/rekordbox/collection.xml',
  label: 'collection.xml — rekordbox', size: 20971520, modified: '2026-09-01T10:00:00.000Z',
};

let onLoadFromDb: ReturnType<typeof vi.fn>;
let onLoadLibrary: ReturnType<typeof vi.fn>;
let onSelectLibrary: ReturnType<typeof vi.fn>;

const show = (found: any[] = [DB, XML]) => {
  (window as any).electronAPI.scanForLibraries = vi.fn(async () => found);
  onLoadFromDb = vi.fn();
  onLoadLibrary = vi.fn();
  onSelectLibrary = vi.fn();
  return render(
    <EmptyLibraryState
      onSelectLibrary={onSelectLibrary}
      onLoadFromDb={onLoadFromDb}
      onLoadLibrary={onLoadLibrary}
    />
  );
};

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ rekordboxDbKey: 'a-key' } as any);
});

describe('EmptyLibraryState', () => {
  it('leads with the rekordbox database', async () => {
    show();
    await screen.findByText('Rekordbox database');
    // XML is still offered, one step down.
    expect(screen.getByText('Or open an XML export')).toBeTruthy();
  });

  it('lists every database on this machine', async () => {
    show([DB, DB6]);
    await screen.findByTitle(DB.path);
    expect(screen.getByTitle(DB6.path)).toBeTruthy();
  });

  it('opens the database that was clicked, not whichever is detected', async () => {
    // A machine can hold rekordbox 6 beside 7; clicking the older one used to
    // open the newer one anyway.
    show([DB, DB6]);
    fireEvent.click(await screen.findByTitle(DB6.path));
    expect(onLoadFromDb).toHaveBeenCalledWith(DB6.path);
  });

  it('marks the library that was open last', async () => {
    localStorage.setItem('rekordboxLibraryPath', DB6.path);
    show([DB, DB6]);
    expect(await screen.findByText('Last opened')).toBeTruthy();
  });

  it('marks nothing when nothing was opened before', async () => {
    show([DB, XML]);
    await screen.findByTitle(DB.path);
    expect(screen.queryByText('Last opened')).toBeNull();
  });

  it('asks for the key before opening a database without one', async () => {
    useSettingsStore.setState({ rekordboxDbKey: '' } as any);
    show([DB]);
    fireEvent.click(await screen.findByTitle(DB.path));
    expect(onLoadFromDb).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/Paste the master.db key/)).toBeTruthy();
  });

  it('opens an XML export directly', async () => {
    show([DB, XML]);
    fireEvent.click(await screen.findByTitle(XML.path));
    expect(onLoadLibrary).toHaveBeenCalledWith(XML.path);
  });

  it('says so when this machine has no database', async () => {
    show([XML]);
    expect(await screen.findByText(/No rekordbox database found/)).toBeTruthy();
  });

  it('still offers the file browser', async () => {
    show([]);
    fireEvent.click(await screen.findByText('Browse for an XML file'));
    expect(onSelectLibrary).toHaveBeenCalled();
  });

  it('survives a machine scan that fails', async () => {
    (window as any).electronAPI.scanForLibraries = vi.fn(async () => { throw new Error('nope'); });
    render(
      <EmptyLibraryState
        onSelectLibrary={vi.fn()}
        onLoadFromDb={vi.fn()}
        onLoadLibrary={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Rekordbox database')).toBeTruthy());
  });
});
