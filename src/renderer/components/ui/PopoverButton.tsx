import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

export interface PopoverButtonProps {
  onClick: (e?: React.MouseEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  className?: string;
  children: React.ReactNode;
}

export const PopoverButton: React.FC<PopoverButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  icon: Icon,
  title,
  description,
  variant = 'secondary',
  className = '',
  children
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary', 
    danger: 'bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors',
    success: 'btn-primary bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500'
  };

  const updatePopoverPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopoverPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    }
  };

  const handleMouseEnter = () => {
    updatePopoverPosition();
    setShowPopover(true);
  };

  const handleMouseLeave = () => {
    setShowPopover(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onClick}
        disabled={disabled || loading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`${variantClasses[variant]} ${className} flex items-center space-x-2`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin spinner-loading" />
        ) : (
          <Icon size={16} />
        )}
        <span>{children}</span>
      </button>

      {showPopover && createPortal(
        <div 
          className="fixed w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl pointer-events-none"
          style={{
            left: popoverPosition.x,
            top: popoverPosition.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 10000
          }}
        >
          <div className="flex items-start space-x-2">
            <Icon size={16} className="text-rekordbox-purple mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-white text-sm">{title}</h3>
              <p className="text-gray-300 text-xs mt-1">{description}</p>
            </div>
          </div>
          <div 
            className="absolute w-2 h-2 bg-gray-900 border-r border-b border-gray-700 transform rotate-45"
            style={{
              left: '50%',
              top: '100%',
              transform: 'translateX(-50%) translateY(-50%) rotate(45deg)'
            }}
          ></div>
        </div>,
        document.body
      )}
    </>
  );
};