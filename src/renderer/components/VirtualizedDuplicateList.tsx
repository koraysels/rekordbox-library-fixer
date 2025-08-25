import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import DuplicateItem from './DuplicateItem';
import type { DuplicateItem as DuplicateItemType, ResolutionStrategy } from '../types';

interface VirtualizedDuplicateListProps {
  duplicates: DuplicateItemType[];
  selectedDuplicates: Set<string>;
  onToggleSelection: (id: string) => void;
  resolutionStrategy: ResolutionStrategy;
}

export const VirtualizedDuplicateList: React.FC<VirtualizedDuplicateListProps> = ({
  duplicates,
  selectedDuplicates,
  onToggleSelection,
  resolutionStrategy
}) => {
  return (
    <div className="flex-1" style={{ height: '100%' }}>
      <Virtuoso
        data={duplicates}
        itemContent={(index, duplicate) => (
          <div style={{ paddingBottom: '8px' }}>
            <DuplicateItem
              duplicate={duplicate}
              isSelected={selectedDuplicates.has(duplicate.id)}
              onToggleSelection={() => onToggleSelection(duplicate.id)}
              resolutionStrategy={resolutionStrategy}
            />
          </div>
        )}
        style={{ height: '100%' }}
        overscan={200}
      />
    </div>
  );
};