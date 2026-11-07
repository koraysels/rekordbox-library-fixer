import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Progress {
  type: string;
  current: number;
  total: number;
  successCount?: number;
  message: string;
}

/**
 * A running auto-relocation, shown on the page once its dialog is hidden.
 * Without it the only sign of a run writing thousands of tracks was a spinner
 * in the Apply button, and the list looked as if nothing had happened.
 */
export const AutoRelocateStatus: React.FC<{ running: boolean; onShow: () => void }> = ({ running, onShow }) => {
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    if (!running) { setProgress(null); return; }
    return window.electronAPI.onAutoRelocateProgress((p: Progress) => setProgress(p));
  }, [running]);

  if (!running) { return null; }

  const writing = progress?.type === 'updating-xml';
  const text = !progress
    ? 'Auto-relocating…'
    : writing
    ? progress.message
    : `Searching ${progress.current} / ${progress.total} · ${progress.successCount ?? 0} found`;

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
