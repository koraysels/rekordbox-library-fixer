import React from 'react';
import { FolderOpen, FileText } from 'lucide-react';

interface EmptyLibraryStateProps {
  onSelectLibrary: () => void;
  onLoadLibrary: (filePath: string) => void;
}

export const EmptyLibraryState: React.FC<EmptyLibraryStateProps> = ({ 
  onSelectLibrary,
  onLoadLibrary
}) => {
  return (
    <div className="h-full flex items-center justify-center py-8 px-0">
      <div className="text-center max-w-2xl w-full">
        {/* App Logo */}
        <div className="mb-8">
          <img 
            src="/icons/64x64.png" 
            alt="Rekordbox Library Manager" 
            className="w-24 h-24 mx-auto mb-4 bg-white rounded-3xl p-3 shadow-lg"
          />
          <h2 className="text-3xl font-bold text-white mb-2">Welcome to Rekordbox Library Manager</h2>
          <p className="text-zinc-400 text-lg">
            Manage, clean, and optimize your Rekordbox music library
          </p>
        </div>

        {/* Browse Button Only - Drag & Drop Temporarily Disabled */}
        <div className="border-2 border-dashed border-gray-600 rounded-3xl p-12 mb-8">
          <div className="flex flex-col items-center">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-2">Load Your Library</h3>
            <p className="text-zinc-400 mb-6 leading-relaxed">
              Click the button below to browse and select your Rekordbox XML library file
            </p>
            <button
              type="button"
              onClick={onSelectLibrary}
              className="bg-rekordbox-purple hover:bg-rekordbox-purple/90 
                       text-white font-semibold py-4 px-8 rounded-xl 
                       transition-colors duration-200 flex items-center space-x-3"
            >
              <FolderOpen className="w-5 h-5" />
              <span>Browse for XML File</span>
            </button>
          </div>
        </div>

        {/* File Type Info */}
        <div className="text-center">
          <p className="text-xs text-zinc-500 mb-2">Supported file types</p>
          <div className="flex items-center justify-center space-x-6 text-zinc-400">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span className="text-sm">Rekordbox XML</span>
            </div>
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span className="text-sm">Collection.xml</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};