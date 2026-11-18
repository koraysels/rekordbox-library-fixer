import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TutorialModal } from '../../src/renderer/components/ui/TutorialModal';
import { AboutModal } from '../../src/renderer/components/ui/AboutModal';

describe('About and the tutorial', () => {
  it('a stray click outside the tutorial keeps it open on the same step', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TutorialModal isOpen onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    const before = screen.getByRole('dialog').textContent;
    await user.click(document.body);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toBe(before);
  });

  it('a stray click outside About keeps it open', async () => {
    const onClose = vi.fn();
    render(<AboutModal isOpen onClose={onClose} />);
    await userEvent.setup().click(document.body);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
