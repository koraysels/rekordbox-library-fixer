import React from 'react';
import { FileDropzone } from './FileDropzone';

interface EmptyLibraryStateProps {
  onSelectLibrary: () => void;
  onLoadLibrary: (filePath: string) => void;
}

export const EmptyLibraryState: React.FC<EmptyLibraryStateProps> = ({ 
  onSelectLibrary,
  onLoadLibrary
}) => {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <FileDropzone 
        onFileDrop={onLoadLibrary}
        onBrowseClick={onSelectLibrary}
      />
    </div>
  );
};