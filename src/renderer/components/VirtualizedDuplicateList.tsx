import React from 'react';
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
  console.log('🎯 VirtualizedDuplicateList render:', { 
    duplicatesCount: duplicates.length,
    firstDuplicate: duplicates[0]?.id,
    selectedCount: selectedDuplicates.size
  });
  
  if (duplicates.length === 0) {
    return <div style={{ padding: '20px', color: 'white' }}>No duplicates to show</div>;
  }
  
  // Regular scrollable list - will be heavy but works
  return (
    <div 
      style={{ 
        height: '100%', // Explicit height
        overflowY: 'auto', // Vertical scroll
        overflowX: 'hidden', // No horizontal scroll
        padding: '8px 0'
      }}
    >
      {duplicates.map((duplicate, index) => (
        <div key={duplicate?.id || index} style={{ marginBottom: '12px' }}>
          <DuplicateItem
            duplicate={duplicate}
            isSelected={selectedDuplicates.has(duplicate.id)}
            onToggleSelection={() => onToggleSelection(duplicate.id)}
            resolutionStrategy={resolutionStrategy}
          />
        </div>
      ))}
    </div>
  );
};