import React, { useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import DuplicateItem from './DuplicateItem';
import type { DuplicateItem as DuplicateItemType, ResolutionStrategy } from '../types';

interface VirtualizedDuplicateListProps {
  duplicates: DuplicateItemType[];
  selectedDuplicates: Set<string>;
  onToggleSelection: (id: string) => void;
  resolutionStrategy: ResolutionStrategy;
  containerHeight?: number;
}

export const VirtualizedDuplicateList: React.FC<VirtualizedDuplicateListProps> = ({
  duplicates,
  selectedDuplicates,
  onToggleSelection,
  resolutionStrategy,
  containerHeight = 600
}) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: duplicates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated height per item
    overscan: 5, // Render 5 extra items above and below for smooth scrolling
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height: `${containerHeight}px` }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => {
          const duplicate = duplicates[virtualItem.index];
          
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="pb-4">
                <DuplicateItem
                  duplicate={duplicate}
                  isSelected={selectedDuplicates.has(duplicate.id)}
                  onToggleSelection={() => onToggleSelection(duplicate.id)}
                  resolutionStrategy={resolutionStrategy}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};