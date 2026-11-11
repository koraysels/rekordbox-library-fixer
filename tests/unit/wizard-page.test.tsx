import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { StepPlan, StepResult, WizardCheck } from '../../src/main/wizard/types';

const context = {
  libraryPath: '/lib/master.db',
  libraryData: { tracks: new Map(), playlists: [] } as unknown,
  onLoadFromDb: vi.fn(),
  onUnloadLibrary: vi.fn(),
  showNotification: vi.fn(),
};
vi.mock('@renderer/AppWithRouter', () => ({ useAppContext: () => context }));

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

const wizard = {
  check: vi.fn(),
  plan: vi.fn(),
  apply: vi.fn(),
  cancel: vi.fn(),
  progress: null,
  busy: false,
  error: null as string | null,
};
vi.mock('@renderer/hooks/useWizard', () => ({ useWizard: () => wizard }));

import { WizardPage } from '@renderer/components/wizard/WizardPage';
import { useWizardStore } from '@renderer/wizard/wizardStore';
import { useSettingsStore } from '@renderer/stores/settingsStore';
import { wizardScreen, type ScreenInputs } from '@renderer/wizard/wizardScreen';

const check: WizardCheck = {
  libraryPath: '/lib/master.db', checkedAt: '2026-11-11T10:00:00.000Z',
  missing: 2, duplicates: 0, outsideFolder: 0, unplayable: 0, unpluggedDrives: [],
};
const relocatePlan: StepPlan = {
  step: 'relocate',
  apply: [{ trackIds: ['1'], name: 'Track', artist: 'Artist', location: '/old/a.mp3', to: '/Music/a.mp3', confidence: 0.95 }],
  setAside: [],
};

const running = vi.fn(async () => ({ running: false }));

beforeEach(() => {
  vi.clearAllMocks();
  context.libraryPath = '/lib/master.db';
  context.libraryData = { tracks: new Map(), playlists: [] };
  context.onLoadFromDb = vi.fn();
  wizard.error = null;
  running.mockResolvedValue({ running: false });
  Object.assign(window.electronAPI, {
    isRekordboxRunning: running,
    scanForLibraries: vi.fn(async () => []),
    getFfmpegStatus: vi.fn(async () => ({ state: 'ready', path: '/ff' })),
  });
  useWizardStore.setState({ byLibrary: {} });
  useSettingsStore.setState({ musicFolder: '/Music', appMode: 'wizard' });
  wizard.check.mockImplementation(async () => {
    useWizardStore.getState().setCheck('/lib/master.db', check);
    return check;
  });
});

