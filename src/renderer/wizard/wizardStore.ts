import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WizardCheck, WizardStepId } from '../../main/wizard/types';

/** The last check of one library and the steps finished since it. */
export interface SavedWizardRun { check: WizardCheck; done: WizardStepId[] }

interface WizardState {
  byLibrary: Record<string, SavedWizardRun>;
  /** A new check starts over: no step counts as done against it. */
  setCheck: (libraryPath: string, check: WizardCheck) => void;
  /** The check made again between steps: the numbers change, the steps already finished stay finished. */
  updateCheck: (libraryPath: string, check: WizardCheck) => void;
  markDone: (libraryPath: string, step: WizardStepId) => void;
  reset: (libraryPath: string) => void;
}

/**
 * The wizard's saved result per library, so reopening the app shows the last
 * check instead of scanning by itself. Continuing still checks again first.
 */
export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      byLibrary: {},
      setCheck: (libraryPath, check) => set((s) => ({
        byLibrary: { ...s.byLibrary, [libraryPath]: { check, done: [] } },
      })),
      updateCheck: (libraryPath, check) => set((s) => ({
        byLibrary: { ...s.byLibrary, [libraryPath]: { check, done: s.byLibrary[libraryPath]?.done ?? [] } },
      })),
      markDone: (libraryPath, step) => set((s) => {
        const run = s.byLibrary[libraryPath];
        if (!run || run.done.includes(step)) {return s;}
        return { byLibrary: { ...s.byLibrary, [libraryPath]: { ...run, done: [...run.done, step] } } };
      }),
      reset: (libraryPath) => set((s) => {
        const rest = { ...s.byLibrary };
        delete rest[libraryPath];
        return { byLibrary: rest };
      }),
    }),
    { name: 'rekordbox-wizard', partialize: (s) => ({ byLibrary: s.byLibrary }) },
  ),
);
