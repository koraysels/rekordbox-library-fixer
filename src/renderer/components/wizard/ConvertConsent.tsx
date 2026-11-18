import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { WizardFrame, ErrorLine } from './WizardFrame';
import { ProgressBar } from '../ui/ProgressBar';

interface Props {
  sizeBytes: number;
  /** Called once ffmpeg is in place, with where it is; the conversion starts from there. */
  onInstalled: (path: string) => void;
  onBack: () => void;
}

/**
 * ffmpeg is downloaded only after the DJ agreed to it, with its size, the way
 * the Convert page asks. It is not shipped with the app.
 */
export const ConvertConsent: React.FC<Props> = ({ sizeBytes, onInstalled, onBack }) => {
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mb = Math.round(sizeBytes / (1024 * 1024));

  const install = async () => {
    setError(null);
    setPercent(0);
    const stop = window.electronAPI.onFfmpegInstallProgress((p) => setPercent(p.percent));
    try {
      const installed = await window.electronAPI.installFfmpeg();
      if (!installed.success) {
        setError(`Could not download ffmpeg: ${installed.error ?? 'unknown error'}`);
        return;
      }
      onInstalled(installed.data?.path ?? '');
    } catch (e) {
      setError(`Could not download ffmpeg: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      stop();
      setPercent(null);
    }
  };

  const downloading = percent !== null;
  return (
    <WizardFrame
      title="Converting needs ffmpeg"
      lead={`The app converts with ffmpeg, a free audio tool. It isn't on this computer yet: it is a one-time download of ${mb} MB, checked before it is used.`}
      actions={downloading ? undefined : (
        <>
          <button type="button" className="btn-primary flex items-center gap-2" onClick={() => void install()}>
            <Download className="w-4 h-4" />
            {`Download ffmpeg (${mb} MB) and convert`}
          </button>
          <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
        </>
      )}
    >
      {downloading && (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm font-te-mono normal-case text-te-grey-800">Downloading ffmpeg… {percent}%</p>
          <ProgressBar label="Downloading ffmpeg" value={percent} />
        </div>
      )}
      <ErrorLine message={error} />
    </WizardFrame>
  );
};
