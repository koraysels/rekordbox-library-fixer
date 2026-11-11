/**
 * Which screen the wizard shows. Pure, so the order of the gates — library,
 * music folder, rekordbox closed — is tested without rendering.
 */
import type { WizardStepId } from '../../main/wizard/types';

export type WizardScreen = 'loading' | 'setup' | 'xml' | 'close' | 'summary' | 'step' | 'done';
export type WizardPhase = 'summary' | 'steps';

export interface ScreenInputs {
  isLoading: boolean;
  libraryPath: string;
  hasLibrary: boolean;
  musicFolder: string;
  /** The user asked to open a database from the XML screen. */
  choosingDatabase: boolean;
  /** null: not known yet. */
  rekordboxRunning: boolean | null;
  phase: WizardPhase;
  nextStep: WizardStepId | undefined;
}

export const isDatabasePath = (p: string) => p.toLowerCase().endsWith('.db');

export function wizardScreen(s: ScreenInputs): WizardScreen {
  if (s.isLoading && !s.hasLibrary) {return 'loading';}
  if (!s.libraryPath || !s.hasLibrary) {return 'setup';}
  if (!isDatabasePath(s.libraryPath)) {return s.choosingDatabase ? 'setup' : 'xml';}
  if (!s.musicFolder) {return 'setup';}
  if (s.rekordboxRunning === null) {return 'loading';}
  if (s.rekordboxRunning) {return 'close';}
  if (s.phase === 'summary') {return 'summary';}
  return s.nextStep ? 'step' : 'done';
}
