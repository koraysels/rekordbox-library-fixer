import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ConvertProgressDialog } from '../../src/renderer/components/convert/ConvertProgressDialog';

const progress = { current: 1, total: 4, message: 'Converting a.flac', convertedCount: 1, failedCount: 0 } as any;

describe('ConvertProgressDialog', () => {
  it('is a dialog named by its title', () => {
    const { rerender } = render(<ConvertProgressDialog isOpen progress={progress} installPercent={null} onHide={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Converting Tracks' })).toBeTruthy();
    rerender(<ConvertProgressDialog isOpen progress={null} installPercent={40} onHide={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Downloading ffmpeg' })).toBeTruthy();
  });

  it('renders nothing while closed', () => {
    render(<ConvertProgressDialog isOpen={false} progress={progress} installPercent={null} onHide={() => undefined} onCancel={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape hides it and leaves the run going', async () => {
    const onHide = vi.fn();
    const onCancel = vi.fn();
    render(<ConvertProgressDialog isOpen progress={progress} installPercent={null} onHide={onHide} onCancel={onCancel} />);
    await userEvent.setup().keyboard('{Escape}');
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('an outside press leaves it open', async () => {
    const onHide = vi.fn();
    render(<ConvertProgressDialog isOpen progress={progress} installPercent={null} onHide={onHide} onCancel={() => undefined} />);
    await userEvent.setup().click(document.body);
    expect(onHide).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('Hide and Cancel keep their jobs', async () => {
    const user = userEvent.setup();
    const onHide = vi.fn();
    const onCancel = vi.fn();
    render(<ConvertProgressDialog isOpen progress={progress} installPercent={null} onHide={onHide} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();
  });
});
