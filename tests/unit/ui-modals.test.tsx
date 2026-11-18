import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AboutModal } from '../../src/renderer/components/ui/AboutModal';
import { TutorialModal } from '../../src/renderer/components/ui/TutorialModal';
import { DeleteConfirmModal } from '../../src/renderer/components/ui/DeleteConfirmModal';
import { useAppStore } from '../../src/renderer/stores/appStore';

beforeEach(() => {
  (window as any).electronAPI.getAppVersion = vi.fn(async () => ({ success: true, data: { version: '9.9.9' } }));
  (window as any).electronAPI.openExternal = vi.fn(async () => ({ success: true }));
});

function Opener({ label, children }: { label: string; children: (open: boolean, close: () => void) => React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>{label}</button>
      {children(open, () => setOpen(false))}
    </>
  );
}

describe('AboutModal', () => {
  it('is a dialog named About, and nothing while closed', () => {
    const { rerender } = render(<AboutModal isOpen={false} onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<AboutModal isOpen onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'About' })).toBeInTheDocument();
  });

  it('closes from the X, the Close button and Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AboutModal isOpen onClose={onClose} />);
    const [x, close] = screen.getAllByRole('button', { name: 'Close' });
    await user.click(x);
    await user.click(close);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('returns focus to what opened it', async () => {
    const user = userEvent.setup();
    render(<Opener label="About">{(open, close) => <AboutModal isOpen={open} onClose={close} />}</Opener>);
    await user.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByRole('dialog', { name: 'About' })).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'About' })).toHaveFocus();
  });

  it('loads the version when opened', async () => {
    useAppStore.setState({ isVersionLoaded: false });
    render(<AboutModal isOpen onClose={() => undefined} />);
    await waitFor(() => expect((window as any).electronAPI.getAppVersion).toHaveBeenCalled());
  });
});

describe('TutorialModal', () => {
  it('is a dialog named by its title', () => {
    render(<TutorialModal isOpen onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'XML Export & Import Tutorial' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
  });

  it('starts over at step 1 after Escape closes it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Opener label="Tutorial">{(open, close) => <TutorialModal isOpen={open} onClose={() => { onClose(); close(); }} />}</Opener>);
    await user.click(screen.getByRole('button', { name: 'Tutorial' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Tutorial' }));
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });
});

describe('DeleteConfirmModal', () => {
  const paths = ['/m/a.wav', '/m/b.wav'];

  function renderModal() {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    function Host() {
      const [pending, setPending] = React.useState<string[] | null>(null);
      return (
        <>
          <button type="button" onClick={() => setPending(paths)}>Resolve</button>
          {pending && (
            <DeleteConfirmModal
              filePaths={pending}
              libraryPath="/lib/collection.xml"
              onConfirm={() => { setPending(null); onConfirm(); }}
              onCancel={() => { setPending(null); onCancel(); }}
            />
          )}
        </>
      );
    }
    render(<Host />);
    return { onConfirm, onCancel, user: userEvent.setup() };
  }

  it('is an alert dialog named by its step, starting on Cancel', async () => {
    const { user } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Permanent deletion — step 1 of 3' });
    expect(dialog).toHaveAccessibleDescription(/permanently delete 2 files from disk/);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('Escape cancels and focus goes back', async () => {
    const { user, onCancel, onConfirm } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Resolve' })).toHaveFocus();
  });

  it('the X and Cancel both cancel', async () => {
    const { user, onCancel } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(2));
  });

  it('deletes only after three steps and the typed word', async () => {
    const { user, onConfirm, onCancel } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    await user.click(screen.getByRole('button', { name: 'I understand — show me the files' }));
    expect(screen.getByRole('alertdialog', { name: 'Permanent deletion — step 2 of 3' })).toBeInTheDocument();
    expect(screen.getByText('/m/a.wav')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Confirmed — final step' }));
    const input = screen.getByRole('textbox', { name: 'Type DELETE to confirm' });
    expect(input).toHaveFocus();
    const del = screen.getByRole('button', { name: 'Delete 2 files' });
    expect(del).toBeDisabled();

    await user.type(input, 'DELETE');
    expect(del).toBeEnabled();
    await user.click(del);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('an outside press leaves it open', async () => {
    const { user, onCancel } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    await user.click(document.body);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
