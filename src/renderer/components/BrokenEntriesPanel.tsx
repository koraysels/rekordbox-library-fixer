import React, { useCallback, useState } from 'react';
import { AlertTriangle, Search, Trash2 } from 'lucide-react';
import { useAppContext } from '../AppWithRouter';

interface Broken {
  trackId: string;
  name: string;
  artist: string;
  location: string;
  reason: string;
}

const REASON_LABEL: Record<string, string> = {
  folder: 'Points at a folder',
  streaming: 'Streaming track, no file',
  truncated: 'Path cut short',
  empty: 'No location',
};

/**
 * Entries that can never resolve to a file: folders, streaming tracks and paths
 * cut off mid-name. They clutter the collection and muddle duplicate detection.
 * Tracks whose file merely moved are deliberately excluded — those belong to
 * the relocator, and removing them would throw away cues and playlist slots.
 */
export const BrokenEntriesPanel: React.FC = () => {
  const { libraryData, libraryPath, showNotification, setLibraryData, onLoadLibrary } = useAppContext();
  const [broken, setBroken] = useState<Broken[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isDatabase = libraryPath.toLowerCase().endsWith('.db');

  const scan = useCallback(async () => {
    if (!libraryData) { return; }
    setBusy(true);
    try {
      const tracks = Array.from(libraryData.tracks.values());
      const result = await window.electronAPI.findBrokenEntries(tracks);
      if (result.success) {
        setBroken(result.data ?? []);
      } else {
        showNotification('error', result.error || 'Could not check the library');
      }
    } finally {
      setBusy(false);
    }
  }, [libraryData, showNotification]);

  const remove = useCallback(async () => {
    if (!broken?.length) { return; }
    setBusy(true);
    try {
      const result = await window.electronAPI.removeBrokenEntries({
        libraryPath,
        trackIds: broken.map((b) => b.trackId),
      });
      if (result.success) {
        showNotification(
          'success',
          `Removed ${result.removed} broken entr${result.removed === 1 ? 'y' : 'ies'}. A backup was saved first.`
        );
        setBroken([]);
        onLoadLibrary?.(libraryPath);
      } else {
        showNotification('error', result.error || 'Could not remove the entries');
      }
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }, [broken, libraryPath, showNotification, onLoadLibrary]);

  const counts = (broken ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.reason] = (acc[b.reason] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="card p-4">
      <h3 className="te-title mb-1">Broken entries</h3>
      <p className="te-label text-xs normal-case mb-3">
        Tracks whose location can never be a file: folders, streaming tracks, and paths cut
        short by a bad import. Tracks whose file simply moved are left alone — use the
        relocator for those.
      </p>

      {!libraryData ? (
        <p className="te-label text-xs normal-case">Load a library first.</p>
      ) : (
        <>
          <button onClick={scan} disabled={busy} className="btn-secondary text-xs disabled:opacity-40">
            <Search size={12} className="inline mr-1.5" />
            {busy && broken === null ? 'Checking…' : 'Check library'}
          </button>

          {broken !== null && (
            broken.length === 0 ? (
              <p className="te-label text-xs normal-case mt-3">
                Nothing broken found. Every entry names a real file.
              </p>
            ) : (
              <div className="mt-3">
                <p className="te-value text-sm mb-1">
                  {broken.length} broken entr{broken.length === 1 ? 'y' : 'ies'}
                </p>
                <p className="te-label text-xs normal-case mb-2">
                  {Object.entries(counts)
                    .map(([reason, n]) => `${n} ${(REASON_LABEL[reason] ?? reason).toLowerCase()}`)
                    .join(' · ')}
                </p>

                <div className="max-h-52 overflow-y-auto rounded-te border border-te-grey-300 divide-y divide-te-grey-200">
                  {broken.slice(0, 200).map((entry) => (
                    <div key={entry.trackId} className="px-2 py-1.5">
                      <p className="te-value text-xs truncate">
                        {entry.artist ? `${entry.artist} — ` : ''}{entry.name || '(no title)'}
                      </p>
                      <p className="te-path-tail text-[10px] text-te-grey-500">
                        {REASON_LABEL[entry.reason] ?? entry.reason}: {entry.location || '(empty)'}
                      </p>
                    </div>
                  ))}
                  {broken.length > 200 && (
                    <p className="px-2 py-1.5 te-label text-[10px] normal-case">
                      …and {broken.length - 200} more. All of them are removed.
                    </p>
                  )}
                </div>

                {isDatabase ? (
                  <p className="te-label text-xs normal-case mt-3 text-te-amber-600">
                    <AlertTriangle size={12} className="inline mr-1" />
                    The rekordbox database is read-only here. Load an XML library to clean it up.
                  </p>
                ) : !confirming ? (
                  <button onClick={() => setConfirming(true)} className="btn-secondary text-xs mt-3">
                    <Trash2 size={12} className="inline mr-1.5" />
                    Remove these entries
                  </button>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs font-te-mono text-te-grey-700 normal-case mb-2">
                      Removes {broken.length} entries from the library and from any playlist that
                      lists them. No files are touched — these point at no file. A backup is saved
                      first, and you can undo this from the Backups tab.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={remove} disabled={busy} className="btn-secondary text-xs">
                        {busy ? 'Removing…' : `Remove ${broken.length} entries`}
                      </button>
                      <button onClick={() => setConfirming(false)} className="btn-ghost text-xs">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};
