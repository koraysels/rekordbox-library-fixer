import React from 'react';
import { Loader2, StopCircle } from 'lucide-react';
import type { ConvertProgress } from '../../../main/ipcContract';

interface Props {
  isOpen: boolean;
  progress: ConvertProgress | null;
  installPercent: number | null;
  onHide: () => void;
  onCancel: () => void;
}

/** Shown while a run is going. It closes itself when the run ends; Hide keeps the run and shows a strip on the page. */
export const ConvertProgressDialog: React.FC<Props> = ({ isOpen, progress, installPercent, onHide, onCancel }) => {
  const [cancelling, setCancelling] = React.useState(false);
  if (!isOpen) { return null; }
  const installing = installPercent !== null;
  const percent = installing
    ? Math.round(installPercent)
    : progress && progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-label="Converting tracks">
      <div className="bg-te-grey-800 rounded-te-lg shadow-2xl w-[520px] max-w-[92vw] border-2 border-te-grey-700">
        <div className="p-4 border-b-2 border-te-grey-700 bg-te-grey-900">
          <h2 className="text-xl font-semibold text-te-cream font-te-display tracking-te-display uppercase">
            {installing ? 'Downloading ffmpeg' : 'Converting Tracks'}
          </h2>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex justify-between text-sm text-te-grey-400 font-te-mono">
            <span>{installing ? 'ffmpeg' : `${progress?.current ?? 0} / ${progress?.total ?? 0} files`}</span>
            <span>{percent}%</span>
          </div>
          <div className="w-full bg-te-grey-700 rounded-full h-3 overflow-hidden border border-te-grey-600">
            <div className="bg-te-orange h-full transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
          <div className="p-3 bg-te-grey-700 rounded-te border border-te-grey-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-te-orange animate-spin flex-shrink-0" />
            <span className="text-sm text-te-cream font-te-mono normal-case break-all">
              {installing ? 'Fetching the converter you agreed to…' : progress?.message ?? 'Starting…'}
            </span>
          </div>
          {progress && !installing && (
            <p className="text-xs text-te-grey-400 font-te-mono normal-case">
              {progress.convertedCount} converted · {progress.failedCount} failed
            </p>
          )}
        </div>
        <div className="p-4 border-t-2 border-te-grey-700 bg-te-grey-900 flex justify-end gap-2">
          <button
            onClick={onHide}
            className="px-4 py-2 bg-te-grey-700 hover:bg-te-grey-600 text-te-cream rounded-te border-2 border-te-grey-600 font-te-mono text-sm"
            title="Keep it running and watch it from the page"
          >
            Hide
          </button>
          <button
            onClick={() => { setCancelling(true); onCancel(); }}
            disabled={cancelling || installing}
            className="px-4 py-2 bg-te-red-500 hover:bg-te-red-600 disabled:bg-te-grey-600 disabled:cursor-not-allowed text-te-cream rounded-te border-2 border-te-red-500 flex items-center gap-2 font-te-mono text-sm"
          >
            <StopCircle className="w-4 h-4" />
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
