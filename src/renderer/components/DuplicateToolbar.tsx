import React from 'react';
import { Search, Trash2, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PopoverButton } from './ui';

interface DuplicateToolbarProps {
  duplicates: any[];
  visibleDuplicates: any[];
  selectedDuplicates: Set<string>;
  kindFilter: 'all' | 'files' | 'entries' | 'streaming';
  kindCounts: { files: number; entries: number; streaming: number };
  setKindFilter: (kind: 'all' | 'files' | 'entries' | 'streaming') => void;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  scanProgress: { current: number; total: number; trackName?: string; setsFound: number } | null;
  busy: boolean;
  deleteFromDisk: boolean;
  setDeleteFromDisk: (value: boolean) => void;
  scanForDuplicates: () => void;
  cancelScan: () => void;
  selectAllInMode: () => void;
  clearAll: () => void;
  resolveDuplicates: () => void;
  isResolveDisabled: boolean;
}

/**
 * The bar above the results: scan, search, which kind of duplicate you are
 * looking at, and what to do with the selection. Three rows, each one answering
 * a different question, so none of them has to wrap.
 */
export const DuplicateToolbar: React.FC<DuplicateToolbarProps> = ({
  duplicates,
  visibleDuplicates,
  selectedDuplicates,
  kindFilter,
  kindCounts,
  setKindFilter,
  searchFilter,
  setSearchFilter,
  scanProgress,
  busy,
  deleteFromDisk,
  setDeleteFromDisk,
  scanForDuplicates,
  cancelScan,
  selectAllInMode,
  clearAll,
  resolveDuplicates,
  isResolveDisabled,
}) => (
  <div className="flex-shrink-0 bg-te-grey-200 border-b-2 border-te-grey-300">
    {/* Row 1 — the one thing you came here to do, plus finding your way
        around the result. The search grows; nothing else competes. */}
    <div className="flex items-center gap-3 px-4 pt-4">
      {busy ? (
        /* While scanning, this spot carries the progress and the way out.
           It used to live in the empty results area, which disappears as
           soon as the first streamed set arrives — taking Cancel with it. */
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={cancelScan} className="btn-secondary text-xs whitespace-nowrap">
            <Trash2 size={13} className="inline mr-1.5" />
            Cancel scan
          </button>
          <div className="flex-1 min-w-0">
            {scanProgress && scanProgress.total > 0 && (
              <>
                <div className="w-full bg-te-grey-300 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-te-orange h-full transition-all duration-200"
                    style={{ width: `${Math.round((scanProgress.current / scanProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] font-te-mono text-te-grey-600 mt-1 truncate normal-case">
                  {scanProgress.current} / {scanProgress.total} tracks · {scanProgress.setsFound} sets found
                  {scanProgress.trackName ? ` · ${scanProgress.trackName}` : ''}
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <PopoverButton
          onClick={scanForDuplicates}
          icon={Search}
          title="Scan for Duplicates"
          description="Analyze your library to find duplicate tracks using advanced algorithms"
          variant="primary"
        >
          Scan for Duplicates
        </PopoverButton>
      )}

      <input
        type="text"
        value={searchFilter}
        onChange={(e) => setSearchFilter(e.target.value)}
        placeholder="Search duplicates..."
        className="input flex-1 min-w-0"
      />
    </div>

    {/* Row 2 — which kind of duplicate you are looking at, and what you
        do with that subset. One segmented control, never wrapping. */}
    {duplicates.length > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="inline-flex rounded-te border border-te-grey-300 overflow-hidden">
          {([
            ['all', 'All', duplicates.length,
              'Every duplicate set found'],
            ['files', 'Duplicate files', kindCounts.files,
              'Separate files on disk — resolving can move the extra files to the trash'],
            ['entries', 'Same-file entries', kindCounts.entries,
              'Several rekordbox entries for one file — resolving removes the extra entries, no file is touched'],
            ['streaming', 'Streaming', kindCounts.streaming,
              'TIDAL, Spotify and the like — these have no file on disk, so nothing can be deleted for them'],
          ] as const).map(([value, label, count, hint], i) => (
            <button
              key={value}
              onClick={() => setKindFilter(value)}
              title={hint}
              className={`px-3 py-1.5 text-xs font-te-mono whitespace-nowrap normal-case transition-colors ${
                i > 0 ? 'border-l border-te-grey-300' : ''
              } ${
                kindFilter === value
                  ? 'bg-te-orange text-te-cream'
                  : 'bg-te-grey-100 text-te-grey-700 hover:bg-te-grey-50'
              }`}
            >
              {label}
              <span className={`ml-1.5 tabular-nums ${kindFilter === value ? 'opacity-70' : 'text-te-grey-500'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={selectAllInMode}
            disabled={visibleDuplicates.length === 0}
            className="btn-ghost text-xs disabled:opacity-40"
          >
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
            Select all {visibleDuplicates.length}
          </button>
          <button
            onClick={clearAll}
            disabled={selectedDuplicates.size === 0}
            className="btn-ghost text-xs disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
    )}

    {/* Row 3 — the destructive step. Hidden until something is selected,
        so the resting toolbar has no armed delete control in it. The
        counts live in the page header; repeating them here was noise. */}
    {selectedDuplicates.size > 0 && (
      <div className="flex flex-wrap items-center justify-end gap-3 mx-4 pb-4">
        <span className="te-label text-xs normal-case mr-auto">
          {selectedDuplicates.size} set{selectedDuplicates.size !== 1 ? 's' : ''} selected
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Move the duplicate files of the copies being merged to the system trash. A file the kept track still uses is never touched.">
            <input
              type="checkbox"
              checked={deleteFromDisk}
              onChange={e => setDeleteFromDisk(e.target.checked)}
              className="checkbox"
            />
            <span className="flex items-center gap-1 text-xs font-te-mono text-te-red-500 normal-case">
              <AlertTriangle className="w-3 h-3" />
              Also move duplicate files to trash
            </span>
          </label>
          <PopoverButton
            onClick={resolveDuplicates}
            disabled={isResolveDisabled}
            loading={busy}
            icon={Sparkles}
            title="Resolve Selected Duplicates"
            description="Apply resolution strategy to selected duplicate sets"
            variant="success"
          >
            {busy ? 'Resolving...' : 'Resolve Selected'}
          </PopoverButton>
        </div>
      </div>
    )}
  </div>
);
