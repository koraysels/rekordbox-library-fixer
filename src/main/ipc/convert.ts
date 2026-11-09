import { app, ipcMain, net, shell } from 'electron';
import { safeConsole, sendToWindow } from '../runtime';
import { findUnplayable, preflightRefusal, previewConversion, runConversion } from '../convert/conversionRun';
import { ffmpegStatus, installFfmpeg } from '../convert/ffmpegBinary';
import { RunRegistry } from '../convert/runRegistry';
import type {
  ConvertCandidate, ConvertPreviewItem, ConvertRunPayload, ConvertRunResult, FfmpegInstallProgress,
  FfmpegStatus, IpcResult, PlayerProfileId, TargetFormat, TrackPayload,
} from '../ipcContract';

const runs = new RunRegistry();
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Unknown error occurred');
const status = (): FfmpegStatus => ffmpegStatus(app.getPath('userData'), process.platform, process.arch);

/**
 * Converting files the player cannot play. ffmpeg is only ever downloaded when
 * the renderer asks for it with 'install-ffmpeg' — that is where the consent is.
 */
export function registerConvertIpc(): void {
  ipcMain.handle('find-unplayable', async (_e, data: { tracks: TrackPayload[]; profileId: PlayerProfileId }):
    Promise<IpcResult<ConvertCandidate[]>> => {
    try {
      const tracks = new Map(data.tracks.map(t => [t.id, t]));
      return { success: true, data: await findUnplayable({ tracks }, data.profileId) };
    } catch (error) {
      return { success: false, error: errorText(error) };
    }
  });

  ipcMain.handle('preview-conversion', async (_e, data: {
    candidates: ConvertCandidate[]; profileId: PlayerProfileId; target: TargetFormat;
  }): Promise<IpcResult<ConvertPreviewItem[]>> => {
    try {
      return { success: true, data: await previewConversion(data.candidates, data.profileId, data.target) };
    } catch (error) {
      return { success: false, error: errorText(error) };
    }
  });

  ipcMain.handle('get-ffmpeg-status', async (): Promise<FfmpegStatus> => status());

  ipcMain.handle('install-ffmpeg', async (): Promise<IpcResult<{ path: string }>> => {
    try {
      const file = await installFfmpeg(
        app.getPath('userData'), process.platform, process.arch,
        (percent) => sendToWindow('ffmpeg-install-progress', { percent } satisfies FfmpegInstallProgress),
        // Electron's net honours the system proxy settings; Node's fetch does not.
        net.fetch as unknown as typeof fetch,
      );
      return { success: true, data: { path: file } };
    } catch (error) {
      safeConsole.error('❌ ffmpeg install failed:', error);
      return { success: false, error: errorText(error) };
    }
  });

  ipcMain.handle('run-conversion', async (_e, data: ConvertRunPayload): Promise<IpcResult<ConvertRunResult>> => {
    const operationId = data.operationId ?? `convert-${Date.now()}`;
    let controller: AbortController | undefined;
    try {
      // Registered before the checks, so a cancel sent meanwhile is not lost.
      controller = runs.begin(operationId);
      const ff = status();
      if (ff.state !== 'ready') {
        throw new Error('ffmpeg is not installed yet — install it before converting.');
      }
      // runConversion refuses on its own too; asked here first so the page reports it as a run
      // that never started, not as one that ran and changed nothing.
      const refusal = preflightRefusal(data);
      if (refusal) {throw new Error(refusal);}
      const { operationId: _id, ...opts } = data;
      const result = await runConversion(opts, {
        ffmpeg: ff.path,
        operationId,
        signal: controller.signal,
        emit: (p) => sendToWindow('conversion-progress', p),
        trash: (p) => shell.trashItem(p),
      });
      return { success: true, data: result };
    } catch (error) {
      // A refused second run must not report an error under the id of the run still going.
      if (controller) {
        sendToWindow('conversion-progress', {
          operationId, type: 'error', current: 0, total: data.items?.length ?? 0,
          message: errorText(error), convertedCount: 0, failedCount: 0,
        });
      }
      return { success: false, error: errorText(error) };
    } finally {
      if (controller) runs.end(operationId, controller);
    }
  });

  ipcMain.handle('cancel-conversion', async (_e, operationId: string): Promise<IpcResult> => {
    return runs.cancel(operationId) ? { success: true } : { success: false, error: 'Operation not found' };
  });
}
