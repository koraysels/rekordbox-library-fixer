import React, { useMemo } from 'react';
import { Library, Music, ListMusic, HardDrive, Database, FileText, X } from 'lucide-react';
import { useAppContext } from '../../AppWithRouter';
import { PageHeader, EmptyLibraryState } from '../ui';
import { computeStatistics } from '../../hooks/useStatistics';

/**
 * Everything about which library is open: choosing one, seeing what is in it,
 * and swapping it for another. Loading used to happen behind the Duplicate
 * Detection tab, which framed an app-level step as part of that feature.
 */
export const LibraryPage: React.FC = () => {
  const {
    libraryData, libraryPath, onLoadLibrary, onSelectLibrary, onLoadFromDb, onUnloadLibrary,
  } = useAppContext();

  const stats = useMemo(() => computeStatistics(libraryData), [libraryData]);
  const isDatabase = libraryPath.toLowerCase().endsWith('.db');

  if (!libraryData) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader icon={Library} title="Library" stats="No library loaded" />
        <div className="flex-1 overflow-y-auto">
          <EmptyLibraryState
            onSelectLibrary={() => onSelectLibrary?.()}
            onLoadLibrary={(p) => onLoadLibrary?.(p)}
            onLoadFromDb={() => onLoadFromDb?.()}
          />
        </div>
      </div>
    );
  }

  const facts: Array<{ icon: typeof Music; label: string; value: string }> = [
    { icon: Music, label: 'Tracks', value: stats.totalTracks.toLocaleString() },
    { icon: ListMusic, label: 'Playlists', value: stats.totalPlaylists.toLocaleString() },
    {
      icon: isDatabase ? Database : FileText,
      label: 'Source',
      value: isDatabase ? 'rekordbox database' : 'XML export',
    },
    { icon: HardDrive, label: 'Genres', value: String(stats.genreDistribution.length) },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={Library}
        title="Library"
        stats={`${stats.totalTracks.toLocaleString()} tracks • ${stats.totalPlaylists.toLocaleString()} playlists`}
        actions={
          <button onClick={() => onUnloadLibrary?.()} className="btn-ghost text-xs">
            <X size={13} className="inline mr-1.5" />
            Close library
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="card p-4">
          <p className="te-label text-[10px] normal-case mb-1">Currently open</p>
          <p className="te-value text-sm">{libraryPath.split('/').pop()}</p>
          <p className="te-path-tail text-[11px] text-te-grey-500 mt-0.5">{libraryPath}</p>
          {isDatabase && (
            <p className="te-label text-[11px] normal-case mt-2 text-te-amber-600">
              Resolving duplicates edits this database directly, with rekordbox closed and a
              backup taken first.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label} className="card p-3">
              <Icon size={14} className="text-te-orange mb-1" />
              <p className="te-value text-lg">{value}</p>
              <p className="te-label text-[10px] normal-case">{label}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="te-label text-xs normal-case mb-2">Switch to another library</p>
          <EmptyLibraryState
            onSelectLibrary={() => onSelectLibrary?.()}
            onLoadLibrary={(p) => onLoadLibrary?.(p)}
            onLoadFromDb={() => onLoadFromDb?.()}
          />
        </div>
      </div>
    </div>
  );
};
