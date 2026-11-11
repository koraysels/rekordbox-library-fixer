import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ConvertProgress } from '../../../main/ipcContract';

/**
 * A running conversion, shown on the page once its dialog is hidden — a run over
 * hundreds of files takes long enough that the DJ wants to leave the dialog and
 * still see that something is happening.
 */
export const ConvertStatus: React.FC<{
  running: boolean;
  progress: ConvertProgress | null;
  installPercent: number | null;
  onShow: () => void;
}> = ({ running, progress, installPercent, onShow }) => {
  if (!running) { return null; }
  const text = installPercent !== null
    ? `Downloading ffmpeg… ${Math.round(installPercent)}%`
    : progress
    ? progress.type === 'writing' ? progress.message : `Converting ${progress.current} / ${progress.total} · ${progress.convertedCount} done`
    : 'Converting…';
  return (
    <div role="status" className="flex-shrink-0 mx-4 mt-3 px-3 py-2 rounded-te border border-te-orange/40 bg-te-cream flex items-center gap-2">
      <Loader2 className="w-4 h-4 text-te-orange animate-spin" />
      <p className="flex-1 text-xs font-te-mono normal-case te-value">
        {text}
        <span className="te-label"> — the list updates when it finishes.</span>
      </p>
      <button type="button" onClick={onShow} className="btn-secondary text-xs">Show progress</button>
    </div>
  );
};
