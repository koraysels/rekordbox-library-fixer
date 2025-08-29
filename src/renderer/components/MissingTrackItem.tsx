import React from 'react';
import { Search, Trash2, AlertTriangle } from 'lucide-react';
import type { MissingTrack } from '../types';
import { ListItem, PopoverButton } from './ui';

interface MissingTrackItemProps {
  track: MissingTrack;
  isSelected: boolean;
  onToggleSelection: (track: MissingTrack) => void;
  onFindCandidates: (track: MissingTrack) => void;
  onRemoveRelocation?: (track: MissingTrack) => void;
  hasRelocation: boolean;
  relocationPath?: string;
  isFindingCandidates: boolean;
  isLoadingThis: boolean;
}

export const MissingTrackItem: React.FC<MissingTrackItemProps> = ({
  track,
  isSelected,
  onToggleSelection,
  onFindCandidates,
  onRemoveRelocation,
  hasRelocation,
  relocationPath,
  isFindingCandidates,
  isLoadingThis
}) => {
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Prevent event bubbling
    onToggleSelection(track);
  };

  const handleItemClick = (e: React.MouseEvent) => {
    // Only handle click if it's not on an interactive element
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('button, input, a, [role="button"]');

    if (!isInteractiveElement) {
      onToggleSelection(track);
    }
  };

  return (
    <ListItem isSelected={isSelected} onClick={handleItemClick}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              className="rounded border-te-grey-400 text-te-orange focus:ring-te-orange"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className={`font-medium ${track.isUnlocatable ? 'text-te-orange' : 'te-value'} font-te-mono`}>
                  {track.name}
                </h3>
                {track.isUnlocatable && (
                  <AlertTriangle size={14} className="text-te-orange" title="Marked as unlocatable" />
                )}
              </div>
              <p className={`text-sm ${track.isUnlocatable ? 'text-te-orange' : 'te-label'} font-te-mono`}>
                {track.artist}
              </p>
              {track.album && (
                <p className={`text-xs ${track.isUnlocatable ? 'text-te-orange' : 'te-label'} font-te-mono`}>
                  {track.album}
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 ml-6">
            <p className="te-label text-xs font-te-mono">
              Missing: {track.originalLocation}
            </p>
            {track.isUnlocatable && (
              <p className="text-te-orange text-xs font-semibold mt-1 font-te-mono">
                ⚠️ Auto-relocation failed - marked as unlocatable
              </p>
            )}
            {hasRelocation && relocationPath && (
              <p className="text-te-green-500 text-xs font-te-mono mt-1">
                → Relocate to: {relocationPath}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <PopoverButton
            onClick={(e) => {
              e?.stopPropagation();
              onFindCandidates(track);
            }}
            disabled={isFindingCandidates}
            loading={isFindingCandidates && isLoadingThis}
            icon={Search}
            title="Find Candidates"
            description="Search for potential new locations for this track using smart matching algorithms"
            variant="primary"
          >
            Find
          </PopoverButton>

          {hasRelocation && onRemoveRelocation && (
            <PopoverButton
              onClick={(e) => {
                e?.stopPropagation();
                onRemoveRelocation(track);
              }}
              icon={Trash2}
              title="Remove Relocation"
              description="Remove the configured relocation for this track"
              variant="danger"
            >
              Remove
            </PopoverButton>
          )}
        </div>
      </div>
    </ListItem>
  );
};