import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import type { PlaylistCheck } from '../../../main/ipcContract';
import { groupByReason, playlistPath, playlistStatus, type PlaylistStatus, type ReasonGroup } from '../../usb/usbReport';
import { extraLine, playlistCounts, reasonFix, reasonLabel } from '../../usb/usbText';

/** Rendered at first per group; a playlist can hold hundreds, and most of the time the first screenful says enough. */
const FIRST = 100;

const TAGS: Record<PlaylistStatus, { text: string; className: string }> = {
  'complete': { text: 'Complete', className: 'bg-te-green-100 text-te-green-600 border-te-green-200' },
  'incomplete': { text: 'Incomplete', className: 'bg-te-amber-100 text-te-amber-600 border-te-amber-200' },
  'empty-on-stick': { text: 'Empty on stick', className: 'bg-te-red-100 text-te-red-600 border-te-red-200' },
  'not-on-stick': { text: 'Not on stick', className: 'bg-te-red-100 text-te-red-600 border-te-red-200' },
};

const Group: React.FC<{ group: ReasonGroup; onOpenRelocation: () => void }> = ({ group, onOpenRelocation }) => {
  const [all, setAll] = useState(false);
  const shown = all ? group.entries : group.entries.slice(0, FIRST);
  const label = group.reason === 'drive-unplugged' && group.drive
    ? `On ${group.drive}, not plugged in`
    : reasonLabel(group.reason);
  return (
    <div className="space-y-1">
      <p className="te-label">{label} · {group.entries.length}</p>
      <p className="text-xs font-te-mono normal-case text-te-grey-600">
        {reasonFix(group.reason)}
        {group.reason === 'missing' && (
          <> <button type="button" className="underline text-te-orange" onClick={onOpenRelocation}>Open Track Relocation</button></>
        )}
      </p>
      <ul className="border-2 border-te-grey-200 rounded-te divide-y divide-te-grey-200 bg-white/50">
        {shown.map((e, i) => (
          <li key={`${e.trackId}-${i}`} className="px-3 py-1.5 min-w-0">
            <p className="text-sm text-te-grey-800 truncate">
              {e.name || 'Untitled'}
              {e.artist && <span className="text-te-grey-500"> — {e.artist}</span>}
            </p>
            {e.location && (
              <p className="text-[11px] text-te-grey-500 te-path-tail" title={e.location}>{e.location}</p>
            )}
          </li>
        ))}
      </ul>
      {!all && group.entries.length > FIRST && (
        <button type="button" className="btn-ghost text-xs" onClick={() => setAll(true)}>
          Show all {group.entries.length}
        </button>
      )}
    </div>
  );
};

/** One synced playlist: library count against the stick's, and what is left out and why when opened. */
export const UsbPlaylistRow: React.FC<{ playlist: PlaylistCheck; onOpenRelocation: () => void }> = ({
  playlist, onOpenRelocation,
}) => {
  const status = playlistStatus(playlist);
  const tag = TAGS[status];
  const head = (
    <>
      <span className="flex-1 min-w-0 text-sm text-te-grey-800 normal-case truncate text-left" title={playlistPath(playlist.path)}>
        {playlistPath(playlist.path)}
      </span>
      <span className="text-xs font-te-mono text-te-grey-600 whitespace-nowrap">{playlistCounts(playlist)}</span>
      <span className={`text-[10px] font-te-mono uppercase tracking-wider px-2 py-0.5 rounded-te border whitespace-nowrap ${tag.className}`}>
        {tag.text}
      </span>
    </>
  );

  if (playlist.notOnStick.length === 0 && playlist.extraOnStick === 0) {
    return <li className="flex items-center gap-3 px-3 py-2">{head}<span className="w-4" aria-hidden /></li>;
  }

  return (
    <li>
      <Collapsible>
        <CollapsibleTrigger className="group w-full flex items-center gap-3 px-3 py-2 min-h-0 hover:bg-te-grey-100 font-te-mono">
          {head}
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-te-grey-500 transition-transform group-data-[open]:rotate-180" aria-hidden />
        </CollapsibleTrigger>
        {/* Unmounted while closed, so a long result costs nothing until a row is opened. */}
        <CollapsiblePanel className="px-3 pb-3 pt-1 space-y-3">
          {playlist.extraOnStick > 0 && (
            <p className="text-xs font-te-mono normal-case text-te-grey-600">{extraLine(playlist.extraOnStick)}</p>
          )}
          {groupByReason(playlist.notOnStick).map((g) => (
            <Group key={`${g.reason}-${g.drive ?? ''}`} group={g} onOpenRelocation={onOpenRelocation} />
          ))}
        </CollapsiblePanel>
      </Collapsible>
    </li>
  );
};
