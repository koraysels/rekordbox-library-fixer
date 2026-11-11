import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepScreen } from '@renderer/components/wizard/StepScreen';
import { describePlan, stepTitle } from '@renderer/wizard/stepText';
import type { StepPlan } from '../../src/main/wizard/types';

const relocate: StepPlan = {
  step: 'relocate',
  apply: [
    { trackIds: ['1'], name: 'Strings of Life', artist: 'Rhythim Is Rhythim', location: '/old/a.mp3', to: '/Music/a.mp3', confidence: 0.97 },
    { trackIds: ['2'], name: 'Energy Flash', artist: 'Joey Beltram', location: '/old/b.mp3', to: '/Music/b.mp3', confidence: 0.92 },
  ],
  setAside: [
    { trackIds: ['3'], name: 'Unsure', artist: 'Someone', location: '/old/c.mp3', why: 'Best match is 61 %' },
  ],
};

const renderStep = (plan: StepPlan, over: Partial<React.ComponentProps<typeof StepScreen>> = {}) => {
  const props = {
    plan, playerName: 'CDJ-2000', busy: false, progress: null, error: null,
    onConfirm: vi.fn(), onSkip: vi.fn(), onContinue: vi.fn(), onCancel: vi.fn(), onOpenAdvanced: vi.fn(),
    ...over,
  };
  render(<StepScreen {...props} />);
  return props;
};

describe('StepScreen', () => {
  it('shows the title, the count, the list and a confirm that applies the plan', () => {
    const props = renderStep(relocate);
    expect(screen.getByRole('heading', { name: 'Find moved tracks' })).toBeInTheDocument();
    expect(screen.getByText(/2 tracks were found in a new place/)).toBeInTheDocument();
    expect(screen.getByText('Strings of Life — Rhythim Is Rhythim')).toBeInTheDocument();
    expect(screen.getByText('/Music/b.mp3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Relocate 2 tracks' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('lists the set-aside cases with a button to the matching Advanced page', () => {
    const props = renderStep(relocate);
    expect(screen.getByRole('heading', { name: 'Check these yourself' })).toBeInTheDocument();
    expect(screen.getByText('Best match is 61 %')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Track Relocation' }));
    expect(props.onOpenAdvanced).toHaveBeenCalledWith('/relocate');
  });

  it('skip is offered beside the confirm', () => {
    const props = renderStep(relocate);
    fireEvent.click(screen.getByRole('button', { name: 'Skip this step' }));
    expect(props.onSkip).toHaveBeenCalled();
  });

  it('a plan with only set-aside cases shows Continue and no confirm', () => {
    const props = renderStep({ ...relocate, apply: [] });
    expect(screen.queryByRole('button', { name: /Relocate/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(props.onContinue).toHaveBeenCalled();
  });

  it('while applying shows progress with a cancel instead of the confirm', () => {
    const props = renderStep(relocate, {
      busy: true,
      progress: { operationId: 'x', step: 'relocate', current: 1, total: 2, message: 'Writing the library' },
    });
    expect(screen.getByText('Writing the library')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Relocate 2 tracks' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it('a gather the plan refused cannot be confirmed and says why', () => {
    renderStep({
      step: 'gather',
      moves: [{ trackIds: ['1'], name: 'a.wav', from: '/Volumes/X/a.wav', to: '/Music/X/a.wav', crossDrive: true, reuseExisting: false, bytes: 10 }],
      unplugged: [], bytesCrossDrive: 10, freeBytes: 0, refusal: 'Not enough free space on your music drive',
    });
    expect(screen.getByText('Not enough free space on your music drive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move 1 file' })).toBeDisabled();
  });
});

describe('describePlan', () => {
  it('uses the exact step titles', () => {
    expect(stepTitle('relocate', 'X')).toBe('Find moved tracks');
    expect(stepTitle('remove', 'X')).toBe("Remove entries that can't be found");
    expect(stepTitle('duplicates', 'X')).toBe('Merge duplicates');
    expect(stepTitle('gather', 'X')).toBe('Move everything into your music folder');
    expect(stepTitle('convert', 'CDJ-2000')).toBe('Make every track play on your CDJ-2000');
  });

  it('lists unplugged drives under the gather step as set aside', () => {
    const text = describePlan({
      step: 'gather', moves: [], unplugged: [{ drive: 'USB1', count: 4 }], bytesCrossDrive: 0, freeBytes: 0,
    }, 'X');
    expect(text.setAside).toEqual([expect.objectContaining({ primary: 'Plug in USB1 to include these', note: '4 tracks' })]);
  });

  it('counts duplicate entries and files to trash, leaving out merges with nothing to remove', () => {
    const text = describePlan({
      step: 'duplicates',
      merges: [
        { keepId: 'k1', removeIds: ['r1', 'r2'], keepName: 'A', artist: 'B', trashPaths: ['/x.mp3'] },
        { keepId: 'k2', removeIds: [], keepName: 'C', artist: '', trashPaths: [] },
      ],
      setAside: [],
    }, 'X');
    expect(text.items).toHaveLength(1);
    expect(text.lead).toBe('1 track has duplicates. 2 entries will be merged into the one with the most cues and playlists. 1 extra file goes to the Trash.');
    expect(text.confirmLabel).toBe('Merge 1 track');
  });

  it('counts the tracks a conversion switches, not the files', () => {
    const text = describePlan({
      step: 'convert',
      items: [{ trackIds: ['1', '2'], from: '/a.flac', to: '/a.aiff', readiness: 'ready', out: {} as never }],
      setAside: [],
      ffmpeg: { state: 'ready', path: '/ff' },
    }, 'CDJ-2000');
    expect(text.confirmLabel).toBe('Convert 2 tracks');
  });
});
