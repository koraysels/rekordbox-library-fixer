import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AutoRelocateProgressDialog } from '../../src/renderer/components/ui/AutoRelocateProgressDialog';

let emit: (p: any) => void = () => undefined;

beforeEach(() => {
  (window as any).electronAPI.onAutoRelocateProgress = vi.fn((cb: any) => {
    emit = cb;
    return () => undefined;
  });
  (window as any).electronAPI.cancelAutoRelocate = vi.fn(async () => ({ success: true }));
});

const show = (isRunning: boolean) => render(
  <AutoRelocateProgressDialog
    isOpen
    isRunning={isRunning}
    onClose={() => undefined}
    onCancel={() => undefined}
  />
);

describe('AutoRelocateProgressDialog', () => {
  it('offers Cancel while the run is going', () => {
    show(true);
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.queryByText('Close')).toBeNull();
  });

  it('offers Close once the run is over, even with no completion event', () => {
    // A run that ended without emitting one left a Cancel button for work that
    // had already finished, with no way out of the dialog.
    show(false);
    expect(screen.getByText('Close')).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('offers Close as soon as the completion event lands', () => {
    show(true);
    act(() => emit({ type: 'complete', total: 10, current: 10, successCount: 7, message: 'Complete: 7/10' }));
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('offers Close after a cancelled run', () => {
    show(true);
    act(() => emit({ type: 'cancelled', total: 10, current: 3, message: 'Cancelled' }));
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('offers Close after a failed run', () => {
    show(true);
    act(() => emit({ type: 'error', total: 10, current: 3, message: 'Failed', error: 'disk on fire' }));
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('shows progress while it runs', () => {
    show(true);
    act(() => emit({ type: 'searching', total: 10, current: 4, message: 'Searching for Song' }));
    expect(screen.getByText('4 / 10 tracks')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
  });
});
