import React from 'react';
import { X } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-rekordbox-gray border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <img 
              src="/icons/48x48.png" 
              alt="Rekordbox Library Manager" 
              className="w-8 h-8 bg-white rounded-lg p-1 shadow-sm"
            />
            <h2 className="text-xl font-bold text-white">About</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">Rekordbox Library Manager</h3>
          <p className="text-rekordbox-purple font-medium mb-4">Version 0.0.1</p>
          <p className="text-zinc-300 text-sm leading-relaxed mb-4">
            A powerful tool for managing and fixing Rekordbox libraries. 
            Detect duplicates, optimize your library, and keep your DJ collection organized.
          </p>
        </div>

        {/* Developer info */}
        <div className="border-t border-zinc-700 pt-4 text-center">
          <p className="text-zinc-400 text-sm mb-1">
            Developed by <span className="text-white font-medium">Koray Sels</span>
          </p>
          <p className="text-zinc-500 text-xs">
            © 2024 Koray Sels. All rights reserved.
          </p>
        </div>

        {/* Close button */}
        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="btn-primary px-6 py-2 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};