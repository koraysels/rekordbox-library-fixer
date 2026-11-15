/**
 * The shapes the wizard's planners and apply services share with the renderer.
 * Plain data only: a plan crosses the bridge, is shown to the user, and comes
 * back to be applied.
 */
import type { ConvertPreviewItem } from '../ipcContract';
import type { FfmpegStatus } from '../convert/ffmpegBinary';

export type WizardStepId = 'relocate' | 'remove' | 'duplicates' | 'gather' | 'convert';
export const STEP_ORDER: WizardStepId[] = ['relocate', 'remove', 'duplicates', 'gather', 'convert'];

export interface WizardTrackRef { trackIds: string[]; name: string; artist: string; location: string }

/** Something the wizard will not decide: listed under "check these yourself". */
export interface SetAsideItem extends WizardTrackRef { why: string; bestGuess?: { path: string; confidence: number } }

export interface WizardCheck {
  libraryPath: string;
  checkedAt: string;
  missing: number;
  duplicates: number;
  outsideFolder: number;
  unplayable: number;
  unpluggedDrives: string[];
}

export interface RelocateStepPlan { step: 'relocate'; apply: Array<WizardTrackRef & { to: string; confidence: number }>; setAside: SetAsideItem[] }
export interface RemoveStepPlan { step: 'remove'; remove: WizardTrackRef[]; setAside: SetAsideItem[] }
export interface DuplicateMerge { keepId: string; removeIds: string[]; keepName: string; artist: string; trashPaths: string[] }
export interface DuplicatesStepPlan { step: 'duplicates'; merges: DuplicateMerge[]; setAside: SetAsideItem[] }
export interface GatherMove { trackIds: string[]; name: string; from: string; to: string; crossDrive: boolean; reuseExisting: boolean; bytes: number }
export interface GatherStepPlan {
  step: 'gather';
  moves: GatherMove[];
  unplugged: Array<{ drive: string; count: number }>;
  bytesCrossDrive: number;
  freeBytes: number;
  refusal?: string;
}
export interface ConvertStepPlan { step: 'convert'; items: ConvertPreviewItem[]; setAside: SetAsideItem[]; ffmpeg: FfmpegStatus }
export type StepPlan = RelocateStepPlan | RemoveStepPlan | DuplicatesStepPlan | GatherStepPlan | ConvertStepPlan;

export interface StepDetail {
  action: 'relocated' | 'removed' | 'merged' | 'trashed' | 'moved' | 'copied' | 'converted' | 'failed';
  trackName?: string;
  from?: string;
  to?: string;
  error?: string;
}
export interface StepResult { step: WizardStepId; changed: number; backupPath?: string; details: StepDetail[]; cancelled: boolean; error?: string }
