import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchDepthControl, MAX_DEPTH } from '../../src/renderer/components/ui/SearchDepthControl';
import { useSettingsStore } from '../../src/renderer/stores/settingsStore';

const setDepth = (searchDepth: number) =>
  useSettingsStore.setState((s) => ({ relocationOptions: { ...s.relocationOptions, searchDepth } }));
const depth = () => useSettingsStore.getState().relocationOptions.searchDepth;

describe('SearchDepthControl', () => {
  beforeEach(() => setDepth(5));

  it('steps the stored search depth up and down', () => {
    render(<SearchDepthControl />);
    fireEvent.click(screen.getByLabelText('Search more folder levels'));
    expect(depth()).toBe(6);
    fireEvent.click(screen.getByLabelText('Search fewer folder levels'));
    fireEvent.click(screen.getByLabelText('Search fewer folder levels'));
    expect(depth()).toBe(4);
  });

  it('stops at the maximum', () => {
    setDepth(MAX_DEPTH);
    render(<SearchDepthControl />);
    expect(screen.getByLabelText('Search more folder levels')).toBeDisabled();
  });
});
