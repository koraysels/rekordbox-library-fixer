import { useCallback } from 'react';
import { useDropzone, Accept, FileWithPath } from 'react-dropzone';

interface UseFileDropzoneOptions {
  onDrop: (filePath: string) => void;
  accept?: Accept;
  maxFiles?: number;
  disabled?: boolean;
}

interface ElectronFile extends File {
  path?: string;
}

// Custom file getter to access native file paths in Electron
const getFilesFromEvent = async (event: any): Promise<FileWithPath[]> => {
  const files: FileWithPath[] = [];
  
  console.log('getFilesFromEvent called with event:', event.type);
  
  if (event.dataTransfer) {
    const fileList = Array.from(event.dataTransfer.files || []) as File[];
    console.log('DataTransfer files found:', fileList.length);
    
    fileList.forEach((file, index) => {
      console.log(`File ${index}:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        path: (file as any).path,
        allKeys: Object.getOwnPropertyNames(file),
        allDescriptors: Object.getOwnPropertyDescriptors(file)
      });
      
      // In Electron, the file should have a 'path' property
      let fullPath = (file as any).path || file.name;
      
      // Create file with path property
      const fileWithPath = Object.assign(file, { path: fullPath }) as FileWithPath;
      files.push(fileWithPath);
    });
  } else if (event.target && event.target.files) {
    // Handle regular file input (click to select)
    const fileList = Array.from(event.target.files) as File[];
    console.log('Input files found:', fileList.length);
    
    fileList.forEach((file, index) => {
      console.log(`Input file ${index}:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        path: (file as any).path,
        allKeys: Object.getOwnPropertyNames(file)
      });
      
      const filePath = (file as any).path || file.name;
      const fileWithPath = Object.assign(file, { path: filePath }) as FileWithPath;
      files.push(fileWithPath);
    });
  }
  
  console.log('Returning files:', files.map(f => ({ name: f.name, path: f.path })));
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
        // Read the file content as text
        const content = await file.text();
        
        // Save to a temporary file in the app data directory via Electron
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
        console.error('Failed to read file content:', error);
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
    
    // Check for common Rekordbox file patterns
    if (!fileName.includes('rekordbox') && 
        !fileName.includes('library') && 
        !fileName.includes('collection')) {
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