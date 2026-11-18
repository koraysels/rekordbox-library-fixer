import React from 'react';
import { AlertTriangle, HardDrive, Info } from 'lucide-react';
import type { UsbCheckResult, UsbStick } from '../../../main/ipcContract';
import { reasonCounts } from '../../usb/usbReport';
import {
  damageWarning, headline, plugInDetail, plugInLine, reasonCountLine, reasonFix, stickNotes, subline,
} from '../../usb/usbText';

/** The answer first: how many playlists fall short, the drive to plug in, then each reason with its fix. */
export const UsbSummary: React.FC<{
  stick: UsbStick;
  result: UsbCheckResult;
  onOpenRelocation: () => void;
}> = ({ stick, result, onOpenRelocation }) => {
  const counts = reasonCounts(result).filter((r) => r.reason !== 'drive-unplugged');
  const notes = stickNotes(stick, result);
  const damage = damageWarning(result);
  return (
    <section aria-label="Summary" className="card space-y-4">
      <div>
        <h2 className="te-display normal-case">{headline(result, stick.name)}</h2>
        <p className="te-label mt-1">{subline(result)}</p>
      </div>

      {damage && (
        <p role="alert" className="flex items-start gap-3 p-te-md rounded-te border-2 border-te-red-500 text-sm font-te-mono normal-case text-te-grey-800">
          <AlertTriangle className="w-5 h-5 text-te-red-500 flex-shrink-0 mt-0.5" aria-hidden />
          {damage}
        </p>
      )}

      {result.totals.byDrive.map((d) => (
        <div key={d.drive} className="flex items-start gap-3 p-te-md rounded-te border-2 border-te-orange bg-te-orange/10">
          <HardDrive className="w-5 h-5 text-te-orange flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="te-value normal-case">{plugInLine(d)}</p>
            <p className="text-xs font-te-mono normal-case text-te-grey-600">{plugInDetail(d)}</p>
          </div>
        </div>
      ))}

      {counts.length > 0 && (
        <ul className="space-y-2">
          {counts.map(({ reason, count }) => (
            <li key={reason} className="text-sm font-te-mono normal-case">
              <p className="text-te-grey-800 font-semibold">{reasonCountLine(reason, count)}</p>
              <p className="text-xs text-te-grey-600">
                {reasonFix(reason)}
                {reason === 'missing' && (
                  <> <button type="button" className="underline text-te-orange" onClick={onOpenRelocation}>Open Track Relocation</button></>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      {notes.map((n) => (
        <p key={n} className="flex items-start gap-2 text-xs font-te-mono normal-case text-te-grey-600">
          <Info className="w-4 h-4 flex-shrink-0" aria-hidden />
          {n}
        </p>
      ))}
    </section>
  );
};
