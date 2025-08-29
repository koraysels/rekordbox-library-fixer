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
    <div className="flex-shrink-0 py-te-lg px-0 border-b-2 border-te-grey-300 bg-te-cream">
      <div className="flex items-center justify-between mx-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <Icon className="text-te-orange" size={24} />
            <h1 className="te-title">{title}</h1>
          </div>
          {stats && (
            <div className="te-label bg-te-grey-200 px-te-md py-te-sm rounded-te border border-te-grey-300">
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