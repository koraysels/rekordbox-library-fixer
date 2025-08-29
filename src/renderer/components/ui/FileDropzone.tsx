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
        <h2 className="text-3xl font-bold text-te-cream mb-2 font-te-display">Welcome to Rekordbox Library Manager</h2>
        <p className="te-value text-lg font-te-mono">
          Manage, clean, and optimize your Rekordbox music library
        </p>
      </div>

      {/* Drag and Drop Area */}
      <div
        {...getRootProps({
          className: `
            border-2 border-dashed rounded-3xl p-12 mb-8 transition-all duration-300 cursor-pointer
            ${isDragAccept
              ? 'border-te-orange bg-te-orange/10 scale-105'
              : isDragReject
                ? 'border-te-red bg-te-red/10 scale-105'
                : isDragActive
                  ? 'border-te-orange bg-te-orange/10 scale-102'
                  : disabled
                    ? 'border-te-grey-600 bg-te-grey-800/20 cursor-not-allowed opacity-50'
                    : 'border-te-grey-600 hover:border-te-grey-500 hover:bg-te-grey-800/50'
            }
          `
        })}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          {isDragAccept ? (
            <>
              <Upload className="w-16 h-16 text-te-orange mb-4 animate-bounce" />
              <h3 className="text-2xl font-semibold text-te-orange mb-2 font-te-display">Drop your XML file here</h3>
              <p className="text-te-cream font-te-mono">Release to load your Rekordbox library</p>
            </>
          ) : isDragReject ? (
            <>
              <AlertCircle className="w-16 h-16 text-te-red mb-4" />
              <h3 className="text-2xl font-semibold text-te-red mb-2 font-te-display">Invalid file type</h3>
              <p className="text-te-red font-te-mono">Please drop a valid Rekordbox XML file</p>
            </>
          ) : isDragActive ? (
            <>
              <Upload className="w-16 h-16 text-te-orange mb-4 animate-pulse" />
              <h3 className="text-2xl font-semibold text-te-orange mb-2 font-te-display">Drop file here</h3>
              <p className="text-te-cream font-te-mono">Release to check file</p>
            </>
          ) : (
            <>
              <FileText className="w-16 h-16 text-te-orange mb-4" />
              <h3 className="text-2xl font-semibold text-te-cream mb-2 font-te-display">Drag & Drop Your Library</h3>
              <p className="te-value mb-6 leading-relaxed font-te-mono">
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
                  className="btn-primary py-4 px-8 flex items-center space-x-3"
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
        <div className="mb-4 p-4 bg-te-red/20 border-2 border-te-red/30 rounded-te">
          <div className="flex items-center space-x-2 text-te-red">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium font-te-display">File Rejected</span>
          </div>
          <ul className="mt-2 text-sm text-te-red font-te-mono">
            {rejectionErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* File Type Info */}
      <div className="text-center">
        <p className="text-xs te-label mb-2 font-te-mono">Supported file types</p>
        <div className="flex items-center justify-center space-x-6 te-value">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-te-mono">Rekordbox XML</span>
          </div>
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-te-mono">Collection.xml</span>
          </div>
        </div>
      </div>
    </div>
  );
};