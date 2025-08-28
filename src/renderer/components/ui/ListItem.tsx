import React from 'react';

interface ListItemProps {
  /** Whether the item is selected */
  isSelected?: boolean;
  /** Click handler for the entire item */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Item content */
  children: React.ReactNode;
  /** Whether the item is clickable/interactive */
  interactive?: boolean;
}

export const ListItem: React.FC<ListItemProps> = ({
  isSelected = false,
  onClick,
  className = '',
  children,
  interactive = true
}) => {
  const baseClasses = 'bg-gray-800 rounded-lg p-4 border transition-colors';
  const interactiveClasses = interactive ? 'cursor-pointer' : '';
  const selectedClasses = isSelected
    ? 'border-rekordbox-purple bg-purple-900/20'
    : 'border-gray-700 hover:border-gray-600';

  const combinedClasses = `${baseClasses} ${interactiveClasses} ${selectedClasses} ${className}`;

  return (
    <div
      className={combinedClasses}
      onClick={onClick}
    >
      {children}
    </div>
  );
};