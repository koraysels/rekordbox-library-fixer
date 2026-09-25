import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DuplicateToolbar } from '../../src/renderer/components/DuplicateToolbar';

const set = (id: string, kind: 'files' | 'entries') => ({
  id,
  tracks: kind === 'files'
    ? [{ id: `${id}a`, location: '/m/a.mp3' }, { id: `${id}b`, location: '/m/b.mp3' }]
    : [{ id: `${id}a`, location: '/m/a.mp3' }, { id: `${id}b`, location: '/m/a.mp3' }],
});

const show = (over: any = {}) => {
  const props = {
    duplicates: [set('1', 'files'), set('2', 'entries')],
    visibleDuplicates: [set('1', 'files')],
    selectedDuplicates: new Set<string>(),
    kindFilter: 'all' as const,
    kindCounts: { files: 1, entries: 1, streaming: 0 },
    setKindFilter: vi.fn(),
    searchFilter: '',
    setSearchFilter: vi.fn(),
    scanProgress: null,
    busy: false,
    deleteFromDisk: false,
    setDeleteFromDisk: vi.fn(),
    scanForDuplicates: vi.fn(),
    cancelScan: vi.fn(),
    selectAllInMode: vi.fn(),
    clearAll: vi.fn(),
    resolveDuplicates: vi.fn(),
    isResolveDisabled: true,
    ...over,
  };
  render(<DuplicateToolbar {...props} />);
  return props;
};

describe('DuplicateToolbar', () => {
  it('offers a scan', () => {
    const props = show();
    fireEvent.click(screen.getByText(/Find Duplicates|Scan/i));
    expect(props.scanForDuplicates).toHaveBeenCalled();
  });

  it('shows the way out while a scan runs', () => {
    // Cancel used to live in the empty results area, which disappears as soon
    // as the first streamed set arrives — taking Cancel with it.
    const props = show({ busy: true, scanProgress: { current: 5, total: 50, setsFound: 2 } });
    fireEvent.click(screen.getByText('Cancel scan'));
    expect(props.cancelScan).toHaveBeenCalled();
  });

  it('counts each kind of duplicate', () => {
    show();
    expect(screen.getByText('Duplicate files')).toBeTruthy();
    expect(screen.getByText('Same-file entries')).toBeTruthy();
    expect(screen.getByText('Streaming')).toBeTruthy();
  });

  it('filters by kind', () => {
    const props = show();
    fireEvent.click(screen.getByText('Duplicate files'));
    expect(props.setKindFilter).toHaveBeenCalledWith('files');
  });

  it('hides the destructive row until something is selected', () => {
    show();
    expect(screen.queryByText(/Resolve Selected/)).toBeNull();
  });

  it('shows the destructive row once something is selected', () => {
    show({ selectedDuplicates: new Set(['1']), isResolveDisabled: false });
    expect(screen.getByText('Resolve Selected')).toBeTruthy();
  });

  it('resolves the selection', () => {
    const props = show({ selectedDuplicates: new Set(['1']), isResolveDisabled: false });
    fireEvent.click(screen.getByText('Resolve Selected'));
    expect(props.resolveDuplicates).toHaveBeenCalled();
  });
});
