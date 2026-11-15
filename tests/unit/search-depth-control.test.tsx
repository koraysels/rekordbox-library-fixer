import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchDepthControl, MAX_DEPTH } from '../../src/renderer/components/ui/SearchDepthControl';
import { useSettingsStore } from '../../src/renderer/stores/settingsStore';

const setDepth = (searchDepth: number) =>
  useSettingsStore.setState((s) => ({ relocationOptions: { ...s.relocationOptions, searchDepth } }));
const depth = () => useSettingsStore.getState().relocationOptions.searchDepth;

describe('SearchDepthControl', () => {
  beforeEach(() => setDepth(5));

  it('names the field and steps the stored search depth with its buttons', async () => {
    const user = userEvent.setup();
    render(<SearchDepthControl />);
    expect(screen.getByRole('textbox', { name: 'Search depth' })).toHaveValue('5');
    await user.click(screen.getByRole('button', { name: 'Search more folder levels' }));
    expect(depth()).toBe(6);
    await user.click(screen.getByRole('button', { name: 'Search fewer folder levels' }));
    await user.click(screen.getByRole('button', { name: 'Search fewer folder levels' }));
    expect(depth()).toBe(4);
  });

  it('steps with the arrow keys and jumps to the bounds with Home and End', async () => {
    const user = userEvent.setup();
    render(<SearchDepthControl />);
    await user.click(screen.getByRole('textbox', { name: 'Search depth' }));
    await user.keyboard('{ArrowUp}');
    expect(depth()).toBe(6);
    await user.keyboard('{Home}');
    expect(depth()).toBe(1);
    await user.keyboard('{End}');
    expect(depth()).toBe(MAX_DEPTH);
  });

  it('stops at the maximum', () => {
    setDepth(MAX_DEPTH);
    render(<SearchDepthControl />);
    expect(screen.getByRole('button', { name: 'Search more folder levels' })).toBeDisabled();
  });

  it('keeps the stored depth when the field is cleared', async () => {
    const user = userEvent.setup();
    render(<SearchDepthControl />);
    const field = screen.getByRole('textbox', { name: 'Search depth' });
    await user.clear(field);
    await user.tab();
    expect(depth()).toBe(5);
    expect(field).toHaveValue('5');
  });
});
