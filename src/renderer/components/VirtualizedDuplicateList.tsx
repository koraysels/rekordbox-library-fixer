import React from 'react';
import DuplicateItem from './DuplicateItem';
import { VirtualizedList } from './VirtualizedList';
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
  console.log('🎯 VirtualizedDuplicateList render:', { 
    duplicatesCount: duplicates.length,
    firstDuplicate: duplicates[0]?.id,
    selectedCount: selectedDuplicates.size
  });
  
  return (
    <VirtualizedList
      items={duplicates}
      getItemKey={(duplicate) => duplicate?.id || 'unknown'}
      renderItem={(duplicate) => (
        <DuplicateItem
          duplicate={duplicate}
          isSelected={selectedDuplicates.has(duplicate.id)}
          onToggleSelection={() => onToggleSelection(duplicate.id)}
          resolutionStrategy={resolutionStrategy}
        />
      )}
      emptyState={<div className="p-5 text-white">No duplicates to show</div>}
      className="px-4"
    />
  );
};