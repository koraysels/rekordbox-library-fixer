import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { ProgressBar } from '../../src/renderer/components/ui/ProgressBar';
import { ConvertProgressDialog } from '../../src/renderer/components/convert/ConvertProgressDialog';
import { WorkingPanel } from '../../src/renderer/components/wizard/WizardFrame';
import { ConvertConsent } from '../../src/renderer/components/wizard/ConvertConsent';

describe('ProgressBar', () => {
  it('is a named progressbar with its value and range', () => {
    render(<ProgressBar label="Copying files" value={3} max={12} unit="files" />);
    const bar = screen.getByRole('progressbar', { name: 'Copying files' });
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('12');
    expect(bar.getAttribute('aria-valuetext')).toBe('3 of 12 files');
  });

  it('fills the track as far as the value', () => {
    const { container } = render(<ProgressBar label="Scanning library" value={1} max={4} />);
    const fill = container.querySelector<HTMLElement>('[data-slot="progress-indicator"]');
    expect(fill?.style.width).toBe('25%');
    expect(fill?.className).toContain('bg-te-orange');
  });

  it('reads a percentage when no unit is given', () => {
    render(<ProgressBar label="Downloading ffmpeg" value={40} />);
    const bar = screen.getByRole('progressbar', { name: 'Downloading ffmpeg' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(bar.getAttribute('aria-valuetext')).toBe('40%');
  });

  it('an unknown total reads as nothing done, never as finished', () => {
    const { container } = render(<ProgressBar label="Converting tracks" value={0} max={0} unit="files" />);
    const bar = screen.getByRole('progressbar', { name: 'Converting tracks' });
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    expect(container.querySelector('[data-slot="progress"]')?.hasAttribute('data-complete')).toBe(false);
  });

  it('keeps the TE track size and tone', () => {
    const { container } = render(<ProgressBar label="Relocating tracks" value={1} max={2} size="lg" tone="dark" />);
    const track = container.querySelector('[data-slot="progress-track"]');
    expect(track?.className).toContain('h-3');
    expect(track?.className).toContain('bg-te-grey-700');
  });
});

describe('progress bars in the app', () => {
  it('the convert dialog names its bar by what it is doing', () => {
    const progress = { current: 1, total: 4, message: 'a.flac', convertedCount: 1, failedCount: 0 } as any;
    const { rerender } = render(<ConvertProgressDialog isOpen progress={progress} installPercent={null} onHide={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('progressbar', { name: 'Converting tracks' }).getAttribute('aria-valuetext')).toBe('1 of 4 files');
    rerender(<ConvertProgressDialog isOpen progress={null} installPercent={40} onHide={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('progressbar', { name: 'Downloading ffmpeg' }).getAttribute('aria-valuenow')).toBe('40');
  });

  it('the wizard working panel shows a bar only once it knows the total', () => {
    const { rerender } = render(<WorkingPanel progress={null} fallback="Checking your library…" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    rerender(<WorkingPanel progress={{ current: 2, total: 5, message: 'Reading' } as any} fallback="Checking your library…" />);
    expect(screen.getByRole('progressbar', { name: 'Checking your library' }).getAttribute('aria-valuenow')).toBe('2');
    expect(screen.getByText('2 / 5')).toBeTruthy();
  });

  it('the ffmpeg consent screen shows its download as a progressbar', async () => {
    let report: (p: { percent: number }) => void = () => undefined;
    let finish: (r: unknown) => void = () => undefined;
    (window as any).electronAPI.onFfmpegInstallProgress = vi.fn((cb: typeof report) => { report = cb; return () => undefined; });
    (window as any).electronAPI.installFfmpeg = vi.fn(() => new Promise((r) => { finish = r; }));
    render(<ConvertConsent sizeBytes={50 * 1024 * 1024} onInstalled={() => undefined} onBack={() => undefined} />);
    act(() => { screen.getByRole('button', { name: /Download ffmpeg/ }).click(); });
    act(() => report({ percent: 30 }));
    expect(screen.getByRole('progressbar', { name: 'Downloading ffmpeg' }).getAttribute('aria-valuenow')).toBe('30');
    expect(screen.getByText('Downloading ffmpeg… 30%')).toBeTruthy();
    await act(async () => { finish({ success: true, data: { path: '/x' } }); });
  });
});
