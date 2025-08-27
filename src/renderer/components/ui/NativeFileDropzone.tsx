import React, { useCallback, useEffect, useState } from 'react';
import { Upload, FolderOpen } from 'lucide-react';

interface NativeFileDropzoneProps {
  onFileDrop: (filePath: string) => void;
  onBrowseClick: () => void;
  disabled?: boolean;
  className?: string;
  acceptedFileTypes?: string[];
}

export const NativeFileDropzone: React.FC<NativeFileDropzoneProps> = ({
  onFileDrop,
  onBrowseClick,
  disabled = false,
  className = '',
  acceptedFileTypes = ['.xml']
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<string[]>([]);

  // Handle native file drops
  useEffect(() => {
    if (!window.electronAPI?.onFileDrop) return;

    const handleFileDrop = (filePaths: string[]) => {
      console.log('Native file drop received:', filePaths);
      setIsDragOver(false);
      
      // Filter for accepted file types
      const validFiles = filePaths.filter(filePath => {
        const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
        return acceptedFileTypes.includes(extension);
      });

      if (validFiles.length > 0) {
        setDroppedFiles(validFiles);
        // Use the first valid file
        onFileDrop(validFiles[0]);
      } else {
        console.warn('No valid files found in drop');
      }
    };

    const cleanup = window.electronAPI.onFileDrop(handleFileDrop);
    return cleanup;
  }, [onFileDrop, acceptedFileTypes]);

  // Handle native file dialog
  const handleBrowseClick = useCallback(async () => {
    try {
      const result = await window.electronAPI.openFileDialog({
        filters: [
          { name: 'Rekordbox XML', extensions: ['xml'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.success && result.data?.filePath) {
        onFileDrop(result.data.filePath);
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      // Fallback to the provided browse function
      onBrowseClick();
    }
  }, [onFileDrop, onBrowseClick]);

  // Visual drag state handlers
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only set drag over to false if we're leaving the window
      if (!e.relatedTarget) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <div className={`text-center max-w-2xl mx-auto ${className}`}>
      <div className={`
        border-2 border-dashed rounded-2xl p-12 transition-all duration-200 
        ${isDragOver 
          ? 'border-rekordbox-purple bg-rekordbox-purple/5 scale-105' 
          : 'border-gray-600 hover:border-gray-500'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-800/50'}
      `}>
        {/* Icon */}
        <div className={`
          w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6 transition-colors
          ${isDragOver ? 'bg-rekordbox-purple/20' : 'bg-gray-700'}
        `}>
          <Upload className={`w-8 h-8 ${isDragOver ? 'text-rekordbox-purple' : 'text-gray-300'}`} />
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {isDragOver ? 'Drop your Rekordbox library here' : 'Import Rekordbox Library'}
            </h3>
            <p className="text-gray-400 leading-relaxed max-w-md mx-auto">
              {isDragOver 
                ? 'Release to import your library file'
                : 'Drag and drop your Rekordbox XML file here, or click to browse'
              }
            </p>
          </div>

          {/* Browse Button */}
          <button
            onClick={handleBrowseClick}
            disabled={disabled}
            className="btn-primary inline-flex items-center space-x-2 px-6 py-3"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Browse Files</span>
          </button>

          {/* File info */}
          <div className="text-xs text-gray-500">
            Supported: Rekordbox XML files (.xml)
          </div>
        </div>
      </div>

      {/* Dropped files display */}
      {droppedFiles.length > 0 && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Recently Dropped Files:</h4>
          <ul className="space-y-1">
            {droppedFiles.slice(0, 3).map((filePath, index) => (
              <li key={index} className="text-xs text-gray-400 truncate">
                {filePath}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};