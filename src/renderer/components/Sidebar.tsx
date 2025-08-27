import { Link } from '@tanstack/react-router';
import {
  MapPin,
  Download,
  Wrench,
  Copy,
  FolderOpen
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { TabType, LibraryData } from '../types';

const navItems = [
  {
    id: 'duplicates' as TabType,
    path: '/',
    label: 'Duplicate Detection',
    icon: Copy,
    description: 'Find and resolve duplicate tracks'
  },
  {
    id: 'relocate' as TabType,
    path: '/relocate',
    label: 'Track Relocation',
    icon: MapPin,
    description: 'Fix missing and moved tracks'
  },
  {
    id: 'import' as TabType,
    path: '/import',
    label: 'Auto Import',
    icon: Download,
    description: 'Automatic track importing'
  },
  {
    id: 'maintenance' as TabType,
    path: '/maintenance',
    label: 'Maintenance',
    icon: Wrench,
    description: 'Library maintenance tools'
  }
];

interface SidebarProps {
  activeTab: TabType;
  libraryData: LibraryData | null;
  libraryPath?: string;
  isLoading: boolean;
  onSelectLibrary: () => void;
}

export function Sidebar({
  activeTab,
  libraryData,
  libraryPath,
  onSelectLibrary
}: SidebarProps) {
  return (
    <nav className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* App Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">

          <div className="w-12 h-12 bg-white rounded-xl p-1 shadow-lg flex items-center justify-center">
            <img
                src="./icons/48x48.png"
                alt="Rekordbox Library Manager"
                className="w-10 h-10"
            />
          </div>
          <div>
            <h1 className="font-bold text-lg">Rekordbox</h1>
            <p className="text-xs text-gray-400">Library Manager</p>
          </div>
        </div>
      </div>

      {/* Library Info */}
      {libraryPath && (
        <div className="p-4 border-b border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Current Library</p>
          <p className="text-sm font-medium text-white truncate" title={libraryPath}>
            {libraryPath.split('/').pop()}
          </p>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isDisabled = !libraryData && item.id !== 'duplicates';

            if (isDisabled) {
              return (
                <li key={item.path}>
                  <div className="flex items-center gap-3 p-3 rounded-lg text-gray-600 cursor-not-allowed opacity-50">
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </li>
              );
            }

            return (
              <li key={item.path}>
                <Link to={item.path} preload="intent">
                  <motion.div
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg
                      transition-colors duration-200
                      ${activeTab === item.id
                        ? 'bg-rekordbox-purple/20 text-rekordbox-purple' 
                        : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.description}
                      </p>
                    </div>
                    {activeTab === item.id && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="w-1 h-8 bg-rekordbox-purple rounded-full"
                        initial={false}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 30
                        }}
                      />
                    )}
                  </motion.div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Quick Actions */}
      {!libraryPath && (
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onSelectLibrary}
            className="w-full flex items-center gap-3 p-3 bg-rekordbox-purple/20 hover:bg-rekordbox-purple/30
                     text-rekordbox-purple rounded-lg transition-colors"
          >
            <FolderOpen className="w-5 h-5" />
            <span className="font-medium text-sm">Open Library</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          Version 0.0.2
        </p>
      </div>
    </nav>
  );
}
