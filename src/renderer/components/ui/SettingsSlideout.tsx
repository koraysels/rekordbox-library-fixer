import React from 'react';
import { X, Settings } from 'lucide-react';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@ui-sdk/react/dialog';

interface SettingsSlideoutProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

const widthClasses = {
  sm: 'w-96',
  md: 'w-[450px]',
  lg: 'w-[550px]',
  xl: 'w-[650px]'
};

// A Dialog rather than a Drawer: the Drawer's pointer driver lets a mouse drag move the sheet,
// and these panels hold range sliders and text fields that are dragged across.
export const SettingsSlideout: React.FC<SettingsSlideoutProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'lg'
}) => (
  <Dialog open={isOpen} onOpenChange={(open) => { if (!open) {onClose();} }}>
    <DialogBackdrop className="bg-black/50" />
    {/* keepMounted: the settings panels keep state that must survive closing. */}
    <DialogContent
      keepMounted
      className={`inset-y-0 right-0 left-auto m-0 h-full max-h-none max-w-full ${widthClasses[width]} flex flex-col overflow-hidden bg-te-cream border-l-2 border-te-grey-300 transition-transform duration-300 ease-in-out motion-reduce:transition-none data-starting-style:translate-x-full data-ending-style:translate-x-full`}
    >
      <div className="flex items-center justify-between p-6 border-b-2 border-te-grey-300 bg-te-grey-200">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <Settings className="text-te-orange" size={24} aria-hidden="true" />
            <DialogTitle className="text-xl font-bold text-te-grey-800 font-te-display tracking-te-display">{title}</DialogTitle>
          </div>
          {subtitle && (
            <DialogDescription className="text-sm text-te-grey-600 ml-9 font-te-mono">{subtitle}</DialogDescription>
          )}
        </div>
        <DialogClose
          aria-label="Close"
          className="text-te-grey-600 hover:text-te-orange transition-colors p-1 hover:bg-te-grey-300 rounded-te"
        >
          <X size={24} aria-hidden="true" />
        </DialogClose>
      </div>

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </DialogContent>
  </Dialog>
);
