import React, { useState } from 'react';
import { Info } from 'lucide-react';

/** Both tools copy or move files, and both can meet a file already there. */
export type ConflictResolution = 'skip' | 'overwrite' | 'quality';
export type Mode = 'copy' | 'move';
export type Phase = 'idle' | 'previewing' | 'previewed' | 'running' | 'done' | 'cancelled';

export interface Progress {
  current: number;
  total: number;
  currentFile: string;
  succeeded: number;
  skipped: number;
  failed: number;
}

export interface Result {
  succeeded: number;
  skipped: number;
  failed: number;
  errors: { file: string; error: string }[];
}

/**
 * What "keep the better file" means when a copy already exists at the
 * destination. Spelled out next to the option rather than in a tooltip,
 * because it decides which of two files survives.
 */
export const QualityInfo: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-te-grey-400 hover:text-te-orange focus:outline-none"
        aria-label="Quality scoring info"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className="absolute z-50 left-5 top-0 w-64 bg-white border border-te-grey-200 rounded-te shadow-lg p-3 text-xs font-te-mono text-te-grey-700 space-y-1"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="font-semibold text-te-grey-800 mb-1">Quality scoring</div>
          <div><span className="text-green-600 font-semibold">WAV / AIFF</span> — always top tier</div>
          <div><span className="text-blue-600 font-semibold">FLAC</span> — top tier only when "Prefer FLAC" is on</div>
          <div><span className="text-te-grey-500 font-semibold">MP3 / AAC / OGG</span> — scored by bitrate &amp; size</div>
        </div>
      )}
    </span>
  );
};

