import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { UpdateNotice } from '../../src/renderer/components/ui/UpdateNotice';

let emit: (s: any) => void = () => undefined;

beforeEach(() => {
  Object.assign((window as any).electronAPI, {
    getUpdateStatus: vi.fn(async () => ({ state: 'idle' })),
    onUpdateStatus: vi.fn((cb: any) => { emit = cb; return () => undefined; }),
    installUpdate: vi.fn(async () => ({ success: true })),
    openReleasesPage: vi.fn(async () => ({ success: true })),
  });
});

describe('UpdateNotice', () => {
  it('shows download progress', async () => {
    render(<UpdateNotice />);
    await act(async () => emit({ state: 'downloading', version: '0.6.11', percent: 42 }));
    expect(screen.getByRole('status').textContent).toContain('v0.6.11 · 42%');
  });

  it('restarts into the downloaded update on click', async () => {
    render(<UpdateNotice />);
    await act(async () => emit({ state: 'ready', version: '0.6.11' }));
    act(() => { screen.getByText(/Restart to update to v0.6.11/).click(); });
    expect((window as any).electronAPI.installUpdate).toHaveBeenCalled();
  });

  it('points at the download when this copy cannot update itself', async () => {
    render(<UpdateNotice />);
    await act(async () => emit({ state: 'manual', version: '0.6.11', url: 'x' }));
    act(() => { screen.getByText(/v0.6.11 is out/).click(); });
    expect((window as any).electronAPI.openReleasesPage).toHaveBeenCalled();
  });

  it('shows nothing before any check', () => {
    const { container } = render(<UpdateNotice />);
    expect(container.textContent).toBe('');
  });
});
