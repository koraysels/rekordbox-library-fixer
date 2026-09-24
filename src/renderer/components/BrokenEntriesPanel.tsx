import React, { useCallback, useState } from 'react';
import { AlertTriangle, Search, Trash2 } from 'lucide-react';
import { useAppContext } from '../AppWithRouter';
import { useSettingsStore } from '../stores/settingsStore';

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
  missing: 'The file is gone',
};

/**
 * Entries that can never resolve to a file: folders, paths cut off mid-name and
 * empty locations. They clutter the collection and muddle duplicate detection.
 *
 * Tracks whose file is merely gone are behind an opt-in, because removing one
 * throws away its cues and its place in every playlist and cannot be undone
 * except from a backup — but a library can hold thousands that will never be
 * found again, and there was no way to clear those at all.
 *
 * Streaming tracks are never listed here, whatever the options: they have no
 * file by design, and offering to remove them would delete a TIDAL collection.
 */
export const BrokenEntriesPanel: React.FC = () => {
  const { libraryData, libraryPath, showNotification, onLoadLibrary } = useAppContext();
  const [broken, setBroken] = useState<Broken[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Opt-in: a missing file is usually a relocation job, not a deletion job.
  const [includeMissing, setIncludeMissing] = useState(false);

  const isDatabase = libraryPath.toLowerCase().endsWith('.db');

  const scan = useCallback(async () => {
    if (!libraryData) { return; }
    setBusy(true);
    try {
      const tracks = Array.from(libraryData.tracks.values());
      const result = await window.electronAPI.findBrokenEntries({ tracks, includeMissing });
      if (result.success) {
        setBroken(result.data ?? []);
      } else {
        showNotification('error', result.error || 'Could not check the library');
      }
    } finally {
      setBusy(false);
    }
  }, [libraryData, includeMissing, showNotification]);

  const remove = useCallback(async () => {
    if (!broken?.length) { return; }
    const trackIds = broken.map((b) => b.trackId);

    if (isDatabase) {
      const { running } = await window.electronAPI.isRekordboxRunning();
      if (running) {
        showNotification('error', 'Close rekordbox first — it keeps its database open while it runs.');
        return;
      }
    }

    setBusy(true);
    try {
      // A database-backed library is cleaned in the database itself; an XML one
      // by rewriting the XML. Sending XML at a .db path would destroy it.
      const result = isDatabase
        ? await window.electronAPI.removeEntriesInDb({
          dbPath: libraryPath,
          key: useSettingsStore.getState().rekordboxDbKey,
          trackIds,
        })
        : await window.electronAPI.removeBrokenEntries({ libraryPath, trackIds });

      if (result.success) {
        const removed = (result as any).entriesRemoved ?? (result as any).removed ?? 0;
        const keptCount = result.kept?.length ?? 0;
        // Say what was left alone and why: silently removing fewer entries than
        // the list showed would look like the tool had failed.
        const keptNote = keptCount > 0
          ? `\n${keptCount} left alone — ${result.kept?.[0]?.reason ?? 'not removable'}.`
          : '';
        showNotification(
          'success',
          `Removed ${removed} entr${removed === 1 ? 'y' : 'ies'} from the library`
          + `${isDatabase ? ' in the rekordbox database. Reopen rekordbox to see it.' : '.'}`
          + `${keptNote}\nA backup was saved first — undo from the Backups tab.`,
          { important: true }
        );
        setBroken([]);
        onLoadLibrary?.(libraryPath);
      } else {
        showNotification('error', result.error || 'Could not remove the entries', { important: true });
      }
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }, [broken, isDatabase, libraryPath, showNotification, onLoadLibrary]);

  const counts = (broken ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.reason] = (acc[b.reason] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="card p-4">
      <h3 className="te-title mb-1">Broken entries</h3>
      <p className="te-label text-xs normal-case mb-3">
        Entries that can never resolve to a file: folders, paths cut short by a bad import,
        and locations that are empty. Streaming tracks are never listed — they have no file by
        design. Tracks whose file is merely gone are listed only if you ask for them; the
        relocator is usually the better answer for those.
      </p>

      {!libraryData ? (
        <p className="te-label text-xs normal-case">Load a library first.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={scan} disabled={busy} className="btn-secondary text-xs disabled:opacity-40">
              <Search size={12} className="inline mr-1.5" />
              {busy && broken === null ? 'Checking…' : 'Check library'}
            </button>
            <label className="flex items-center gap-1.5 te-label text-xs normal-case cursor-pointer">
              <input
                type="checkbox"
                checked={includeMissing}
                onChange={(e) => { setIncludeMissing(e.target.checked); setBroken(null); }}
                className="accent-te-orange"
              />
              Also list tracks whose file is gone
            </label>
          </div>
          {includeMissing && (
            <p className="te-label text-xs normal-case mt-2 text-te-amber-600">
              <AlertTriangle size={12} className="inline mr-1" />
              Try the relocator first. Removing a missing track throws away its cues and its
              place in every playlist, and it cannot be relocated afterwards.
            </p>
          )}

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

                {!confirming ? (
                  <button onClick={() => setConfirming(true)} className="btn-secondary text-xs mt-3">
                    <Trash2 size={12} className="inline mr-1.5" />
                    Remove these entries
                  </button>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs font-te-mono text-te-grey-700 normal-case mb-2">
                      Removes {broken.length} entries from the library and from any playlist that
                      lists them. No files are touched — these point at no file. Any entry whose
                      file turns out to be there is left alone.
                      {isDatabase
                        ? ' This is written into the rekordbox database, so rekordbox must be closed.'
                        : ''}{' '}
                      A backup is saved first, and you can undo this from the Backups tab.
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
