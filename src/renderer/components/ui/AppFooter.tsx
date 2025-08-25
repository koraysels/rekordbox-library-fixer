import React from 'react';
import type { LibraryData } from '../../types';

interface AppFooterProps {
  libraryData: LibraryData | null;
}

export const AppFooter: React.FC<AppFooterProps> = ({ libraryData }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">
          {libraryData && (
            <span>
              Library: {libraryData.tracks.size} tracks • {libraryData.playlists.length} playlists
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500">
          Version 0.0.1 • Made with ❤️ for DJs
        </div>
      </div>
    </div>
  );
};