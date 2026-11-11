import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { WizardFrame } from './WizardFrame';

const POLL_MS = 2000;

/**
 * Rekordbox keeps its database open while it runs, so nothing is written until
 * it is closed. This screen waits by itself: it asks every two seconds and
 * moves on as soon as rekordbox is gone.
 */
export const CloseRekordboxScreen: React.FC<{ onClosed: () => void }> = ({ onClosed }) => {
  useEffect(() => {
    let alive = true;
    const timer = setInterval(() => {
      void window.electronAPI.isRekordboxRunning()
        .then((r) => { if (alive && !r.running) {onClosed();} })
        .catch(() => undefined);
    }, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [onClosed]);

  return (
    <WizardFrame
      title="Close rekordbox to continue"
      lead="Rekordbox keeps your library open while it runs, and changing it then could lose the change. Quit rekordbox; this screen moves on by itself."
    >
      <p className="flex items-center gap-2 text-xs font-te-mono normal-case text-te-grey-500">
        <Loader2 className="w-4 h-4 text-te-orange animate-spin" />
        Waiting for rekordbox to close…
      </p>
    </WizardFrame>
  );
};
