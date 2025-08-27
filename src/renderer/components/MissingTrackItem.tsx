import React from 'react';
import { Search, Trash2 } from 'lucide-react';
import { ListItem, PopoverButton } from './ui';

interface MissingTrackItemProps {
  track: any; // TODO: Add proper type
  isSelected: boolean;
  onToggleSelection: () => void;
  onFindCandidates: () => void;
  onRemoveRelocation?: () => void;
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
    onToggleSelection();
  };

  const handleItemClick = (e: React.MouseEvent) => {
    // Only handle click if it's not on an interactive element
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('button, input, a, [role="button"]');
    
    if (!isInteractiveElement) {
      onToggleSelection();
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
              <h3 className="font-medium text-white">{track.name}</h3>
              <p className="text-gray-400 text-sm">{track.artist}</p>
              {track.album && (
                <p className="text-gray-500 text-xs">{track.album}</p>
              )}
            </div>
          </div>
          <div className="mt-2 ml-6">
            <p className="text-gray-500 text-xs font-mono">
              Missing: {track.originalLocation}
            </p>
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
              onFindCandidates();
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
                onRemoveRelocation();
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