describe('WizardPage', () => {
  it('an XML library gets the screen that sends it to the database or Advanced', async () => {
    context.libraryPath = '/exports/rekordbox.xml';
    render(<WizardPage isLoading={false} />);
    expect(await screen.findByText(/works on the rekordbox database/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Advanced' }));
    expect(useSettingsStore.getState().appMode).toBe('advanced');
  });

  it('a database that does not open with the key asks for the key, though loading replaced the screen meanwhile', async () => {
    context.libraryPath = '';
    context.libraryData = null;
    useSettingsStore.setState({ rekordboxDbKey: 'a'.repeat(64) });
    (window.electronAPI.scanForLibraries as ReturnType<typeof vi.fn>).mockResolvedValue([
      { kind: 'database', path: '/rb/master.db', label: 'rekordbox 7', size: 1, modified: '2026-11-11' },
    ]);
    let setLoading: (v: boolean) => void = () => undefined;
    // As useLibrary does: loading on, the library cleared, then off with the load refused.
    context.onLoadFromDb = vi.fn(async () => {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 0));
      setLoading(false);
      return false;
    });
    const Harness = () => {
      const [loading, set] = React.useState(false);
      setLoading = set;
      return <WizardPage isLoading={loading} />;
    };
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open this library' }));
    expect(await screen.findByRole('heading', { name: 'Your database needs its key' })).toBeInTheDocument();
    expect(screen.getByText(/did not open with the key/)).toBeInTheDocument();
    expect(context.onLoadFromDb).toHaveBeenCalledWith('/rb/master.db');

    // A different key is a new attempt: the failure line goes until it fails too.
    fireEvent.change(screen.getByLabelText('Database key'), { target: { value: 'b'.repeat(64) } });
    expect(screen.queryByText(/did not open with the key/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open database' }));
    expect(await screen.findByText(/did not open with the key/)).toBeInTheDocument();
    expect(context.onLoadFromDb).toHaveBeenCalledTimes(2);
  });

  it('rekordbox running shows the close screen', async () => {
    running.mockResolvedValue({ running: true });
    render(<WizardPage isLoading={false} />);
    expect(await screen.findByRole('heading', { name: 'Close rekordbox to continue' })).toBeInTheDocument();
  });

  it('with no saved check offers only "Check my library"', async () => {
    render(<WizardPage isLoading={false} />);
    expect(await screen.findByRole('button', { name: 'Check my library' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start fixing/ })).toBeNull();
  });

  it('a saved check from before is shown, but continuing means checking again', async () => {
    useWizardStore.getState().setCheck('/lib/master.db', check);
    render(<WizardPage isLoading={false} />);
    expect(await screen.findByRole('button', { name: 'Check again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start fixing/ })).toBeNull();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('no music folder sends the user to setup: the player first, then the folder', async () => {
    useSettingsStore.setState({ musicFolder: '' });
    (window.electronAPI.selectFolder as ReturnType<typeof vi.fn>).mockResolvedValue('/Users/dj/Music');
    render(<WizardPage isLoading={false} />);
    expect(await screen.findByRole('heading', { name: 'Which player do you play on?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choose music folder' }));
    await waitFor(() => expect(useSettingsStore.getState().musicFolder).toBe('/Users/dj/Music'));
    expect(await screen.findByRole('button', { name: 'Check my library' })).toBeInTheDocument();
  });

  it('the summary shows the music folder and changes it; a changed folder needs a new check', async () => {
    (window.electronAPI.selectFolder as ReturnType<typeof vi.fn>).mockResolvedValue('/Volumes/SSD/Music');
    render(<WizardPage isLoading={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check my library' }));
    expect(await screen.findByRole('button', { name: /Start fixing/ })).toBeInTheDocument();
    expect(screen.getByTitle('/Music')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    await waitFor(() => expect(useSettingsStore.getState().musicFolder).toBe('/Volumes/SSD/Music'));
    expect(await screen.findByTitle('/Volumes/SSD/Music')).toBeInTheDocument();
    // What is outside the folder was counted against the old one.
    expect(screen.queryByRole('button', { name: /Start fixing/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });

  it('a write refused because rekordbox opened shows the close screen', async () => {
    wizard.plan.mockResolvedValue(relocatePlan);
    wizard.apply.mockImplementation(async () => {
      running.mockResolvedValue({ running: true });
      return { step: 'relocate', changed: 0, details: [], cancelled: false, error: 'Close rekordbox to continue' } satisfies StepResult;
    });
    render(<WizardPage isLoading={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check my library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start fixing' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Relocate 1 track' }));
    expect(await screen.findByRole('heading', { name: 'Close rekordbox to continue' })).toBeInTheDocument();
  });

  it('converting without ffmpeg asks first, with the download size', async () => {
    const convertCheck: WizardCheck = { ...check, missing: 0, unplayable: 1 };
    wizard.check.mockImplementation(async () => {
      useWizardStore.getState().setCheck('/lib/master.db', convertCheck);
      return convertCheck;
    });
    const convertPlan: StepPlan = {
      step: 'convert',
      items: [{ trackIds: ['1'], from: '/Music/a.flac', to: '/Music/a.aiff', readiness: 'ready', out: {} as never }],
      setAside: [],
      ffmpeg: { state: 'missing', sizeBytes: 80 * 1024 * 1024 },
    };
    wizard.plan.mockResolvedValue(convertPlan);
    wizard.apply.mockResolvedValue({ step: 'convert', changed: 1, details: [], cancelled: false } satisfies StepResult);
    const install = vi.fn(async () => ({ success: true, data: { path: '/ff' } }));
    Object.assign(window.electronAPI, { installFfmpeg: install, onFfmpegInstallProgress: vi.fn(() => () => undefined) });

    render(<WizardPage isLoading={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check my library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start fixing' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Convert 1 track' }));
    expect(wizard.apply).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Download ffmpeg (80 MB) and convert' }));
    await waitFor(() => expect(wizard.apply).toHaveBeenCalledWith({ ...convertPlan, ffmpeg: { state: 'ready', path: '/ff' } }));
    expect(install).toHaveBeenCalled();
  });

  it('check, start, then the step screen confirm applies the plan', async () => {
    wizard.plan.mockResolvedValue(relocatePlan);
    wizard.apply.mockResolvedValue({ step: 'relocate', changed: 1, details: [], cancelled: false } satisfies StepResult);
    render(<WizardPage isLoading={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check my library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start fixing' }));
    expect(wizard.plan).toHaveBeenCalledWith('relocate');
    fireEvent.click(await screen.findByRole('button', { name: 'Relocate 1 track' }));
    await waitFor(() => expect(wizard.apply).toHaveBeenCalledWith(relocatePlan));
  });

  it('a step with nothing to do and nothing set aside is skipped without a screen', async () => {
    wizard.plan.mockImplementation(async (step: string) => (
      step === 'relocate'
        ? { step: 'relocate', apply: [], setAside: [] }
        : { step: 'remove', remove: [{ trackIds: ['9'], name: 'Gone', artist: '', location: '/x.mp3' }], setAside: [] }
    ));
    render(<WizardPage isLoading={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check my library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start fixing' }));
    expect(await screen.findByRole('button', { name: 'Remove 1 entry' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Remove entries that can't be found" })).toBeInTheDocument();
    expect(wizard.plan).toHaveBeenCalledWith('remove');
    expect(useWizardStore.getState().byLibrary['/lib/master.db'].done).toContain('relocate');
  });

  it('when every step is done it says to sync the USB sticks', async () => {
    // Both steps empty: relocate and remove.
    wizard.plan.mockImplementation(async (step: string) => (
      step === 'relocate' ? { step: 'relocate', apply: [], setAside: [] } : { step: 'remove', remove: [], setAside: [] }
    ));
    render(<WizardPage isLoading={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check my library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start fixing' }));
    expect(await screen.findByText('Sync your USB sticks from rekordbox so they get these changes.')).toBeInTheDocument();
  });
});

describe('wizardScreen', () => {
  const base: ScreenInputs = {
    isLoading: false, libraryPath: '/lib/master.db', hasLibrary: true, musicFolder: '/Music',
    choosingDatabase: false, rekordboxRunning: false, phase: 'summary', nextStep: undefined,
  };

  it('gates in order: library, XML, music folder, rekordbox, then the flow', () => {
    expect(wizardScreen({ ...base, libraryPath: '', hasLibrary: false })).toBe('setup');
    expect(wizardScreen({ ...base, libraryPath: '/a.xml', musicFolder: '' })).toBe('xml');
    expect(wizardScreen({ ...base, libraryPath: '/a.xml', choosingDatabase: true })).toBe('setup');
    expect(wizardScreen({ ...base, musicFolder: '' })).toBe('setup');
    expect(wizardScreen({ ...base, rekordboxRunning: true })).toBe('close');
    expect(wizardScreen({ ...base, rekordboxRunning: null })).toBe('loading');
    expect(wizardScreen(base)).toBe('summary');
    expect(wizardScreen({ ...base, phase: 'steps', nextStep: 'gather' })).toBe('step');
    expect(wizardScreen({ ...base, phase: 'steps' })).toBe('done');
  });

  it('a reload after a write shows loading, not setup', () => {
    expect(wizardScreen({ ...base, isLoading: true, hasLibrary: false })).toBe('loading');
  });
});
