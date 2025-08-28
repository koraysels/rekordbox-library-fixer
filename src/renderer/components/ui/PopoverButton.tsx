import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0, placement: 'top' as 'top' | 'bottom' | 'left' | 'right' });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors',
    success: 'btn-primary bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500'
  };

  const updatePopoverPosition = useCallback(() => {
    if (!buttonRef.current) {return;}

    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 256; // w-64 = 16rem = 256px
    const popoverHeight = 80; // approximate height
    const gap = 12; // space between button and popover

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let x = rect.left + rect.width / 2;
    let y = rect.top - gap;
    let placement: 'top' | 'bottom' | 'left' | 'right' = 'top';

    // Check if popover fits above (preferred)
    if (rect.top - popoverHeight - gap >= 0) {
      placement = 'top';
      y = rect.top - gap;
    }
    // Try below if not enough space above
    else if (rect.bottom + popoverHeight + gap <= viewport.height) {
      placement = 'bottom';
      y = rect.bottom + gap;
    }
    // Try left if not enough vertical space
    else if (rect.left - popoverWidth - gap >= 0) {
      placement = 'left';
      x = rect.left - gap;
      y = rect.top + rect.height / 2;
    }
    // Try right as last resort
    else {
      placement = 'right';
      x = rect.right + gap;
      y = rect.top + rect.height / 2;
    }

    // Adjust horizontal position to keep popover in viewport
    if (placement === 'top' || placement === 'bottom') {
      const halfWidth = popoverWidth / 2;
      if (x - halfWidth < 0) {
        x = halfWidth + 8; // 8px margin from edge
      } else if (x + halfWidth > viewport.width) {
        x = viewport.width - halfWidth - 8;
      }
    }

    // Adjust vertical position for side placements
    if (placement === 'left' || placement === 'right') {
      const halfHeight = popoverHeight / 2;
      if (y - halfHeight < 0) {
        y = halfHeight + 8;
      } else if (y + halfHeight > viewport.height) {
        y = viewport.height - halfHeight - 8;
      }
    }

    setPopoverPosition({ x, y, placement });
  }, []);

  const getTransform = (placement: string): string => {
    switch (placement) {
      case 'top':
        return 'translate(-50%, -100%)';
      case 'bottom':
        return 'translate(-50%, 0%)';
      case 'left':
        return 'translate(-100%, -50%)';
      case 'right':
        return 'translate(0%, -50%)';
      default:
        return 'translate(-50%, -100%)';
    }
  };

  const getArrowStyle = (placement: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      width: '8px',
      height: '8px',
      backgroundColor: '#111827', // gray-900
      transform: 'rotate(45deg)',
    };

    switch (placement) {
      case 'top':
        return {
          ...baseStyle,
          left: '50%',
          top: '100%',
          transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
          borderRight: '1px solid #374151',
          borderBottom: '1px solid #374151',
          borderLeft: 'none',
          borderTop: 'none',
        };
      case 'bottom':
        return {
          ...baseStyle,
          left: '50%',
          top: '0%',
          transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
          borderLeft: '1px solid #374151',
          borderTop: '1px solid #374151',
          borderRight: 'none',
          borderBottom: 'none',
        };
      case 'left':
        return {
          ...baseStyle,
          left: '100%',
          top: '50%',
          transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
          borderTop: '1px solid #374151',
          borderRight: '1px solid #374151',
          borderLeft: 'none',
          borderBottom: 'none',
        };
      case 'right':
        return {
          ...baseStyle,
          left: '0%',
          top: '50%',
          transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
          borderLeft: '1px solid #374151',
          borderBottom: '1px solid #374151',
          borderRight: 'none',
          borderTop: 'none',
        };
      default:
        return baseStyle;
    }
  };

  const handleMouseEnter = useCallback(() => {
    // Clear any existing hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }

    updatePopoverPosition();
    setShowPopover(true);
  }, [updatePopoverPosition]);

  const handleMouseLeave = useCallback(() => {
    // Delay hiding to prevent flickering when moving mouse quickly
    hideTimeoutRef.current = setTimeout(() => {
      setShowPopover(false);
    }, 100);
  }, []);

  const handlePopoverMouseEnter = useCallback(() => {
    // Keep popover open when mouse enters it
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }, []);

  const handlePopoverMouseLeave = useCallback(() => {
    // Hide popover when mouse leaves it
    setShowPopover(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Hide popover on scroll or resize to prevent misaligned tooltips
  useEffect(() => {
    const handleScrollResize = () => {
      if (showPopover) {
        setShowPopover(false);
      }
    };

    if (showPopover) {
      window.addEventListener('scroll', handleScrollResize, true);
      window.addEventListener('resize', handleScrollResize);

      return () => {
        window.removeEventListener('scroll', handleScrollResize, true);
        window.removeEventListener('resize', handleScrollResize);
      };
    }
  }, [showPopover]);

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
          className="fixed w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl pointer-events-auto"
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          style={{
            left: popoverPosition.x,
            top: popoverPosition.y,
            transform: getTransform(popoverPosition.placement),
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
          {/* Arrow */}
          <div
            className="absolute w-2 h-2 bg-gray-900 border border-gray-700"
            style={getArrowStyle(popoverPosition.placement)}
          ></div>
        </div>,
        document.body
      )}
    </>
  );
};