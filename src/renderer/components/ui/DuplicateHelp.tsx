import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Two things wear the word "duplicate" and the difference decides whether a
 * file leaves the disk. People kept asking, so it is spelled out here rather
 * than hidden in tooltips.
 */
export const DuplicateHelp: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-4 mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-te-mono text-te-grey-600 hover:text-te-orange transition-colors normal-case"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <HelpCircle size={13} />
        How duplicate resolving works
      </button>

      {open && (
        // Capped and scrollable: the page around it is overflow-hidden, so an
        // uncapped panel pushed its own end, and the list, off the screen.
        <div className="mt-2 max-h-[40vh] overflow-y-auto rounded-te border border-te-grey-300 bg-te-grey-100 p-3 space-y-2 text-xs font-te-mono text-te-grey-700 normal-case leading-relaxed">
          <p>
            Resolving keeps one entry and <strong>merges the rest into it</strong>. Playlists
            follow the kept entry. Nothing leaves your disk unless you tick the trash option.
          </p>
          <ul className="space-y-1.5">
            <li>
              <span className="inline-block px-1.5 py-0.5 rounded bg-te-green-100 text-te-green-600 border border-te-green-200 mr-1.5">Will be kept</span>
              stays, file and all.
            </li>
            <li>
              <span className="inline-block px-1.5 py-0.5 rounded bg-te-grey-200 text-te-grey-600 border border-te-grey-300 mr-1.5">Extra listing · no file removed</span>
              same file, listed twice. Only the listing goes.
            </li>
            <li>
              <span className="inline-block px-1.5 py-0.5 rounded bg-te-amber-100 text-te-amber-600 border border-te-amber-200 mr-1.5">Own file · trashed if enabled</span>
              a second copy. Moved to the system trash, never deleted outright.
            </li>
          </ul>
          <p>
            <span className="te-value">files missing</span> sets were matched on artist, title and
            length. <span className="te-value">streaming</span> tracks have no file by design and
            are never trashed.
          </p>
        </div>
      )}
    </div>
  );
};
