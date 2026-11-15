import type { RunDeps } from '../convert/conversionRun';
import type { FfmpegStatus } from '../convert/ffmpegBinary';
import type { ConvertProgress } from '../ipcContract';

export const FFMPEG_NOT_READY = 'ffmpeg is not installed yet — install it before converting.';

export interface ConvertDepsInput {
  ffmpeg: FfmpegStatus;
  operationId: string;
  signal: AbortSignal;
  emit: (p: ConvertProgress) => void;
  /** Move a file to the OS Trash. */
  trash: (p: string) => Promise<void>;
}

/**
 * What `runConversion` needs from its caller, built one way for the Convert page
 * and the wizard. Throws when ffmpeg is not installed: it is only ever
 * downloaded when the user agrees to it, so a run never starts without it.
 */
export function convertDeps(input: ConvertDepsInput): RunDeps {
  if (input.ffmpeg.state !== 'ready') {throw new Error(FFMPEG_NOT_READY);}
  return {
    ffmpeg: input.ffmpeg.path,
    operationId: input.operationId,
    signal: input.signal,
    emit: input.emit,
    trash: input.trash,
  };
}
