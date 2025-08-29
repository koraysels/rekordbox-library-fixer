import React from 'react';
import { X, Settings } from 'lucide-react';

interface SettingsSlideoutProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

export const SettingsSlideout: React.FC<SettingsSlideoutProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'lg'
}) => {
  const widthClasses = {
    sm: 'w-96',
    md: 'w-[450px]',
    lg: 'w-[550px]',
    xl: 'w-[650px]'
  };

  return (
    <>
      {/* Slide-out Panel */}
      <div
        className={`fixed top-0 right-0 h-full ${widthClasses[width]} bg-te-cream border-l-2 border-te-grey-300 transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-2 border-te-grey-300 bg-te-grey-200">
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <Settings className="text-te-orange" size={24} />
                <h2 className="text-xl font-bold text-te-grey-800 font-te-display tracking-te-display">{title}</h2>
              </div>
              {subtitle && (
                <p className="text-sm text-te-grey-600 ml-9 font-te-mono">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-te-grey-600 hover:text-te-orange transition-colors p-1 hover:bg-te-grey-300 rounded-te"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}
    </>
  );
};
