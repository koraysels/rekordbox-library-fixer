import React, { useState, memo, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Music,
  Disc,
  Clock,
  HardDrive,
  Star,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { formatFileSize, formatDuration } from '../utils';
import { useFileOperations } from '../hooks';
import { ConfidenceBadge, PlayButton } from './ui';
import { useSettingsStore } from '../stores/settingsStore';
import { pickRecommendedTrack } from '../utils/pickRecommendedTrack';
import { deletableFileCount, distinctFileCount } from '../utils/classifyDuplicateSet';
import { normalizePathForCompare } from '../utils/normalizePath';
import { streamingServiceOf } from '../utils/streamingSource';


interface DuplicateItemProps {
  duplicate: any;
  isSelected: boolean;
  onToggleSelection: () => void;
  resolutionStrategy: string;
  playlistMembership?: Map<string, { count: number; names: string[] }>;
}

const DuplicateItem: React.FC<DuplicateItemProps> = memo(({
  duplicate,
  isSelected,
  onToggleSelection,
  resolutionStrategy,
  playlistMembership
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const { openFileLocation } = useFileOperations();
  const preferLossless = useSettingsStore((state) => state.scanOptions.preferLossless);

  const recommendedTrack = useMemo(
    () => pickRecommendedTrack(duplicate.tracks, resolutionStrategy, duplicate.pathPreferences, preferLossless),
    [duplicate.tracks, resolutionStrategy, duplicate.pathPreferences, preferLossless]
  );


  // Total playlist reach of this song across ALL its duplicate copies (the
  // union of every copy's playlists). After we reduce the set to one file,
  // that single file ends up in all of these playlists.
  const playlistReach = useMemo(() => {
    const names = new Set<string>();
    for (const track of duplicate.tracks) {
      const m = playlistMembership?.get(track.id);
      if (m) { m.names.forEach((n) => names.add(n)); }
    }
    return { count: names.size, names: Array.from(names) };
  }, [duplicate.tracks, playlistMembership]);

  // Two very different situations wear the word "duplicate": several rekordbox
  // entries for ONE file (nothing to delete) versus genuinely duplicated files.
  const filesToRemove = useMemo(
    () => deletableFileCount(duplicate.tracks, recommendedTrack?.id),
    [duplicate.tracks, recommendedTrack]
  );

  // Say the actual numbers. "Mixed" left people asking how many files there
  // really are; "5 entries · 2 files" answers it outright.
  const fileCount = useMemo(() => distinctFileCount(duplicate.tracks), [duplicate.tracks]);
  const entryCount = duplicate.tracks.length;
  const kindBadge = {
    label: `${entryCount} entries · ${fileCount} file${fileCount !== 1 ? 's' : ''}`,
    className: fileCount > 1
      ? 'bg-te-amber-100 text-te-amber-600 border-te-amber-200'
      : 'bg-te-grey-200 text-te-grey-700 border-te-grey-300',
  };

  /**
   * An entry that points at the kept file is only an extra listing: merging it
   * touches no file. One that points elsewhere has a file of its own, which is
   * what the trash option acts on. Calling both "will be removed" hid that.
   */
  const sharesKeptFile = useCallback(
    (track: any) =>
      !!recommendedTrack
      && normalizePathForCompare(track.location) === normalizePathForCompare(recommendedTrack.location),
    [recommendedTrack]
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleManualSelection = useCallback((trackId: string) => {
    setSelectedTrackId(trackId);
  }, []);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Prevent event bubbling
    onToggleSelection();
  }, [onToggleSelection]);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only handle click if it's not on an interactive element
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('button, input, a, [role="button"]');

    if (!isInteractiveElement) {
      onToggleSelection();
    }
  }, [onToggleSelection]);

  return (
    <div
      className={`card p-3 ${isSelected ? 'border-te-orange' : 'border-te-grey-300'} cursor-pointer`}
      onClick={handleContainerClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="checkbox"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base truncate">
              {duplicate.tracks[0].artist} - {duplicate.tracks[0].name}
            </h3>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-xs text-zinc-400">
                {duplicate.tracks.length} duplicates
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span className="text-xs text-zinc-400 capitalize">
                {duplicate.matchType} match
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span
                className={`text-[10px] font-te-mono px-1.5 py-0.5 rounded-te border normal-case ${kindBadge.className}`}
                title={fileCount === 1
                  ? 'Every entry points at the same file on disk — resolving removes the extra entries and touches no file.'
                  : `${entryCount} rekordbox entries pointing at ${fileCount} files on disk. Resolving can move ${filesToRemove} file${filesToRemove !== 1 ? 's' : ''} to the trash.`}
              >
                {kindBadge.label}
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span
                className="text-xs text-te-grey-500 font-te-mono"
                title={playlistReach.count > 0 ? playlistReach.names.join('\n') : undefined}
              >
                in {playlistReach.count} playlist{playlistReach.count === 1 ? '' : 's'}
              </span>
              <ConfidenceBadge confidence={duplicate.confidence} />
            </div>
          </div>
        </div>

        <button
          onClick={toggleExpanded}
          className="p-1 hover:bg-zinc-700 rounded transition-colors flex-shrink-0 ml-2"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2 te-expanded-content">
          {duplicate.tracks.map((track: any) => {
            console.log('🎵 Rendering track:', { id: track.id, location: track.location, name: track.name });
            const isRecommended = recommendedTrack && track.id === recommendedTrack.id;
            const isManuallySelected = resolutionStrategy === 'manual' && track.id === selectedTrackId;

            return (
              <div
                key={track.id}
                className={`p-3 bg-te-cream rounded-te border-2 ${
                  isRecommended ? 'border-te-green-500' :
                  isManuallySelected ? 'border-te-orange' :
                  'border-te-grey-300'
                } transition-colors hover:border-te-grey-400`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <PlayButton track={{ id: track.id, name: track.name, artist: track.artist, location: track.location }} />
                        <h4 className="font-medium text-sm truncate te-value font-te-mono">{track.name}</h4>
                        {streamingServiceOf(track.location) && (
                          <span
                            className="text-[10px] font-te-mono px-1.5 py-0.5 rounded-te border bg-te-grey-200 text-te-grey-600 border-te-grey-300 normal-case whitespace-nowrap"
                            title="A streaming track: it has no file on disk, so nothing can be deleted for it."
                          >
                            {streamingServiceOf(track.location)}
                          </span>
                        )}
                      </div>
                      {resolutionStrategy !== 'manual' && (
                        isRecommended ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-te-green-100 text-te-green-600 border border-te-green-200 font-te-mono whitespace-nowrap">
                            <CheckCircle className="w-3 h-3" /> Will be kept
                          </span>
                        ) : sharesKeptFile(track) ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-te-grey-100 text-te-grey-500 border border-te-grey-200 font-te-mono whitespace-nowrap"
                            title="Rekordbox lists the kept file twice. Only the extra listing disappears — no file leaves your disk."
                          >
                            Extra listing · no file removed
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-te-amber-100 text-te-amber-600 border border-te-amber-200 font-te-mono whitespace-nowrap"
                            title="A second copy of the song, in another folder. Its listing is merged into the kept one, and this file moves to the trash only if you tick the trash option."
                          >
                            Own file · trashed if enabled
                          </span>
                        )
                      )}
                      {resolutionStrategy === 'manual' && isManuallySelected && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-te-green-100 text-te-green-600 border border-te-green-200 font-te-mono whitespace-nowrap">
                          <CheckCircle className="w-3 h-3" /> Will be kept
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 te-label">
                          <Music className="w-3 h-3" />
                          <span className="truncate font-te-mono">{track.artist}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 te-label">
                          <Disc className="w-3 h-3" />
                          <span className="truncate font-te-mono">{track.album || 'No Album'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 te-label">
                          <Clock className="w-3 h-3" />
                          <span className="font-te-mono">{formatDuration(track.duration)}</span>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 te-label">
                          <HardDrive className="w-3 h-3" />
                          <span className="font-te-mono">{formatFileSize(track.size)}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 te-label">
                          <span className="font-te-mono">Bitrate:</span>
                          <span className="font-te-mono">{track.bitrate || 'N/A'} kbps</span>
                        </div>
                        <div className="flex items-center space-x-1.5 te-label">
                          <Star className="w-3 h-3" />
                          <span className="font-te-mono">Rating: {track.rating || 0}/5</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-1.5 text-xs te-label">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="te-value font-medium font-te-mono">Path:</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('🔵 Go to File button clicked!', track.location);
                              openFileLocation(track.location);
                            }}
                            className="flex items-center space-x-1 px-2 py-1 text-xs bg-te-orange hover:bg-te-orange/90 text-te-cream rounded-te border border-te-orange transition-all duration-200 font-te-mono"
                            title="Open file location in system file manager"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="font-medium">Go to File</span>
                          </button>
                        </div>
                        <div
                          className="te-code-block select-all whitespace-pre-wrap word-break-all"
                          title="Click to select full path"
                          style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}
                        >
                          {track.location || 'No file path available'}
                        </div>
                      </div>
                    </div>

                    {(track.cues?.length > 0 || track.loops?.length > 0) && (
                      <div className="mt-1 flex space-x-2 text-xs text-te-green-600">
                        {track.cues?.length > 0 && <span className="font-te-mono">✓ {track.cues.length} cues</span>}
                        {track.loops?.length > 0 && <span className="font-te-mono">✓ {track.loops.length} loops</span>}
                      </div>
                    )}
                  </div>

                  {resolutionStrategy === 'manual' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManualSelection(track.id);
                      }}
                      className={`ml-3 px-2 py-1 text-xs rounded-te transition-colors whitespace-nowrap ${
                        isManuallySelected
                          ? 'bg-te-orange text-te-cream border border-te-orange'
                          : 'bg-te-grey-100 hover:bg-te-grey-200 text-te-grey-700 border border-te-grey-300'
                      }`}
                    >
                      {isManuallySelected ? 'Keeping this' : 'Keep this'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if relevant props changed
  return (
    prevProps.duplicate.id === nextProps.duplicate.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.resolutionStrategy === nextProps.resolutionStrategy &&
    JSON.stringify(prevProps.duplicate.pathPreferences) === JSON.stringify(nextProps.duplicate.pathPreferences) &&
    prevProps.duplicate.tracks.length === nextProps.duplicate.tracks.length
  );
});

DuplicateItem.displayName = 'DuplicateItem';

export default DuplicateItem;
