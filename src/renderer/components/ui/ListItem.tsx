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
  const baseClasses = 'bg-te-cream rounded-te p-4 border-2 transition-colors';
  const interactiveClasses = interactive ? 'cursor-pointer' : '';
  const selectedClasses = isSelected
    ? 'border-te-orange bg-te-orange/10'
    : 'border-te-grey-300 hover:border-te-grey-400';

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