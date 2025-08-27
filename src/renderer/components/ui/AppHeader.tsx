import React from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';

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
    <header className="bg-gradient-to-r from-rekordbox-purple to-purple-700 shadow-lg">
      <div className="flex items-center justify-between px-6 py-3">
        {/* App region for dragging */}
        <div className="flex-1 app-drag-region"></div>

        {/* Right side with library info and button */}
        <div className="flex items-center space-x-4">
          {libraryPath && (
            <div className="text-right">
              <p className="text-purple-100 text-xs">Current Library</p>
              <p className="text-white text-sm font-medium max-w-xs truncate" title={libraryPath}>
                {libraryPath}
              </p>
            </div>
          )}
          <button
            onClick={onSelectLibrary}
            className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-4 rounded-lg 
                     transition-colors duration-200 flex items-center space-x-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin spinner-loading" data-testid="loader-icon" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            <span className="text-sm">{libraryPath ? 'Change Library' : 'Select Library'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
