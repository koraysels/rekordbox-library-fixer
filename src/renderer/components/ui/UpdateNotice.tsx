import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import type { UpdateStatus } from '../../types';

/**
 * The app's own update, in the footer. It downloads by itself; the only thing
 * asked of the user is the restart, so nobody has to fetch a new build by hand.
 */
export const UpdateNotice: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getUpdateStatus) { return; }
    // A live event beats the initial answer: the request can resolve after an
    // event has already arrived, and must not put back a stale state.
    let heard = false;
    const unsubscribe = api.onUpdateStatus((next) => { heard = true; setStatus(next); });
    void api.getUpdateStatus().then((initial) => { if (!heard) { setStatus(initial); } }).catch(() => undefined);
    return unsubscribe;
  }, []);

  switch (status.state) {
    case 'downloading':
      return (
        <span className="inline-flex items-center gap-1 text-te-grey-600" role="status">
          <Download className="w-3 h-3" /> Downloading v{status.version} · {status.percent}%
        </span>
      );
    case 'ready':
      return (
        <button
          type="button"
          onClick={() => void window.electronAPI.installUpdate()}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-te bg-te-orange text-te-cream hover:bg-te-orange/90 normal-case"
          title="The update is downloaded. The app restarts and opens the new version."
        >
          <RefreshCw className="w-3 h-3" /> Restart to update to v{status.version}
        </button>
      );
    case 'manual':
      return (
        <button
          type="button"
          onClick={() => void window.electronAPI.openReleasesPage()}
          className="underline hover:text-te-orange normal-case"
          title="This copy runs from a place it cannot update itself (a disk image or Downloads). Move it to Applications to update automatically."
        >
          v{status.version} is out — download
        </button>
      );
    case 'checking':
      return <span className="text-te-grey-500">Checking for updates…</span>;
    case 'up-to-date':
      return <span className="text-te-grey-500">Up to date</span>;
    default:
      return null;
  }
};
