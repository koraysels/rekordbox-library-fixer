import React, { useCallback, useEffect, useState } from 'react';
import { Archive, RotateCcw, Trash2, FolderOpen, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../../AppWithRouter';
import { PageHeader } from '../ui';

interface Backup {
  path: string;
  originalPath: string;
  created: string;
  size: number;
  kind: 'xml' | 'database';
}

const formatWhen = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

export const BackupsPage: React.FC = () => {
  const { libraryPath, showNotification } = useAppContext();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!libraryPath) { setBackups([]); return; }
    const result = await window.electronAPI.listBackups(libraryPath);
    setBackups(result.success ? (result.data ?? []) : []);
  }, [libraryPath]);

  useEffect(() => { load(); }, [load]);

  const restore = async (backupPath: string) => {
    setBusy(true);
    try {
      const result = await window.electronAPI.restoreBackup({ backupPath, libraryPath });
      if (result.success) {
        showNotification(
          'success',
          'Library restored. Your previous state was kept as a new backup, so you can go forward again. Reload the library to see it.'
        );
        await load();
      } else {
        showNotification('error', result.error || 'Could not restore that backup');
      }
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const remove = async (backupPath: string) => {
    const result = await window.electronAPI.deleteBackup(backupPath);
    if (result.success) { await load(); } else {
      showNotification('error', result.error || 'Could not delete that backup');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={Archive}
        title="Backups"
        stats={`${backups.length} backup${backups.length !== 1 ? 's' : ''} of this library`}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {!libraryPath ? (
          <p className="te-label text-center mt-10 normal-case">Load a library to see its backups.</p>
        ) : backups.length === 0 ? (
          <div className="text-center mt-10 te-value">
            <Archive size={44} className="mx-auto mb-3 text-te-grey-400" />
            <h3 className="te-title mb-2">No backups yet</h3>
            <p className="te-label normal-case">
              The app writes one automatically before it changes your library, so the first
              backup appears the first time you resolve duplicates or apply relocations.
            </p>
          </div>
        ) : (
          <>
            <p className="te-label text-xs normal-case mb-3">
              Taken automatically before each change to{' '}
              <span className="te-path">{libraryPath}</span>. Restoring keeps your current
              state as a new backup, so going back is never one-way.
            </p>

            <div className="space-y-2">
              {backups.map((backup) => (
                <div key={backup.path} className="card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="te-value text-sm">{formatWhen(backup.created)}</p>
                      <p className="te-label text-xs normal-case">
                        {(backup.size / 1048576).toFixed(1)} MB · {backup.kind === 'database' ? 'database' : 'XML'}
                      </p>
                      <p className="te-path text-[10px] text-te-grey-400 truncate mt-0.5">{backup.path}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => window.electronAPI.showFileInFolder(backup.path)}
                        className="btn-ghost text-xs"
                        title="Reveal in Finder"
                      >
                        <FolderOpen size={12} />
                      </button>
                      <button
                        onClick={() => remove(backup.path)}
                        className="btn-ghost text-xs"
                        title="Delete this backup"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        onClick={() => setConfirming(backup.path)}
                        disabled={busy}
                        className="btn-secondary text-xs disabled:opacity-40"
                      >
                        <RotateCcw size={12} className="inline mr-1" />
                        Restore
                      </button>
                    </div>
                  </div>

                  {confirming === backup.path && (
                    <div className="mt-3 pt-3 border-t border-te-grey-300">
                      <p className="text-xs font-te-mono text-te-grey-700 normal-case mb-2">
                        <AlertTriangle size={12} className="inline mr-1 text-te-amber-600" />
                        This replaces your current library with the version from{' '}
                        {formatWhen(backup.created)}. Your current state is saved as a new
                        backup first.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => restore(backup.path)} disabled={busy} className="btn-secondary text-xs">
                          {busy ? 'Restoring…' : 'Restore this version'}
                        </button>
                        <button onClick={() => setConfirming(null)} className="btn-ghost text-xs">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
