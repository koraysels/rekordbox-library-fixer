import React, { useEffect } from 'react';
import { X, Github, Coffee } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const version = useAppStore((state) => state.version);
  const loadVersion = useAppStore((state) => state.loadVersion);

  useEffect(() => {
    if (isOpen) {
      loadVersion();
    }
  }, [isOpen, loadVersion]);

  if (!isOpen) {return null;}

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-te-grey-800 border-2 border-te-grey-700 rounded-te p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <img
              src="./icons/48x48.png"
              alt="Rekordbox Library Fixer"
              className="w-8 h-8 bg-white rounded-lg p-1 shadow-sm"
            />
            <h2 className="text-xl font-bold text-te-cream font-te-display">About</h2>
          </div>
          <button
            onClick={onClose}
            className="text-te-grey-400 hover:text-te-cream transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-te-cream mb-2 font-te-display">Rekordbox Library Fixer</h3>
          <p className="text-te-orange font-medium mb-4">Version {version}</p>
          <p className="text-te-grey-300 text-sm leading-relaxed mb-4 font-te-mono">
            A powerful tool for managing and fixing Rekordbox libraries.
            Detect duplicates, optimize your library, and keep your DJ collection organized.
          </p>
        </div>

        {/* Developer info */}
        <div className="border-t-2 border-te-grey-700 pt-4 text-center">
          <p className="text-te-grey-400 text-sm mb-2 font-te-mono">
            Developed by <span className="text-te-cream font-medium">Koray Sels</span>
          </p>
          
          {/* Links */}
          <div className="mb-3 flex flex-col space-y-2">
            <button
              onClick={() => window.electronAPI.openExternal('https://github.com/koraysels/rekordbox-library-fixer')}
              className="inline-flex items-center justify-center space-x-2 px-3 py-1.5 bg-te-grey-700 hover:bg-te-grey-600 text-te-grey-300 hover:text-te-cream rounded-te border border-te-grey-600 transition-colors font-te-mono text-sm"
            >
              <Github className="w-4 h-4" />
              <span>View on GitHub</span>
            </button>
            
            <button
              onClick={() => window.electronAPI.openExternal('https://ko-fi.com/koraysels')}
              className="inline-flex items-center justify-center space-x-2 px-3 py-1.5 bg-te-orange hover:bg-te-orange/90 text-te-cream rounded-te border border-te-orange transition-colors font-te-mono text-sm"
            >
              <Coffee className="w-4 h-4" />
              <span>Buy me a Ko-fi</span>
            </button>
          </div>
          
          <p className="text-te-grey-500 text-xs font-te-mono">
            © 2025 Koray Sels. All rights reserved.
          </p>
        </div>

        {/* Close button */}
        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-te-orange hover:bg-te-orange/90 text-te-cream rounded-te border-2 border-te-orange transition-colors font-te-mono text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
