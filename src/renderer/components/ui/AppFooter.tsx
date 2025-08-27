import React, { useMemo, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Music, Folder, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { LibraryData, Playlist } from '../../types';

interface AppFooterProps {
  libraryData: LibraryData | null;
}

// Helper functions to count playlists
const countAllPlaylists = (playlists: Playlist[]): number => {
  return playlists.reduce((count, playlist) => {
    if (playlist.type === 'PLAYLIST') {
      count += 1;
    }
    if (playlist.children) {
      count += countAllPlaylists(playlist.children);
    }
    return count;
  }, 0);
};

const countFolders = (playlists: Playlist[]): number => {
  return playlists.reduce((count, playlist) => {
    if (playlist.type === 'FOLDER') {
      count += 1;
    }
    if (playlist.children) {
      count += countFolders(playlist.children);
    }
    return count;
  }, 0);
};

// Recursive component to render playlist tree
const PlaylistTree: React.FC<{ playlists: Playlist[]; level?: number }> = ({ 
  playlists, 
  level = 0 
}) => {
  return (
    <div className={`${level > 0 ? 'ml-4' : ''}`}>
      {playlists.map((playlist) => (
        <div key={playlist.name}>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center space-x-2">
              {playlist.type === 'FOLDER' ? (
                <Folder className="w-3 h-3 text-zinc-500" />
              ) : (
                <Music className="w-3 h-3 text-rekordbox-purple" />
              )}
              <span className="text-sm text-zinc-300 truncate">{playlist.name}</span>
            </div>
            <span className="text-xs text-zinc-500 whitespace-nowrap">{playlist.tracks.length} tracks</span>
          </div>
          {playlist.children && playlist.children.length > 0 && (
            <PlaylistTree playlists={playlist.children} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );
};

export const AppFooter: React.FC<AppFooterProps> = React.memo(({ libraryData }) => {
  const version = useAppStore((state) => state.version);
  const loadVersion = useAppStore((state) => state.loadVersion);

  const playlistStats = useMemo(() => {
    if (!libraryData || !libraryData.playlists) {
      return { totalPlaylists: 0, folders: 0 };
    }
    
    return {
      totalPlaylists: countAllPlaylists(libraryData.playlists),
      folders: countFolders(libraryData.playlists)
    };
  }, [libraryData]);

  useEffect(() => {
    loadVersion();
  }, [loadVersion]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">
          {libraryData && (
            <div className="flex items-center space-x-4">
              <span>Library: {libraryData.tracks.size} tracks</span>
              
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button className="flex items-center space-x-1 hover:text-zinc-200 transition-colors">
                    <span>{playlistStats.totalPlaylists} playlists</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </Popover.Trigger>
                
                <Popover.Portal>
                  <Popover.Content
                    className="z-50 w-80 max-h-96 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-4"
                    sideOffset={5}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white">Playlist Overview</h3>
                        <Popover.Close asChild>
                          <button className="text-zinc-400 hover:text-zinc-200">
                            <X className="w-4 h-4" />
                          </button>
                        </Popover.Close>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-zinc-900 rounded p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <Music className="w-4 h-4 text-rekordbox-purple" />
                            <span className="text-zinc-300">Playlists</span>
                          </div>
                          <div className="text-xl font-bold text-white">{playlistStats.totalPlaylists}</div>
                        </div>
                        
                        <div className="bg-zinc-900 rounded p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <Folder className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-300">Folders</span>
                          </div>
                          <div className="text-xl font-bold text-white">{playlistStats.folders}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-zinc-300 mb-2">Playlist Structure</h4>
                        <div className="max-h-48 overflow-y-auto bg-zinc-900 rounded p-3">
                          {libraryData.playlists.length > 0 ? (
                            <PlaylistTree playlists={libraryData.playlists} />
                          ) : (
                            <div className="text-center text-zinc-500 py-4">
                              <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No playlists found</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Popover.Arrow className="fill-zinc-700" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          )}
        </div>
        
        <div className="text-xs text-zinc-500">
          Version {version} • Made with ❤️ for DJs
        </div>
      </div>
    </div>
  );
});