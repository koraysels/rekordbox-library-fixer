import {Link} from '@tanstack/react-router';
import {
    MapPin,
    Download,
    Wrench,
    Copy,
    FolderOpen,
    X
} from 'lucide-react';
import {motion} from 'framer-motion';
import type {TabType, LibraryData} from '../types';

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
    onUnloadLibrary?: () => void;
}

export function Sidebar({
                            activeTab,
                            libraryData,
                            libraryPath,
                            onSelectLibrary,
                            onUnloadLibrary
                        }: SidebarProps) {
    return (
        <nav className="w-64 bg-te-grey-200 border-r-2 border-te-grey-300 flex flex-col pb-6">
            {/* App Header - Minimalist TE Style */}
            <div className="p-te-lg border-b-2 border-te-grey-300">
                <div className="flex items-center gap-te-md">
                    <div className="w-10 h-10 bg-white rounded-te flex items-center justify-center">
                        <img
                            src="./icons/48x48.png"
                            alt="Rekordbox Library Fixer"
                            className="w-8 h-8 opacity-90"
                        />
                    </div>
                    <div>
                        <h1 className="font-te-display text-te-grey-800 font-bold text-sm tracking-te-display">REKORDBOX</h1>
                        <p className="text-xs text-te-grey-500 font-te-mono tracking-wider">LIBRARY FIXER</p>
                    </div>
                </div>
            </div>

            {/* Navigation Links - TE Minimal Style */}
            <div className="flex-1 p-te-lg">
                <ul className="space-y-te-sm">
                    {navItems.map((item) => {
                        const isDisabled = !libraryData && item.id !== 'duplicates';

                        if (isDisabled) {
                            return (
                                <li key={item.path}>
                                    <div
                                        className="flex items-center gap-te-md p-te-md rounded-te bg-te-grey-300/50 text-te-grey-400 cursor-not-allowed border-2 border-te-grey-300/50">
                                        <item.icon className="w-4 h-4 flex-shrink-0"/>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-te-display text-xs font-medium uppercase tracking-te-display">
                                                {item.label}
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
                                        whileHover={{scale: 1.02}}
                                        whileTap={{scale: 0.98}}
                                        className={`
                      flex items-center gap-te-md p-te-md rounded-te border-2 
                      transition-all duration-200 font-te-mono text-xs font-medium uppercase tracking-wider
                      ${activeTab === item.id
                                            ? 'bg-te-orange text-te-cream border-te-orange shadow-lg'
                                            : 'bg-te-cream text-te-grey-700 border-te-grey-300 hover:bg-te-grey-100 hover:border-te-grey-400 hover:text-te-grey-800'
                                        }
                    `}
                                    >
                                        <item.icon className="w-4 h-4 flex-shrink-0"/>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-nowrap pr-1  ${activeTab && "text-xxs"}`}>
                                                {item.label}
                                            </p>
                                        </div>
                                        {activeTab === item.id && (
                                            <motion.div
                                                layoutId="activeIndicator"
                                                className="w-2 h-2 bg-te-cream rounded-full"
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

            {/* Quick Actions - TE Style */}
            {!libraryPath && (
                <div className="p-te-lg border-t-2 border-te-grey-300">
                    <button
                        onClick={onSelectLibrary}
                        className="w-full flex items-center justify-center gap-te-md p-te-md bg-te-orange hover:bg-te-orange/90
                     text-te-cream rounded-te font-te-mono text-xs font-medium uppercase tracking-wider
                     transition-all duration-200 border-2 border-te-orange hover:shadow-lg"
                    >
                        <FolderOpen className="w-4 h-4"/>
                        <span>Open Library</span>
                    </button>
                </div>
            )}

            {/* Library Info Section - TE Minimal */}
            {libraryPath && (
                <div className="border-t-2 border-te-grey-300">
                    <div className="p-te-lg">
                        <div className="bg-te-grey-800 rounded-te p-te-md">
                            <div className="flex items-center justify-between mb-te-sm">
                                <p className="text-te-grey-300 text-xs font-te-display font-medium uppercase tracking-te-display">Library</p>
                                <div className="flex items-center space-x-te-sm">
                                    <button
                                        onClick={onSelectLibrary}
                                        className="text-te-grey-400 hover:text-te-orange transition-colors p-1 rounded"
                                        title="Change Library"
                                    >
                                        <FolderOpen className="w-3 h-3"/>
                                    </button>
                                    {onUnloadLibrary && (
                                        <button
                                            onClick={onUnloadLibrary}
                                            className="text-te-grey-400 hover:text-te-red-500 transition-colors p-1 rounded"
                                            title="Unload Library"
                                        >
                                            <X className="w-3 h-3"/>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-te-cream text-xs font-te-mono truncate" title={libraryPath}>
                                {libraryPath}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer - Minimal TE */}
            <div className="p-te-lg border-t-2 border-te-grey-300">
                <p className="text-xs text-te-grey-500 text-center font-te-mono tracking-wider">
                    🖤 FOR DJs
                </p>
            </div>
        </nav>
    );
}
