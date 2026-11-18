import React, { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createVirtualizer } from '@ui-sdk/core';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey: (item: T, index: number) => string | number;
  emptyState?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** A row's height before it is measured, gap included. */
  estimate?: number;
}

const PAD = 8;

// Renders only the rows in view: a library with thousands of missing tracks
// otherwise mounted every row on each visit to the page.
export const VirtualizedList = <T,>({
  items,
  renderItem,
  getItemKey,
  emptyState,
  className = '',
  style = {},
  estimate = 100,
}: VirtualizedListProps<T>) => {
  const latest = useRef({ items, getItemKey });
  latest.current = { items, getItemKey };
  const [rows] = useState(() => createVirtualizer({
    count: () => latest.current.items.length,
    estimate: () => estimate,
    key: (i) => String(latest.current.getItemKey(latest.current.items[i], i)),
    overscan: 6,
  }));
  const scroller = useRef<HTMLDivElement>(null);
  const empty = items.length === 0;

  useLayoutEffect(() => {
    if (!scroller.current) return;
    return rows.connect(scroller.current);
  }, [rows, empty]);

  useLayoutEffect(() => { rows.refresh(); }, [rows, items]);

  const visible = useSyncExternalStore(rows.subscribe, rows.items, rows.items);

  if (empty && emptyState) {
    return <>{emptyState}</>;
  }

  if (empty) {
    return (
      <div className="p-5 te-value font-te-mono" role="status" aria-live="polite">
        No items to show
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      className={`h-full overflow-y-auto overflow-x-hidden ${className}`}
      style={style}
    >
      <div style={{ position: 'relative', height: rows.size() + PAD * 2 }}>
        {visible.map((row) => {
          const item = items[row.index];
          if (item === undefined) return null;
          return (
            <div
              key={row.key}
              ref={(el) => rows.measure(row.index, el)}
              className="pb-3"
              style={{ position: 'absolute', top: row.start + PAD, left: 0, right: 0 }}
            >
              {renderItem(item, row.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
