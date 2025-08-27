import { useEffect } from 'react';

interface NativeDropHandlerProps {
  onFileDrop: (filePath: string) => void;
  acceptedExtensions?: string[];
}

export const NativeDropHandler: React.FC<NativeDropHandlerProps> = ({
  onFileDrop,
  acceptedExtensions = ['.xml']
}) => {
  useEffect(() => {
    if (!window.electronAPI?.onNativeFileDrop) {
      console.warn('Native file drop API not available');
      return;
    }

    const handleNativeFileDrop = (filePaths: string[]) => {
      console.log('🎯 Native file drop received:', filePaths);
      
      // Filter for accepted file types
      const validFiles = filePaths.filter(filePath => {
        const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
        return acceptedExtensions.includes(extension);
      });

      if (validFiles.length > 0) {
        console.log('✅ Using native file path:', validFiles[0]);
        onFileDrop(validFiles[0]);
      } else {
        console.warn('❌ No valid files found in native drop');
      }
    };

    const cleanup = window.electronAPI.onNativeFileDrop(handleNativeFileDrop);
    console.log('✅ Native drop handler registered');
    
    return cleanup;
  }, [onFileDrop, acceptedExtensions]);

  // This component doesn't render anything - it's just for handling events
  return null;
};