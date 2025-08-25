import React from 'react';
import { Music, FolderOpen } from 'lucide-react';

interface EmptyLibraryStateProps {
  onSelectLibrary: () => void;
}

export const EmptyLibraryState: React.FC<EmptyLibraryStateProps> = ({ onSelectLibrary }) => {
  return (
    <div className="card text-center py-20">
      <Music className="w-20 h-20 mx-auto text-zinc-600 mb-4" />
      <h3 className="text-xl font-semibold mb-2">No Library Loaded</h3>
      <p className="text-zinc-400 mb-6">
        Select your Rekordbox XML library file to get started
      </p>
      <button
        onClick={onSelectLibrary}
        className="btn-primary mx-auto flex items-center space-x-2"
      >
        <FolderOpen className="w-4 h-4" />
        <span>Select Library</span>
      </button>
    </div>
  );
};