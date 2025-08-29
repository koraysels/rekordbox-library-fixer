import React from 'react';
import { FolderOpen, FileText } from 'lucide-react';

interface EmptyLibraryStateProps {
  onSelectLibrary: () => void;
  onLoadLibrary: (filePath: string) => void;
}

export const EmptyLibraryState: React.FC<EmptyLibraryStateProps> = ({
  onSelectLibrary,
  onLoadLibrary: _onLoadLibrary
}) => {
  return (
    <div className="h-full flex items-center justify-center py-te-xl px-te-lg bg-te-grey-100">
      <div className="text-center max-w-lg w-full">
        {/* App Logo - TE Minimal */}
        <div className="mb-te-xl">
          <div className="w-16 h-16 mx-auto mb-te-lg bg-white rounded-te flex items-center justify-center">
            <img
              src="/icons/64x64.png"
              alt="Rekordbox Library Manager"
              className="w-12 h-12 opacity-90"
            />
          </div>
          <h2 className="font-te-display text-xl font-bold text-te-grey-800 mb-te-sm uppercase tracking-tight">
            REKORDBOX LIBRARY MGR
          </h2>
          <p className="text-te-grey-500 font-te-mono text-sm tracking-wider">
            MANAGE • CLEAN • OPTIMIZE
          </p>
        </div>

        {/* Load Library Section - TE Calculator Style */}
        <div className="bg-te-cream border-2 border-te-grey-300 rounded-te-lg p-te-xl mb-te-lg shadow-sm">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-te-grey-200 rounded-te flex items-center justify-center mb-te-md">
              <FileText className="w-6 h-6 text-te-grey-600" />
            </div>
            <h3 className="font-te-display text-sm font-semibold text-te-grey-800 mb-te-sm uppercase tracking-wide">
              Load XML Library
            </h3>
            <p className="text-te-grey-500 font-te-mono text-sm mb-te-lg leading-relaxed text-center">
              Select your Rekordbox XML export file to begin
            </p>
            <button
              type="button"
              onClick={onSelectLibrary}
              className="bg-te-orange hover:bg-te-orange/90 text-te-cream
                       font-te-display text-xs font-semibold py-te-md px-te-lg rounded-te
                       border-2 border-te-orange hover:shadow-lg
                       transition-all duration-200 flex items-center gap-te-sm uppercase tracking-wider
                       hover:animate-te-glow"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Browse Files</span>
            </button>
          </div>
        </div>

        {/* File Type Info - Minimal TE */}
        <div className="text-center">
          <p className="text-xs text-te-grey-400 font-te-mono uppercase tracking-wider mb-te-sm">
            Supported Formats
          </p>
          <div className="flex items-center justify-center gap-te-lg text-te-grey-500">
            <div className="flex items-center gap-te-xs bg-te-grey-200 px-te-sm py-te-xs rounded-te">
              <FileText className="w-3 h-3" />
              <span className="font-te-mono text-xs tracking-wider">XML</span>
            </div>
            <div className="w-1 h-1 bg-te-grey-300 rounded-full"></div>
            <div className="flex items-center gap-te-xs bg-te-grey-200 px-te-sm py-te-xs rounded-te">
              <FileText className="w-3 h-3" />
              <span className="font-te-mono text-xs tracking-wider">COLLECTION</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
