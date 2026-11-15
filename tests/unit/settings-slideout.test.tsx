import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SettingsSlideout } from '../../src/renderer/components/ui/SettingsSlideout';

function Counter() {
  const [n, setN] = React.useState(0);
  return <button type="button" onClick={() => setN(n + 1)}>Count {n}</button>;
}

function Page({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Settings</button>
      <button type="button">Elsewhere</button>
      <SettingsSlideout
        isOpen={open}
        onClose={() => { onClose(); setOpen(false); }}
        title="Duplicate Detection Settings"
        subtitle="Configure scan options and resolution preferences"
      >
        <label>Folder <input type="text" /></label>
        <Counter />
      </SettingsSlideout>
    </>
  );
}

describe('SettingsSlideout', () => {
  it('keeps its fields out of reach while closed', async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Folder' })).toBeNull();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement?.tagName).not.toBe('INPUT');
  });

  it('opens as a dialog named and described by its header', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Duplicate Detection Settings' });
    expect(dialog).toHaveAccessibleDescription('Configure scan options and resolution preferences');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('textbox', { name: 'Folder' })).toBeInTheDocument();
  });

  it('Escape closes it and focus returns to Settings', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
  });

  it('the X is named Close and closes it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps its content mounted, with its state, between openings', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Count 0' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
  });
});
