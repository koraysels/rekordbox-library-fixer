import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@ui-sdk/react/alert-dialog';

interface DeleteConfirmModalProps {
  libraryPath?: string;
  filePaths: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

const stepButton = 'px-4 py-2 bg-te-red-500 hover:bg-te-red-600 text-white rounded-te text-sm font-medium transition-colors';

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ filePaths, libraryPath, onConfirm, onCancel }) => {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [typed, setTyped] = useState('');
  const [copied, setCopied] = useState(false);
  const confirmed = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileCount = `${filePaths.length} file${filePaths.length !== 1 ? 's' : ''}`;

  // The button that advanced the step is gone, so focus would fall out of the dialog.
  useEffect(() => {
    if (step === 2) {cancelRef.current?.focus();}
    if (step === 3) {inputRef.current?.focus();}
  }, [step]);

  const copyDeleteWord = async () => {
    try {
      await navigator.clipboard.writeText('DELETE');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the user can still type the word.
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next, details) => {
        confirmed.current = details.returnValue === 'confirm';
        setOpen(next);
      }}
      // The parent unmounts this on either answer; waiting for the close lets focus go back first.
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) {return;}
        if (confirmed.current) {onConfirm();} else {onCancel();}
      }}
    >
      <AlertDialogBackdrop className="bg-black/60" />
      <AlertDialogContent
        initialFocus={() => cancelRef.current}
        className="bg-white rounded-te shadow-xl w-[calc(100%-2rem)] max-w-lg overflow-hidden"
      >

        <div className="flex items-center justify-between px-5 py-4 bg-te-red-50 border-b border-te-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-te-red-500" aria-hidden="true" />
            <AlertDialogTitle className="font-semibold text-te-red-500 font-te-mono text-sm uppercase tracking-wider">
              Permanent deletion — step {step} of 3
            </AlertDialogTitle>
          </div>
          <AlertDialogClose aria-label="Close" className="text-te-grey-400 hover:text-te-grey-700">
            <X className="w-4 h-4" aria-hidden="true" />
          </AlertDialogClose>
        </div>

        <div className="px-5 py-5">

          {step === 1 && (
            <AlertDialogDescription render={<div />}>
              <p className="text-te-grey-800 font-semibold mb-2">
                You are about to permanently delete {fileCount} from disk.
              </p>
              <p className="text-sm text-te-grey-600 font-te-mono mb-4">
                This removes the actual audio files — WAV, FLAC, AIFF, MP3 — from your hard drive.
                The XML will already have been cleaned. <span className="text-te-red-500 font-semibold">This cannot be undone.</span>
              </p>
              <div className="bg-te-red-50 border border-te-red-200 rounded-te p-3 text-sm text-te-red-500 font-te-mono mb-5">
                A backup of your XML was created. The audio files themselves have no backup.
              </div>
            </AlertDialogDescription>
          )}

          {step === 2 && (
            <>
              <AlertDialogDescription className="text-sm text-te-grey-700 font-te-mono mb-3">
                These {filePaths.length} files will be deleted from disk:
              </AlertDialogDescription>
              <div className="bg-te-grey-100 rounded-te border border-te-grey-200 max-h-52 overflow-y-auto p-3 mb-5">
                {filePaths.map((p) => (
                  <div key={p} className="text-xs font-te-mono text-te-grey-700 py-0.5 break-all">{p}</div>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <AlertDialogDescription className="text-sm text-te-grey-700 font-te-mono mb-3">
                {libraryPath && (
                  <span className="block te-label text-[10px] normal-case mb-2">
                    Library: <span className="te-path text-te-grey-700">{libraryPath}</span>
                  </span>
                )}
                Type{' '}
                <button
                  type="button"
                  onClick={copyDeleteWord}
                  title="Copy DELETE to clipboard"
                  className="font-bold text-te-red-500 underline decoration-dotted underline-offset-2 hover:text-te-red-600 cursor-pointer"
                >
                  DELETE
                </button>{' '}
                {copied && <span className="text-te-green-600 not-italic">(copied)</span>}{' '}
                to permanently remove {fileCount} from disk.
              </AlertDialogDescription>
              <input
                ref={inputRef}
                type="text"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder="Type DELETE"
                aria-label="Type DELETE to confirm"
                className="w-full border border-te-grey-300 rounded-te px-3 py-2 text-sm font-te-mono bg-te-cream focus:outline-none focus:border-te-red-500 mb-5"
              />
            </>
          )}

          <div className="flex gap-3 justify-end">
            <AlertDialogClose ref={cancelRef} className="btn-secondary">Cancel</AlertDialogClose>
            {step === 1 && (
              <button key="step-1" type="button" onClick={() => setStep(2)} className={stepButton}>
                I understand — show me the files
              </button>
            )}
            {step === 2 && (
              <button key="step-2" type="button" onClick={() => setStep(3)} className={stepButton}>
                Confirmed — final step
              </button>
            )}
            {step === 3 && (
              <AlertDialogClose
                value="confirm"
                disabled={typed !== 'DELETE'}
                className="flex items-center gap-2 px-4 py-2 bg-te-red-500 hover:bg-te-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-te text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Delete {fileCount}
              </AlertDialogClose>
            )}
          </div>

        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
