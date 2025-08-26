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
    <header className="bg-gradient-to-r from-rekordbox-purple to-purple-700 shadow-lg app-drag-region">
      <div className="flex items-center justify-between px-6 py-2" style={{ paddingLeft: '90px' }}>
        {/* Left side with logo and title */}
        <div className="flex items-center space-x-2 no-drag">
          <img
            src="/icons/48x48.png"
            alt="Rekordbox Library Manager"
            className="w-10 h-10 bg-white rounded-lg p-1 shadow-lg"
          />
          <div>
            <h1 className="text-sm font-bold text-white">Rekordbox/upga Library Manager</h1>
            <p className="text-purple-100 text-xs leading-tight">Fix and optimize your DJ library</p>
          </div>
        </div>

        {/* Right side with library info and button */}
        <div className="flex items-center space-x-3 no-drag" style={{ paddingRight: '20px' }}>
          {libraryPath && (
            <div className="text-right">
              <p className="text-purple-100 text-xs">Current Library</p>
              <p className="text-white text-xs font-medium max-w-xs truncate" title={libraryPath}>
                {libraryPath.length > 35 ? '...' + libraryPath.slice(-32) : libraryPath.split('/').pop()}
              </p>
            </div>
          )}
          <button
            onClick={onSelectLibrary}
            className="btn-primary flex items-center space-x-1 text-xs px-2 py-1.5"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" data-testid="loader-icon" />
            ) : (
              <FolderOpen className="w-3 h-3" />
            )}
            <span>{libraryPath ? 'Change Library' : 'Select Library'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
