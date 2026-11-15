import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { WizardStepList } from '../../src/renderer/components/wizard/WizardStepList';
import { useWizardProgressStore, type SidebarItem } from '../../src/renderer/wizard/wizardProgress';

const items: SidebarItem[] = [
  { id: 'setup', label: 'Set up', state: 'done' },
  { id: 'check', label: 'Check library', state: 'done' },
  { id: 'relocate', label: 'Find moved tracks', state: 'current', count: 12 },
  { id: 'remove', label: 'Remove dead entries', state: 'skipped' },
  { id: 'duplicates', label: 'Merge duplicates', state: 'nothing' },
  { id: 'gather', label: 'Gather into folder', state: 'upcoming', count: 3 },
  { id: 'finish', label: 'Finish', state: 'upcoming' },
];

beforeEach(() => {
  act(() => useWizardProgressStore.getState().setItems(items));
});

describe('WizardStepList', () => {
  it('is a list named Wizard steps, one item per step, each named by its title', async () => {
    render(<WizardStepList />);
    const list = screen.getByRole('list', { name: 'Wizard steps' });
    for (const item of items) {
      expect(await within(list).findByRole('listitem', { name: item.label })).toBeTruthy();
    }
    expect(within(list).getAllByRole('listitem')).toHaveLength(items.length);
  });

  it('marks only the current step, and describes each step with its note', async () => {
    render(<WizardStepList />);
    const current = await screen.findByRole('listitem', { name: 'Find moved tracks' });
    expect(current.getAttribute('aria-current')).toBe('step');
    expect(current).toHaveAccessibleDescription('12 tracks');
    expect(screen.getAllByRole('listitem').filter((s) => s.hasAttribute('aria-current'))).toHaveLength(1);
    expect(screen.getByRole('listitem', { name: 'Set up' })).toHaveAccessibleDescription('Done');
    expect(screen.getByRole('listitem', { name: 'Remove dead entries' })).toHaveAccessibleDescription('Skipped');
    expect(screen.getByRole('listitem', { name: 'Merge duplicates' })).toHaveAccessibleDescription('Nothing to do');
  });

  it('keeps the finer state for the dim and done styles', async () => {
    render(<WizardStepList />);
    const skipped = await screen.findByRole('listitem', { name: 'Remove dead entries' });
    expect(skipped.getAttribute('data-state')).toBe('skipped');
    expect(skipped.hasAttribute('data-complete')).toBe(true);
    expect(screen.getByText('Remove dead entries').className).toContain('line-through');
    expect(screen.getByText('Find moved tracks').className).toContain('text-te-orange');
  });

  it('has one tab stop, on the current step, and Up and Down move between steps', async () => {
    const user = userEvent.setup();
    render(<><button type="button">before</button><WizardStepList /></>);
    await screen.findByRole('listitem', { name: 'Find moved tracks' });
    screen.getByRole('button', { name: 'before' }).focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('listitem', { name: 'Find moved tracks' }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('listitem', { name: 'Remove dead entries' }));
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(screen.getByRole('listitem', { name: 'Check library' }));
    await user.tab();
    expect(screen.getAllByRole('listitem')).not.toContain(document.activeElement);
  });

  it('falls back to the setup step when the wizard has published nothing', async () => {
    act(() => useWizardProgressStore.getState().setItems(null));
    render(<WizardStepList />);
    expect((await screen.findByRole('listitem', { name: 'Set up' })).getAttribute('aria-current')).toBe('step');
  });
});
