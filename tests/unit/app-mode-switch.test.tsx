import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn(),
  Outlet: () => <div>advanced page</div>,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@renderer/hooks', async (orig) => ({
  ...(await orig<typeof import('@renderer/hooks')>()),
  useLibrary: () => ({
    libraryPath: '/lib/master.db',
    libraryData: { tracks: new Map(), playlists: [] },
    isLoading: false,
    startupComplete: true,
    selectLibrary: vi.fn(),
    loadLibrary: vi.fn(),
    loadFromDb: vi.fn(),
    clearStoredData: vi.fn(),
    setLibraryData: vi.fn(),
  }),
}));
vi.mock('@renderer/hooks/useRouteData', () => ({ useRouteData: () => ({ isLoading: false }) }));
vi.mock('@renderer/hooks/usePersistedDbKey', () => ({ usePersistedDbKey: () => undefined }));
vi.mock('@renderer/components/ui', async (orig) => ({
  ...(await orig<typeof import('@renderer/components/ui')>()),
  AppFooter: () => null,
  MiniPlayer: () => null,
  NativeDropHandler: () => null,
  AboutModal: () => null,
  TutorialModal: () => null,
}));
vi.mock('@renderer/components/wizard/WizardPage', () => ({ WizardPage: () => <div>wizard page</div> }));

import AppWithRouter from '@renderer/AppWithRouter';
import { useSettingsStore } from '@renderer/stores/settingsStore';

beforeEach(() => {
  useSettingsStore.setState({ appMode: 'wizard' });
});

describe('the mode switch', () => {
  it('wizard mode shows the wizard full-window, without the sidebar', () => {
    render(<AppWithRouter />);
    expect(screen.getByText('wizard page')).toBeInTheDocument();
    expect(screen.queryByText('Duplicate Detection')).toBeNull();
  });

  it('the Advanced switch shows the sidebar and the pages, and is remembered', () => {
    render(<AppWithRouter />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(useSettingsStore.getState().appMode).toBe('advanced');
    expect(screen.getByText('Duplicate Detection')).toBeInTheDocument();
    expect(screen.getByText('advanced page')).toBeInTheDocument();
    expect(screen.queryByText('wizard page')).toBeNull();
  });

  it('the sidebar switches back to the wizard', () => {
    useSettingsStore.setState({ appMode: 'advanced' });
    render(<AppWithRouter />);
    fireEvent.click(screen.getByRole('button', { name: 'Wizard' }));
    expect(useSettingsStore.getState().appMode).toBe('wizard');
    expect(screen.getByText('wizard page')).toBeInTheDocument();
  });
});
