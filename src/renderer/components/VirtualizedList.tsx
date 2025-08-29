import React from 'react';

interface VirtualizedListProps<T> {
  /** Array of items to display */
  items: T[];
  /** Function to render each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Function to get unique key for each item */
  getItemKey: (item: T, index: number) => string | number;
  /** Empty state component */
  emptyState?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Container style overrides */
  style?: React.CSSProperties;
}

export const VirtualizedList = <T,>({
  items,
  renderItem,
  getItemKey,
  emptyState,
  className = '',
  style = {}
}: VirtualizedListProps<T>) => {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  if (items.length === 0) {
    return (
      <div className="p-5 te-value font-te-mono" role="status" aria-live="polite">
        No items to show
      </div>
    );
  }

  return (
    <div
      className={`h-full overflow-y-auto overflow-x-hidden py-2 ${className}`}
      style={style}
    >
      {items.map((item, index) => (
        <div key={getItemKey(item, index)} className="mb-3">
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
};