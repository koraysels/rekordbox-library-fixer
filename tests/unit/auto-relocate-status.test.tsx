import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AutoRelocateStatus } from '../../src/renderer/components/ui/AutoRelocateStatus';

let emit: (p: any) => void = () => undefined;

beforeEach(() => {
  (window as any).electronAPI.onAutoRelocateProgress = vi.fn((cb: any) => {
    emit = cb;
    return () => undefined;
  });
});

describe('AutoRelocateStatus', () => {
  it('shows nothing when no run is going', () => {
    render(<AutoRelocateStatus running={false} onShow={() => undefined} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows live progress for a run whose dialog is hidden', () => {
    render(<AutoRelocateStatus running onShow={() => undefined} />);
    act(() => emit({ type: 'found', current: 1200, total: 5479, successCount: 1100, message: '' }));
    expect(screen.getByRole('status').textContent).toContain('1200 / 5479 · 1100 found');
    act(() => emit({ type: 'updating-xml', current: 5479, total: 5479, message: 'Writing 5239 relocations into your library…' }));
    expect(screen.getByRole('status').textContent).toContain('Writing 5239 relocations');
  });

  it('reopens the dialog', () => {
    const onShow = vi.fn();
    render(<AutoRelocateStatus running onShow={onShow} />);
    act(() => { screen.getByText('Show progress').click(); });
    expect(onShow).toHaveBeenCalled();
  });
});
