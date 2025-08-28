import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Icon to display next to title */
  icon: LucideIcon;
  /** Stats/info text to display next to title */
  stats?: string;
  /** Action buttons to display on the right */
  actions?: React.ReactNode;
  /** Additional content below the main header row */
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  icon: Icon,
  stats,
  actions,
  children
}) => {
  return (
    <div className="flex-shrink-0 py-4 px-0 border-b border-gray-700">
      <div className="flex items-center justify-between mx-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <Icon className="text-rekordbox-purple" size={24} />
            <h1 className="text-2xl font-bold text-white">{title}</h1>
          </div>
          {stats && (
            <div className="text-sm text-gray-400 bg-gray-800 px-3 py-1.5 rounded-full">
              {stats}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
};