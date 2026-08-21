import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, Trash2, AlertTriangle, Layers, Move, Copy, Save, History as HistoryIcon } from 'lucide-react';
import { useAppContext } from '../../AppWithRouter';
import { PageHeader } from '../ui';
import {
  duplicationHistoryStorage,
  duplicationHistoryEvents,
  type ActivityEntry,
} from '../../db/duplicationHistoryDb';

const TYPE_META: Record<ActivityEntry['type'], { label: string; Icon: typeof Layers }> = {
  'duplicate-merge': { label: 'Duplicates', Icon: Layers },
  relocation: { label: 'Relocation', Icon: Move },
  consolidate: { label: 'Consolidate', Icon: Copy },
  'filter-move': { label: 'Filter copy/move', Icon: Copy },
  'xml-save': { label: 'Library saved', Icon: Save },
};

const formatTime = (value: Date | string) => {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

export const HistoryPage: React.FC = () => {
  const { libraryPath } = useAppContext();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [typeFilter, setTypeFilter] = useState<'all' | ActivityEntry['type']>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!libraryPath) { setEntries([]); return; }
    setEntries(await duplicationHistoryStorage.list(libraryPath));
  }, [libraryPath]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => duplicationHistoryEvents.onUpdate((p) => {
    if (p === libraryPath) { load(); }
  }), [libraryPath, load]);

  const presentTypes = useMemo(
    () => Array.from(new Set(entries.map((e) => e.type))),
    [entries]
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) { return false; }
      if (!needle) { return true; }
      if (e.summary.toLowerCase().includes(needle)) { return true; }
      return e.details.some((d) =>
        [d.trackName, d.from, d.to, d.error].some((v) => v?.toLowerCase().includes(needle)));
    });
  }, [entries, typeFilter, search]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const reveal = async (path: string) => {
    try { await window.electronAPI.showFileInFolder(path); } catch { /* nothing to do */ }
  };

  const failureCount = (entry: ActivityEntry) =>
    entry.details.filter((d) => d.action === 'failed').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={HistoryIcon}
        title="History"
        stats={`${entries.length} operation${entries.length !== 1 ? 's' : ''} recorded`}
      />

      <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-te-grey-300">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="input text-xs py-1"
        >
          <option value="all">All operations</option>
          {/* Only offer types that actually occur — an empty filter is a dead end. */}
          {presentTypes.map((value) => (
            <option key={value} value={value}>{TYPE_META[value]?.label ?? value}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search track or path..."
          className="input text-xs py-1 flex-1 min-w-[200px]"
        />
        {entries.length > 0 && (
          <button
            onClick={async () => { await duplicationHistoryStorage.clear(libraryPath); load(); }}
            className="btn-ghost text-xs"
          >
            <Trash2 size={12} className="inline mr-1" /> Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {visible.length === 0 ? (
          <p className="te-label text-center mt-10 normal-case">
            {entries.length === 0
              ? (libraryPath
                  ? 'Nothing recorded yet. Operations that change your library will appear here.'
                  : 'Load a library to see what the app changed in it.')
              : 'No operations match this filter.'}
          </p>
        ) : (
          visible.map((entry) => {
            const meta = TYPE_META[entry.type];
            const Icon = meta?.Icon ?? Layers;
            const isOpen = expanded.has(entry.id!);
            const failures = failureCount(entry);
            return (
              <div key={entry.id} className="card p-3">
                <button
                  onClick={() => toggle(entry.id!)}
                  className="w-full flex items-start gap-2 text-left"
                >
                  {isOpen ? <ChevronDown size={14} className="mt-1 flex-shrink-0" />
                    : <ChevronRight size={14} className="mt-1 flex-shrink-0" />}
                  <Icon size={14} className="mt-1 flex-shrink-0 text-te-orange" />
                  <span className="flex-1 min-w-0">
                    <span className="te-value text-sm block">{entry.summary}</span>
                    <span className="te-label text-xs normal-case">
                      {formatTime(entry.timestamp)} • {meta?.label ?? entry.type}
                      {failures > 0 && (
                        <span className="text-te-red-500 ml-2">
                          <AlertTriangle size={11} className="inline mr-0.5" />
                          {failures} failed
                        </span>
                      )}
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-2 ml-6 space-y-1">
                    {entry.backupPath && (
                      <button
                        onClick={() => reveal(entry.backupPath!)}
                        className="text-xs text-te-orange hover:underline flex items-center gap-1"
                      >
                        <FolderOpen size={11} /> Reveal backup
                      </button>
                    )}
                    {entry.details.map((d, i) => (
                      <div
                        key={i}
                        className={`te-path text-xs ${d.action === 'failed' ? 'text-te-red-500' : 'text-te-grey-600'}`}
                      >
                        <span className="uppercase mr-2">{d.action}</span>
                        {d.trackName && <span className="te-value mr-2">{d.trackName}</span>}
                        {d.from && <span>{d.from}</span>}
                        {d.to && <span> → {d.to}</span>}
                        {d.error && <span> — {d.error}</span>}
                      </div>
                    ))}
                    {entry.details.length === 0 && (
                      <p className="te-label text-xs normal-case">No item-level detail recorded.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
