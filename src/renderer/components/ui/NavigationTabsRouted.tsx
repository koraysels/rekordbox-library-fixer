import React from 'react';
import { Link } from '@tanstack/react-router';
import { Search, FolderOpen, Disc3, Settings } from 'lucide-react';
import type { TabType, LibraryData } from '../../types';

interface NavigationTabsRoutedProps {
  activeTab: TabType;
  libraryData: LibraryData | null;
}

const tabs = [
  { id: 'duplicates' as TabType, path: '/', label: 'Duplicate Detection', icon: Search },
  { id: 'relocate' as TabType, path: '/relocate', label: 'Track Relocation', icon: Disc3 },
  { id: 'import' as TabType, path: '/import', label: 'Auto Import', icon: FolderOpen },
  { id: 'maintenance' as TabType, path: '/maintenance', label: 'Maintenance', icon: Settings },
];

export const NavigationTabsRouted: React.FC<NavigationTabsRoutedProps> = ({
  activeTab,
  libraryData
}) => {
  return (
    <div className="border-b border-zinc-800 bg-zinc-900">
      <div className="px-6 flex space-x-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isDisabled = !libraryData && tab.id !== 'duplicates';
          
          if (isDisabled) {
            return (
              <button
                key={tab.id}
                className="px-4 py-3 font-medium text-sm flex items-center space-x-2 border-b-2 
                          text-zinc-600 border-transparent cursor-not-allowed opacity-50"
                disabled
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          }
          
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`px-4 py-3 font-medium text-sm flex items-center space-x-2 border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'text-rekordbox-purple border-rekordbox-purple'
                  : 'text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
              preload="intent"
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};