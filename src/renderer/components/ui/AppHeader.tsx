import React from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';

interface AppHeaderProps {
  libraryPath: string;
  isLoading: boolean;
  onSelectLibrary: () => void;
}

const AppHeaderComponent: React.FC<AppHeaderProps> = React.memo(({
  libraryPath,
  isLoading,
  onSelectLibrary
}) => {
  return (
    <header className="bg-gradient-to-r from-te-orange to-te-grey-700 shadow-lg">
      <div className="flex items-center justify-between px-6 py-3">
        {/* App region for dragging */}
        <div className="flex-1 app-drag-region"></div>

        {/* Right side with library info and button */}
        <div className="flex items-center space-x-4">
          {libraryPath && (
            <div className="text-right">
              <p className="text-te-cream text-xs font-te-mono">Current Library</p>
              <p className="text-te-cream text-sm font-medium max-w-xs truncate font-te-mono" title={libraryPath}>
                {libraryPath}
              </p>
            </div>
          )}
          <button
            onClick={onSelectLibrary}
            className="bg-te-cream/20 hover:bg-te-cream/30 text-te-cream font-medium py-2 px-4 rounded-te
                     transition-colors duration-200 flex items-center space-x-2 font-te-display"
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
});

AppHeaderComponent.displayName = 'AppHeader';

export const AppHeader = AppHeaderComponent;
