import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgent } from '@ui-sdk/react/agent';
import { TrackRelocatorSettings } from '../../src/renderer/components/TrackRelocatorSettings';
import { useSettingsStore } from '../../src/renderer/stores/settingsStore';

const agent = createAgent();
const options = () => useSettingsStore.getState().relocationOptions;

const Connected = () => {
  const searchOptions = useSettingsStore((s) => s.relocationOptions);
  return (
    <TrackRelocatorSettings
      searchOptions={searchOptions}
      newSearchPath=""
      setNewSearchPath={() => {}}
      addSearchPath={() => {}}
      removeSearchPath={() => {}}
    />
  );
};

describe('TrackRelocatorSettings', () => {
  beforeEach(() =>
    useSettingsStore.setState((s) => ({
      relocationOptions: { ...s.relocationOptions, searchDepth: 3, matchThreshold: 0.7 },
    })),
  );

  it('names the search depth field from its label and describes it', () => {
    render(<Connected />);
    const field = screen.getByRole('textbox', { name: 'Search Depth' });
    expect(field).toHaveValue('3');
    expect(field).toHaveAccessibleDescription('How many folder levels deep to search');
  });

  it('clamps a typed depth and never stores a cleared one', async () => {
    const user = userEvent.setup();
    render(<Connected />);
    const field = screen.getByRole('textbox', { name: 'Search Depth' });
    await user.clear(field);
    await user.tab();
    expect(options().searchDepth).toBe(3);

    await user.clear(field);
    await user.type(field, '20{Enter}');
    expect(options().searchDepth).toBe(10);
    expect(field).toHaveValue('10');
  });

  it('steps the depth with its buttons', async () => {
    const user = userEvent.setup();
    render(<Connected />);
    await user.click(screen.getByRole('button', { name: 'Search more folder levels' }));
    expect(options().searchDepth).toBe(4);
  });

  it('reads the match threshold as a similarity and moves it with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Connected />);
    const slider = screen.getByRole('slider', { name: 'Match Threshold' });
    expect(slider).toHaveAttribute('aria-valuetext', '70% similarity');

    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(options().matchThreshold).toBeCloseTo(0.8);
    expect(screen.getByRole('slider', { name: 'Match Threshold' })).toHaveAttribute('aria-valuetext', '80% similarity');

    await user.keyboard('{Home}');
    expect(options().matchThreshold).toBeCloseTo(0.1);
    await user.keyboard('{End}');
    expect(options().matchThreshold).toBe(1);
  });

  it('lets an agent find and set the depth and threshold', async () => {
    render(<Connected />);
    const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== 'more');
    for (const entry of components) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    }
    const labels = components.map((entry) => entry.label);
    expect(labels).toContain('Search Depth');
    expect(labels).toContain('Match Threshold');

    const result = await agent.act({
      steps: [
        { ref: 'Search Depth', action: 'setValue', args: [6] },
        { ref: 'Match Threshold', action: 'setValue', args: [0.5] },
      ],
    });
    expect(result.ok, result.error?.message).toBe(true);
    expect(options().searchDepth).toBe(6);
    expect(options().matchThreshold).toBeCloseTo(0.5);
  });
});
