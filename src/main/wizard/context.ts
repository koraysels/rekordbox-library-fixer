import type { PlayerProfileId } from '../ipcContract';
import type { WizardStepId } from './types';

export interface WizardProgress {
  operationId: string;
  step: WizardStepId | 'check';
  current: number;
  total: number;
  message: string;
}

/** What one wizard call works on, and how it reports back. */
export interface WizardContext {
  operationId: string;
  dbPath: string;
  key: string;
  musicFolder: string;
  profileId: PlayerProfileId;
  /** The Relocate page's search folders; the music folder is always searched first. */
  searchPaths: string[];
  signal: AbortSignal;
  onProgress: (p: WizardProgress) => void;
}

export const CANCELLED = 'Cancelled';

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) {throw new Error(CANCELLED);}
}

export function reportProgress(
  ctx: WizardContext, step: WizardProgress['step'], current: number, total: number, message: string,
): void {
  ctx.onProgress({ operationId: ctx.operationId, step, current, total, message });
}
