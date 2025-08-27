import React from 'react';
import { Search, Trash2, AlertTriangle } from 'lucide-react';
import { ListItem, PopoverButton } from './ui';
import type { MissingTrack } from '../types';

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
              className="rounded border-gray-600 text-rekordbox-purple focus:ring-purple-500"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className={`font-medium ${track.isUnlocatable ? 'text-orange-400' : 'text-white'}`}>
                  {track.name}
                </h3>
                {track.isUnlocatable && (
                  <AlertTriangle size={14} className="text-orange-400" title="Marked as unlocatable" />
                )}
              </div>
              <p className={`text-sm ${track.isUnlocatable ? 'text-orange-300' : 'text-gray-400'}`}>
                {track.artist}
              </p>
              {track.album && (
                <p className={`text-xs ${track.isUnlocatable ? 'text-orange-500' : 'text-gray-500'}`}>
                  {track.album}
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 ml-6">
            <p className="text-gray-500 text-xs font-mono">
              Missing: {track.originalLocation}
            </p>
            {track.isUnlocatable && (
              <p className="text-orange-400 text-xs font-semibold mt-1">
                ⚠️ Auto-relocation failed - marked as unlocatable
              </p>
            )}
            {hasRelocation && relocationPath && (
              <p className="text-green-400 text-xs font-mono mt-1">
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