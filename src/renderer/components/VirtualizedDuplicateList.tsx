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
  console.log('🎯 VirtualizedDuplicateList render:', { 
    duplicatesCount: duplicates.length,
    firstDuplicate: duplicates[0]?.id,
    selectedCount: selectedDuplicates.size
  });
  
  // Temporary debug: show first few items without virtualization
  if (duplicates.length === 0) {
    return <div style={{ padding: '20px', color: 'white' }}>No duplicates to show</div>;
  }
  
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '10px', color: 'white', fontSize: '14px' }}>
        Debug: Found {duplicates.length} duplicates
      </div>
      
      {/* Temporary: render first 3 items normally to debug */}
      <div style={{ padding: '10px' }}>
        {duplicates.slice(0, 3).map((duplicate, index) => {
          console.log('📋 Manual render item:', { index, duplicateId: duplicate?.id, duplicate });
          return (
            <div key={duplicate?.id || index} style={{ marginBottom: '12px' }}>
              <DuplicateItem
                duplicate={duplicate}
                isSelected={selectedDuplicates.has(duplicate.id)}
                onToggleSelection={() => onToggleSelection(duplicate.id)}
                resolutionStrategy={resolutionStrategy}
              />
            </div>
          );
        })}
      </div>
      
      <div style={{ padding: '10px', color: 'yellow', fontSize: '12px' }}>
        Showing first 3 items only for debugging. Total: {duplicates.length}
      </div>
    </div>
  );
};