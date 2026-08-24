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
        <div className="mt-2 rounded-te border border-te-grey-300 bg-te-grey-100 p-4 space-y-4 text-xs font-te-mono text-te-grey-700 normal-case leading-relaxed">
          <p>
            A duplicate set is a group of rekordbox <strong>entries</strong> for the same song.
            Several entries can point at <strong>one file</strong> on disk, or at genuinely
            separate copies. The badge on each set says which, for example{' '}
            <span className="te-value">4 entries · 2 files</span>.
          </p>

          <div>
            <p className="te-value mb-1">Resolving a set</p>
            <p>
              One entry is kept and the rest are <strong>merged into it</strong>. Every playlist
              that referenced any of them now points at the kept entry, so no playlist loses the
              song. Nothing is deleted from your disk unless you tick the trash option.
            </p>
          </div>

          <div>
            <p className="te-value mb-1">What the labels on each entry mean</p>
            <ul className="space-y-1.5 mt-1">
              <li>
                <span className="inline-block px-1.5 py-0.5 rounded bg-te-green-100 text-te-green-600 border border-te-green-200 mr-1.5">Will be kept</span>
                The entry that survives. Its file always stays.
              </li>
              <li>
                <span className="inline-block px-1.5 py-0.5 rounded bg-te-grey-200 text-te-grey-600 border border-te-grey-300 mr-1.5">Extra listing · no file removed</span>
                Points at the same file as the kept entry. Rekordbox simply listed it twice;
                only the duplicate listing goes.
              </li>
              <li>
                <span className="inline-block px-1.5 py-0.5 rounded bg-te-amber-100 text-te-amber-600 border border-te-amber-200 mr-1.5">Own file · trashed if enabled</span>
                A second copy of the song in another folder. This is the only kind that can free
                disk space, and only when the trash option is ticked.
              </li>
            </ul>
          </div>

          <div>
            <p className="te-value mb-1">The trash option</p>
            <p>
              Files go to the system trash, never straight to deletion, so a mistake is
              recoverable. A file the kept entry still uses is never touched, even when another
              entry names the same file differently.
            </p>
          </div>

          <div>
            <p className="te-value mb-1">When the files are gone</p>
            <p>
              If the files of a set can't be read, the match is made on artist, title and length
              instead of on the audio itself. Such a set says{' '}
              <span className="te-value">metadata</span> rather than a fingerprint, and its badge
              reads <span className="te-value">files missing</span> instead of a file count.
              Resolving it is still worth it: two missing tracks become one, which is one
              relocation instead of two.
            </p>
          </div>

          <div>
            <p className="te-value mb-1">Streaming tracks</p>
            <p>
              Tracks from TIDAL, Spotify and the like have no file on your disk by design. They
              are labelled with their service and are never treated as damage: a duplicated one
              reads <span className="te-value">2 entries · streaming</span>, and the extra entry
              says "nothing on disk" rather than offering a file to trash. Use the filter if you
              want them out of the way.
            </p>
          </div>

          <div>
            <p className="te-value mb-1">Filtering</p>
            <p>
              The filter above narrows the list to sets with real duplicate files, or to sets
              that are only duplicate listings. Select All follows the filter, so you can clean
              up one kind at a time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
