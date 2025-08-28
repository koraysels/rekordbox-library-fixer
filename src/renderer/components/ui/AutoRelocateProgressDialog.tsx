import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Loader2, StopCircle } from 'lucide-react';

interface ProgressInfo {
  operationId?: string;
  type: 'start' | 'searching' | 'found' | 'low-confidence' | 'not-found' | 'updating-xml' | 'complete' | 'cancelled' | 'error';
  total: number;
  current: number;
  successCount?: number;
  trackName?: string;
  trackArtist?: string;
  confidence?: number;
  newLocation?: string;
  message: string;
  error?: string;
  queued?: number;
  processing?: number;
}

interface AutoRelocateProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: () => void;
}

export const AutoRelocateProgressDialog: React.FC<AutoRelocateProgressDialogProps> = ({
  isOpen,
  onClose,
  onCancel
}) => {
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!isOpen) {return;}

    // Set up progress listener
    const unsubscribe = window.electronAPI.onAutoRelocateProgress((progressData: ProgressInfo) => {
      setProgress(progressData);

      if (progressData.operationId) {
        setOperationId(progressData.operationId);
      }

      // Add to logs for certain events
      if (progressData.type === 'found') {
        setLogs(prev => [...prev, `✅ Found: ${progressData.trackName} (${Math.round((progressData.confidence || 0) * 100)}%)`]);
      } else if (progressData.type === 'not-found') {
        setLogs(prev => [...prev, `❌ Not found: ${progressData.trackName}`]);
      } else if (progressData.type === 'low-confidence') {
        setLogs(prev => [...prev, `⚠️ Low confidence: ${progressData.trackName} (${Math.round((progressData.confidence || 0) * 100)}%)`]);
      } else if (progressData.type === 'complete') {
        setIsComplete(true);
        setLogs(prev => [...prev, `✅ ${progressData.message}`]);
      } else if (progressData.type === 'cancelled') {
        setIsComplete(true);
        setLogs(prev => [...prev, '⚠️ Operation cancelled']);
      } else if (progressData.type === 'error') {
        setIsComplete(true);
        setLogs(prev => [...prev, `❌ Error: ${progressData.error}`]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  const handleCancel = async () => {
    if (operationId && !isComplete && !isCancelling) {
      setIsCancelling(true);
      try {
        await window.electronAPI.cancelAutoRelocate(operationId);
      } catch (error) {
        console.error('Failed to cancel operation:', error);
      }
      setIsCancelling(false);
    }
    onCancel();
  };

  const handleClose = () => {
    setProgress(null);
    setOperationId(null);
    setLogs([]);
    setIsComplete(false);
    setIsCancelling(false);
    onClose();
  };

  if (!isOpen) {return null;}

  const progressPercentage = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Auto-Relocating Tracks</h2>
          {isComplete && (
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>{progress?.current || 0} / {progress?.total || 0} tracks</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Current Status */}
          {progress && (
            <div className="mb-4 p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                {progress.type === 'searching' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                {progress.type === 'found' && <CheckCircle className="w-4 h-4 text-green-400" />}
                {progress.type === 'not-found' && <AlertCircle className="w-4 h-4 text-red-400" />}
                {progress.type === 'low-confidence' && <AlertCircle className="w-4 h-4 text-yellow-400" />}
                {progress.type === 'complete' && <CheckCircle className="w-4 h-4 text-green-400" />}
                {progress.type === 'cancelled' && <StopCircle className="w-4 h-4 text-yellow-400" />}
                {progress.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                <span className="text-sm text-gray-300">{progress.message}</span>
              </div>

              {/* Worker Stats */}
              {progress.queued !== undefined && progress.processing !== undefined && (
                <div className="mt-2 text-xs text-gray-500">
                  Processing: {progress.processing} | Queued: {progress.queued}
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          {progress?.successCount !== undefined && (
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-2xl font-bold text-green-400">{progress.successCount}</div>
                <div className="text-xs text-gray-400">Found</div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-2xl font-bold text-yellow-400">
                  {progress.current - (progress.successCount || 0)}
                </div>
                <div className="text-xs text-gray-400">Not Found</div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-2xl font-bold text-gray-400">
                  {progress.total - progress.current}
                </div>
                <div className="text-xs text-gray-400">Remaining</div>
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Activity Log</h3>
            <div className="flex-1 bg-gray-800 rounded p-2 overflow-y-auto text-xs font-mono space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="text-gray-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
          {!isComplete ? (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <StopCircle className="w-4 h-4" />
                  Cancel
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};