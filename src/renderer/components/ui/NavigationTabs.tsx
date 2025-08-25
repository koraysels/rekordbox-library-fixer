import React from 'react';
import { Search, FolderOpen, Disc3, Settings } from 'lucide-react';
import type { TabType, LibraryData } from '../../types';

interface NavigationTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  libraryData: LibraryData | null;
}

const tabs = [
  { id: 'duplicates' as TabType, label: 'Duplicate Detection', icon: Search },
  { id: 'import' as TabType, label: 'Auto Import', icon: FolderOpen },
  { id: 'relocate' as TabType, label: 'Track Relocation', icon: Disc3 },
  { id: 'maintenance' as TabType, label: 'Maintenance', icon: Settings },
];

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange,
  libraryData
}) => {
  return (
    <div className="border-b border-zinc-800">
      <div className="px-6 flex space-x-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 font-medium text-sm flex items-center space-x-2 border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'text-rekordbox-purple border-rekordbox-purple'
                  : 'text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
              disabled={!libraryData && tab.id !== 'duplicates'}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};