import { useCallback } from 'react';
import { useDropzone, Accept, FileWithPath } from 'react-dropzone';

interface UseFileDropzoneOptions {
  onDrop: (filePath: string) => void;
  accept?: Accept;
  maxFiles?: number;
  disabled?: boolean;
}


// Custom file getter to access native file paths in Electron
const getFilesFromEvent = async (event: any): Promise<FileWithPath[]> => {
  const files: FileWithPath[] = [];

  if (event.dataTransfer) {
    const fileList = Array.from(event.dataTransfer.files || []) as File[];
    console.log('DataTransfer files found:', fileList.length);

    fileList.forEach((file) => {

      // In Electron, the file should have a 'path' property
      const fullPath = (file as any).path || file.name;

      // Create file with path property
      const fileWithPath = Object.assign(file, { path: fullPath }) as FileWithPath;
      files.push(fileWithPath);
    });
  } else if (event.target && event.target.files) {
    // Handle regular file input (click to select)
    const fileList = Array.from(event.target.files) as File[];
    console.log('Input files found:', fileList.length);

    fileList.forEach((file) => {

      const filePath = (file as any).path || file.name;
      const fileWithPath = Object.assign(file, { path: filePath }) as FileWithPath;
      files.push(fileWithPath);
    });
  }

  console.log('Processed files count:', files.length);
  return files;
};

export const useFileDropzone = ({
  onDrop,
  accept = {
    'application/xml': ['.xml'],
    'text/xml': ['.xml']
  },
  maxFiles = 1,
  disabled = false
}: UseFileDropzoneOptions) => {

  const handleDrop = useCallback(async (acceptedFiles: FileWithPath[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];

      try {
        // In Electron, use the native file path directly (most efficient)
        if (file.path && file.path !== file.name) {
          onDrop(file.path);
          return;
        }

        // Fallback: read file content and send to main process to write a temp file
        const content = await file.text();

        const result = await window.electronAPI.saveDroppedFile({
          content,
          fileName: file.name
        });

        if (result.success && result.data?.filePath) {
          onDrop(result.data.filePath);
        } else {
          console.error('Failed to save dropped file:', result.error);
        }
      } catch (error) {
        console.error('Failed to process dropped file:', error);
      }
    }
  }, [onDrop]);

  const validateFile = useCallback((file: File) => {
    const fileName = file.name.toLowerCase();

    // Validate that it's an XML file with Rekordbox-related content
    if (!fileName.endsWith('.xml')) {
      return {
        code: 'file-invalid-type',
        message: 'Only XML files are accepted'
      };
    }

    const patterns = ['rekordbox', 'library', 'collection'];
    const matchesPattern = patterns.some(pattern => fileName.includes(pattern));
    if (!matchesPattern) {
      return {
        code: 'file-not-rekordbox',
        message: 'Please drop a Rekordbox XML library file (e.g., rekordbox.xml, Collection.xml)'
      };
    }

    return null;
  }, []);

  const dropzoneProps = useDropzone({
    onDrop: handleDrop,
    accept,
    maxFiles,
    disabled,
    validator: validateFile,
    getFilesFromEvent,
    noClick: false, // Allow clicking to open file dialog
    noKeyboard: false, // Allow keyboard navigation
    multiple: false // Only single file allowed
  });

  return {
    ...dropzoneProps,
    // Expose some additional useful states
    hasFiles: dropzoneProps.acceptedFiles.length > 0,
    hasRejectedFiles: dropzoneProps.fileRejections.length > 0,
    rejectionErrors: dropzoneProps.fileRejections.flatMap(rejection =>
      rejection.errors.map(error => error.message)
    )
  };
};