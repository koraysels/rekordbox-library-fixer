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
    <div className={`${level > 0 ? 'ml-te-md' : ''}`}>
      {playlists.map((playlist) => (
        <div key={playlist.name}>
          <div className="flex items-center justify-between py-te-xs">
            <div className="flex items-center gap-te-xs">
              {playlist.type === 'FOLDER' ? (
                <Folder className="w-3 h-3 text-te-grey-500" />
              ) : (
                <Music className="w-3 h-3 text-te-orange" />
              )}
              <span className="font-te-mono text-xs text-te-grey-700 truncate tracking-wide">{playlist.name}</span>
            </div>
            <span className="font-te-mono text-xs text-te-grey-400 whitespace-nowrap">{playlist.tracks.length}</span>
          </div>
          {playlist.children && playlist.children.length > 0 && (
            <PlaylistTree playlists={playlist.children} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );
};

const AppFooterComponent = React.memo(({ libraryData }: AppFooterProps) => {
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
    <div className="fixed bottom-0 left-0 right-0 bg-te-grey-300 border-t-2 border-te-grey-400 px-te-lg py-te-sm">
      <div className="flex items-center justify-between">
        <div className="font-te-mono text-xs text-te-grey-600">
          {libraryData && (
            <div className="flex items-center gap-te-lg">
              <span className="uppercase tracking-wider">{libraryData.tracks.size} TRACKS</span>

              <Popover.Root>
                <Popover.Trigger asChild>
                  <button className="flex items-center gap-te-xs hover:text-te-orange transition-colors uppercase tracking-wider">
                    <span>{playlistStats.totalPlaylists} PLAYLISTS</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </Popover.Trigger>

                <Popover.Portal>
                  <Popover.Content
                    className="z-50 w-80 max-h-96 overflow-y-auto bg-te-cream border-2 border-te-grey-300 rounded-te-lg shadow-xl p-te-lg"
                    sideOffset={5}
                  >
                    <div className="space-y-te-md">
                      <div className="flex items-center justify-between">
                        <h3 className="font-te-display font-semibold text-te-grey-800 text-sm uppercase tracking-wide">Playlist Overview</h3>
                        <Popover.Close asChild>
                          <button className="text-te-grey-500 hover:text-te-orange transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </Popover.Close>
                      </div>

                      <div className="grid grid-cols-2 gap-te-md text-xs">
                        <div className="bg-te-grey-200 rounded-te p-te-md border border-te-grey-300">
                          <div className="flex items-center gap-te-xs mb-te-xs">
                            <Music className="w-3 h-3 text-te-orange" />
                            <span className="text-te-grey-700 font-te-display uppercase tracking-wider">Playlists</span>
                          </div>
                          <div className="text-lg font-bold text-te-grey-800 font-te-display">{playlistStats.totalPlaylists}</div>
                        </div>

                        <div className="bg-te-grey-200 rounded-te p-te-md border border-te-grey-300">
                          <div className="flex items-center gap-te-xs mb-te-xs">
                            <Folder className="w-3 h-3 text-te-grey-500" />
                            <span className="text-te-grey-700 font-te-display uppercase tracking-wider">Folders</span>
                          </div>
                          <div className="text-lg font-bold text-te-grey-800 font-te-display">{playlistStats.folders}</div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-te-display text-xs font-medium text-te-grey-700 mb-te-sm uppercase tracking-wide">Structure</h4>
                        <div className="max-h-48 overflow-y-auto bg-te-grey-100 rounded-te border border-te-grey-300 p-te-md">
                          {libraryData.playlists.length > 0 ? (
                            <PlaylistTree playlists={libraryData.playlists} />
                          ) : (
                            <div className="text-center text-te-grey-500 py-te-md">
                              <Music className="w-6 h-6 mx-auto mb-te-sm opacity-50" />
                              <p className="font-te-mono text-xs uppercase tracking-wide">No playlists</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Popover.Arrow className="fill-te-grey-300" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          )}
        </div>

        <div className="font-te-mono text-xs text-te-grey-500 uppercase tracking-wider">
          V{version} • (C) Koray Sels 2025
        </div>
      </div>
    </div>
  );
})

AppFooterComponent.displayName = 'AppFooter';

export const AppFooter = AppFooterComponent;
