import React, { useMemo, useState } from 'react';
import { Database, Loader2, RotateCw, Usb } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { PageHeader } from '../ui';
import { useAppContext } from '../../AppWithRouter';
import { useUsbCheck } from '../../hooks/useUsbCheck';
import { isDatabasePath } from '../../wizard/wizardScreen';
import { UsbSummary } from '../usb/UsbSummary';
import { UsbPlaylistRow } from '../usb/UsbPlaylistRow';
import { isIncomplete, orderPlaylists, playlistPath } from '../../usb/usbReport';
import { DATABASE_NEEDED, NO_STICK, READ_ONLY_NOTE } from '../../usb/usbText';

const Busy: React.FC<{ text: string }> = ({ text }) => (
  <div role="status" className="flex items-center gap-3 text-sm font-te-mono normal-case text-te-grey-600 py-6">
    <Loader2 className="w-5 h-5 text-te-orange animate-spin" aria-hidden />
    {text}
  </div>
);

/**
 * What a USB stick lacks against the library's synced playlists, and why.
 * Read-only: the fixes are pointers (plug in a drive, relocate, sync again in rekordbox).
 */
export const UsbPage: React.FC = () => {
  const { libraryPath } = useAppContext();
  const navigate = useNavigate();
  const database = isDatabasePath(libraryPath);
  const usb = useUsbCheck(libraryPath, database);
  const [showComplete, setShowComplete] = useState(false);
  const openRelocation = () => void navigate({ to: '/relocate' });

  const ordered = useMemo(() => orderPlaylists(usb.result?.playlists ?? []), [usb.result]);
  const incomplete = ordered.filter(isIncomplete);
  const shown = showComplete ? ordered : incomplete;
  const completeCount = ordered.length - incomplete.length;

  const rescan = (
    <button
      type="button" className="btn-secondary flex items-center gap-2"
      onClick={() => void usb.rescan()} disabled={!database || usb.searching || usb.checking}
    >
      <RotateCw className={`w-4 h-4 ${usb.searching ? 'animate-spin' : ''}`} aria-hidden />
      Rescan
    </button>
  );

  return (
    <div className="p-te-lg h-full overflow-auto">
      <PageHeader title="USB Sticks" icon={Usb} stats={usb.stick?.name} actions={rescan} />
      <div className="px-4 pt-4 pb-6 space-y-4">
        {!database ? (
          <div className="card space-y-3 max-w-xl">
            <p className="text-sm font-te-mono normal-case te-value">{DATABASE_NEEDED}</p>
            <button type="button" className="btn-primary flex items-center gap-2" onClick={() => void navigate({ to: '/library' })}>
              <Database className="w-4 h-4" aria-hidden />
              Open the database
            </button>
          </div>
        ) : (
          <>
            {usb.sticks && usb.sticks.length > 1 && (
              <section aria-label="Sticks" className="space-y-2">
                {!usb.stick && <p className="text-sm font-te-mono normal-case te-value">Several sticks are plugged in. Which one?</p>}
                <div className="flex flex-wrap gap-2">
                  {usb.sticks.map((s) => (
                    <button
                      key={s.root} type="button" aria-pressed={usb.stick?.root === s.root}
                      onClick={() => void usb.choose(s)} disabled={usb.checking && usb.stick?.root === s.root}
                      className={usb.stick?.root === s.root ? 'btn-primary' : 'btn-secondary'}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {usb.searching ? <Busy text="Looking for USB sticks…" />
              : usb.checking && usb.stick ? <Busy text={`Reading ${usb.stick.name} and the library…`} />
              : null}

            {usb.error && (
              <p role="alert" className="text-sm font-te-mono normal-case text-te-red-500">{usb.error}</p>
            )}

            {!usb.searching && usb.sticks?.length === 0 && !usb.error && (
              <p className="text-sm font-te-mono normal-case te-value">{NO_STICK}</p>
            )}

            {usb.result && usb.stick && (
              <>
                <UsbSummary stick={usb.stick} result={usb.result} onOpenRelocation={openRelocation} />

                <section aria-label="Playlists" className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="te-label">Synced playlists</h3>
                    {completeCount > 0 && (
                      <label className="flex items-center gap-2 text-xs font-te-mono normal-case text-te-grey-600">
                        <input type="checkbox" className="checkbox" checked={showComplete} onChange={(e) => setShowComplete(e.target.checked)} />
                        Show complete ones too ({completeCount})
                      </label>
                    )}
                  </div>
                  {shown.length > 0 ? (
                    <ul className="border-2 border-te-grey-300 rounded-te divide-y divide-te-grey-200 bg-te-cream">
                      {shown.map((p) => <UsbPlaylistRow key={p.id} playlist={p} onOpenRelocation={openRelocation} />)}
                    </ul>
                  ) : (
                    <p className="text-sm font-te-mono normal-case text-te-grey-600">
                      {ordered.length > 0 ? 'Every synced playlist is on the stick in full.' : 'No synced playlists to show.'}
                    </p>
                  )}
                </section>

                {usb.result.notChecked.length > 0 && (
                  <section aria-label="Not checked" className="space-y-1">
                    <h3 className="te-label">Smart playlists · not checked</h3>
                    <p className="text-xs font-te-mono normal-case text-te-grey-600">
                      The app does not work out which tracks a smart playlist holds, so these are not compared.
                    </p>
                    <ul className="text-sm font-te-mono normal-case text-te-grey-700 list-disc ml-5">
                      {usb.result.notChecked.map((p) => <li key={p.id}>{playlistPath(p.path)}</li>)}
                    </ul>
                  </section>
                )}

                {usb.result.leftovers.length > 0 && (
                  <section aria-label="Leftovers" className="space-y-1">
                    <h3 className="te-label">On the stick, not synced from this library · {usb.result.leftovers.length}</h3>
                    <p className="text-xs font-te-mono normal-case text-te-grey-600">
                      Left over from an older export, or a playlist renamed or deleted since. Remove them from the stick in rekordbox if you no longer want them.
                    </p>
                    <ul className="border-2 border-te-grey-300 rounded-te divide-y divide-te-grey-200 bg-te-cream">
                      {usb.result.leftovers.map((l, i) => (
                        <li key={`${playlistPath(l.path)}-${i}`} className="flex items-center gap-3 px-3 py-2">
                          <span className="flex-1 min-w-0 text-sm text-te-grey-800 truncate">{playlistPath(l.path)}</span>
                          <span className="text-xs font-te-mono text-te-grey-600 whitespace-nowrap">
                            {l.stickCount} on the stick
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <p className="te-label normal-case">{READ_ONLY_NOTE}</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
