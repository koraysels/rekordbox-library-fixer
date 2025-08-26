import React from 'react';
import { Music, FolderOpen, Loader2 } from 'lucide-react';

interface AppHeaderProps {
  libraryPath: string;
  isLoading: boolean;
  onSelectLibrary: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  libraryPath,
  isLoading,
  onSelectLibrary
}) => {
  return (
    <header className="bg-gradient-to-r from-rekordbox-purple to-purple-700 px-6 py-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Music className="w-6 h-6 text-white" />
          <div>
            <h1 className="text-lg font-bold text-white">Rekordbox Library Manager</h1>
            <p className="text-purple-100 text-xs">Fix and optimize your DJ library</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {libraryPath && (
            <div className="text-right">
              <p className="text-purple-100 text-xs">Current Library</p>
              <p className="text-white text-sm font-medium max-w-xs" title={libraryPath}>
                {libraryPath.length > 40 ? '...' + libraryPath.slice(-37) : libraryPath.split('/').pop()}
              </p>
            </div>
          )}
          <button
            onClick={onSelectLibrary}
            className="btn-primary flex items-center space-x-2 text-sm px-3 py-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            <span>{libraryPath ? 'Change Library' : 'Select Library'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};