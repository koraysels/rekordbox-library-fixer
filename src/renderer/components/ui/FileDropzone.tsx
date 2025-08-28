import React from 'react';
import { FolderOpen, Upload, FileText, AlertCircle } from 'lucide-react';
import { useFileDropzone } from '../../hooks/useFileDropzone';

interface FileDropzoneProps {
  onFileDrop: (filePath: string) => void;
  onBrowseClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileDrop,
  onBrowseClick,
  disabled = false,
  className = ''
}) => {
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
    hasRejectedFiles,
    rejectionErrors
  } = useFileDropzone({
    onDrop: onFileDrop,
    disabled
  });

  return (
    <div className={`text-center max-w-2xl w-full ${className}`}>
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

      {/* Drag and Drop Area */}
      <div
        {...getRootProps({
          className: `
            border-2 border-dashed rounded-3xl p-12 mb-8 transition-all duration-300 cursor-pointer
            ${isDragAccept
              ? 'border-rekordbox-purple bg-rekordbox-purple/10 scale-105'
              : isDragReject
                ? 'border-red-500 bg-red-500/10 scale-105'
                : isDragActive
                  ? 'border-blue-400 bg-blue-400/10 scale-102'
                  : disabled
                    ? 'border-gray-600 bg-gray-800/20 cursor-not-allowed opacity-50'
                    : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
            }
          `
        })}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          {isDragAccept ? (
            <>
              <Upload className="w-16 h-16 text-rekordbox-purple mb-4 animate-bounce" />
              <h3 className="text-2xl font-semibold text-rekordbox-purple mb-2">Drop your XML file here</h3>
              <p className="text-purple-200">Release to load your Rekordbox library</p>
            </>
          ) : isDragReject ? (
            <>
              <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
              <h3 className="text-2xl font-semibold text-red-500 mb-2">Invalid file type</h3>
              <p className="text-red-200">Please drop a valid Rekordbox XML file</p>
            </>
          ) : isDragActive ? (
            <>
              <Upload className="w-16 h-16 text-blue-400 mb-4 animate-pulse" />
              <h3 className="text-2xl font-semibold text-blue-400 mb-2">Drop file here</h3>
              <p className="text-blue-200">Release to check file</p>
            </>
          ) : (
            <>
              <FileText className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-2xl font-semibold text-white mb-2">Drag & Drop Your Library</h3>
              <p className="text-zinc-400 mb-6 leading-relaxed">
                Drop your Rekordbox XML library file here, or click the button below to browse
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent dropzone click
                    onBrowseClick();
                  }}
                  disabled={disabled}
                  className="bg-rekordbox-purple hover:bg-rekordbox-purple/90 disabled:bg-gray-600
                           disabled:cursor-not-allowed text-white font-semibold
                           py-4 px-8 rounded-xl transition-colors duration-200 flex items-center space-x-3"
                >
                  <FolderOpen className="w-5 h-5" />
                  <span>Browse for XML File</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Messages */}
      {hasRejectedFiles && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">File Rejected</span>
          </div>
          <ul className="mt-2 text-sm text-red-300">
            {rejectionErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

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
  );
};