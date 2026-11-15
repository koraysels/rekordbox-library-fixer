/**
 * Where the wizard is, for the sidebar's step list. The wizard page publishes
 * what it knows; the sidebar only draws it. Pure apart from the tiny store, so
 * the states can be tested without rendering.
 */
import { create } from 'zustand';
import { STEP_ORDER, type WizardCheck, type WizardStepId } from '../../main/wizard/types';
import type { WizardPhase, WizardScreen } from './wizardScreen';

export type SidebarItemId = 'setup' | 'check' | WizardStepId | 'finish';
export type SidebarItemState = 'done' | 'current' | 'upcoming' | 'skipped' | 'nothing';

export interface SidebarItem {
  id: SidebarItemId;
  label: string;
  state: SidebarItemState;
  /** How many tracks the last check found for this step. */
  count?: number;
}

export interface WizardProgressInput {
  screen: WizardScreen;
  phase: WizardPhase;
  /** Library open, a database, and a music folder chosen. */
  setupDone: boolean;
  check: WizardCheck | undefined;
  /** The steps of the run under way; a step outside it has nothing to do. */
  runSteps: WizardStepId[];
  done: WizardStepId[];
  skipped: WizardStepId[];
  nextStep: WizardStepId | undefined;
}

/** Short enough for the sidebar; the step screen itself says it in full. */
export const STEP_LABEL: Record<WizardStepId, string> = {
  relocate: 'Find moved tracks',
  remove: 'Remove dead entries',
  duplicates: 'Merge duplicates',
  gather: 'Gather into folder',
  convert: 'Convert for player',
};

const COUNT: Record<WizardStepId, (c: WizardCheck) => number> = {
  relocate: (c) => c.missing,
  remove: (c) => c.missing,
  duplicates: (c) => c.duplicates,
  gather: (c) => c.outsideFolder,
  convert: (c) => c.unplayable,
};

export function wizardSidebarItems(p: WizardProgressInput): SidebarItem[] {
  const inSetup = !p.setupDone;
  const stepping = p.phase === 'steps' && !inSetup;
  const finished = stepping && p.screen === 'done';

  const setup: SidebarItem = { id: 'setup', label: 'Set up', state: inSetup ? 'current' : 'done' };
  const check: SidebarItem = {
    id: 'check',
    label: 'Check library',
    state: inSetup ? 'upcoming' : stepping ? 'done' : 'current',
  };

  const steps = STEP_ORDER.map((id): SidebarItem => {
    const label = STEP_LABEL[id];
    if (inSetup || !p.check) {return { id, label, state: 'upcoming' };}
    const count = COUNT[id](p.check);
    if (p.done.includes(id)) {return { id, label, state: 'done', count };}
    if (p.skipped.includes(id)) {return { id, label, state: 'skipped', count };}
    if (!p.runSteps.includes(id)) {return { id, label, state: 'nothing' };}
    if (stepping && id === p.nextStep) {return { id, label, state: 'current', count };}
    return { id, label, state: 'upcoming', count };
  });

  const finish: SidebarItem = { id: 'finish', label: 'Finish', state: finished ? 'current' : 'upcoming' };
  return [setup, check, ...steps, finish];
}

interface ProgressState {
  items: SidebarItem[] | null;
  setItems: (items: SidebarItem[] | null) => void;
}

/** Not persisted: it only mirrors the wizard page while it is on screen. */
export const useWizardProgressStore = create<ProgressState>()((set) => ({
  items: null,
  setItems: (items) => set({ items }),
}));
