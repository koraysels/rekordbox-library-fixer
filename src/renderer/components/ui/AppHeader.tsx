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
        {/* Left side with logo and title */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-white rounded-xl p-2 shadow-lg flex items-center justify-center">
            <img
              src="./icons/48x48.png"
              alt="Rekordbox Library Manager"
              className="w-8 h-8"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Rekordbox Library Manager</h1>
            <p className="text-purple-100 text-sm">Fix and optimize your DJ library</p>
          </div>
        </div>

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
              <Loader2 className="w-4 h-4 animate-spin" data-testid="loader-icon" />
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
