import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  filePaths: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ filePaths, onConfirm, onCancel }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [typed, setTyped] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-te shadow-xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-te-red-50 border-b border-te-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-te-red-500" />
            <span className="font-semibold text-te-red-500 font-te-mono text-sm uppercase tracking-wider">
              Permanent deletion — step {step} of 3
            </span>
          </div>
          <button onClick={onCancel} className="text-te-grey-400 hover:text-te-grey-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5">

          {step === 1 && (
            <>
              <p className="text-te-grey-800 font-semibold mb-2">
                You are about to permanently delete {filePaths.length} file{filePaths.length !== 1 ? 's' : ''} from disk.
              </p>
              <p className="text-sm text-te-grey-600 font-te-mono mb-4">
                This removes the actual audio files — WAV, FLAC, AIFF, MP3 — from your hard drive.
                The XML will already have been cleaned. <span className="text-te-red-500 font-semibold">This cannot be undone.</span>
              </p>
              <div className="bg-te-red-50 border border-te-red-200 rounded-te p-3 text-sm text-te-red-500 font-te-mono mb-5">
                A backup of your XML was created. The audio files themselves have no backup.
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={onCancel} className="btn-secondary">Cancel</button>
                <button onClick={() => setStep(2)} className="px-4 py-2 bg-te-red-500 hover:bg-te-red-600 text-white rounded-te text-sm font-medium transition-colors">
                  I understand — show me the files
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-te-grey-700 font-te-mono mb-3">
                These {filePaths.length} files will be deleted from disk:
              </p>
              <div className="bg-te-grey-100 rounded-te border border-te-grey-200 max-h-52 overflow-y-auto p-3 mb-5">
                {filePaths.map((p, i) => (
                  <div key={i} className="text-xs font-te-mono text-te-grey-700 py-0.5 break-all">{p}</div>
                ))}
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={onCancel} className="btn-secondary">Cancel</button>
                <button onClick={() => setStep(3)} className="px-4 py-2 bg-te-red-500 hover:bg-te-red-600 text-white rounded-te text-sm font-medium transition-colors">
                  Confirmed — final step
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-te-grey-700 font-te-mono mb-3">
                Type <span className="font-bold text-te-red-500">DELETE</span> to permanently remove {filePaths.length} file{filePaths.length !== 1 ? 's' : ''} from disk.
              </p>
              <input
                type="text"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder="Type DELETE"
                autoFocus
                className="w-full border border-te-grey-300 rounded-te px-3 py-2 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-red-500 mb-5"
              />
              <div className="flex gap-3 justify-end">
                <button onClick={onCancel} className="btn-secondary">Cancel</button>
                <button
                  onClick={onConfirm}
                  disabled={typed !== 'DELETE'}
                  className="flex items-center gap-2 px-4 py-2 bg-te-red-500 hover:bg-te-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-te text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {filePaths.length} file{filePaths.length !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
