import React from 'react';
import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from '@ui-sdk/react/tooltip';

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

const variantClasses = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'bg-te-red-500 hover:bg-te-red-600 aria-disabled:bg-te-grey-400 text-te-cream py-te-md px-te-lg rounded-te border-2 border-te-red-500 font-te-display text-xs font-medium uppercase tracking-te-display transition-all duration-200',
  success: 'bg-te-green-500 hover:bg-te-green-600 aria-disabled:bg-te-grey-400 text-te-cream py-te-md px-te-lg rounded-te border-2 border-te-green-500 font-te-display text-xs font-medium uppercase tracking-te-display transition-all duration-200'
};

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
  // aria-disabled rather than disabled, so the button stays focusable and its tip can still say what it does.
  const unavailable = disabled || loading;

  return (
    <Tooltip delay={0} closeDelay={100}>
      <TooltipTrigger
        type="button"
        aria-disabled={unavailable || undefined}
        onClick={(e) => {
          if (!unavailable) {
            onClick(e);
          }
        }}
        className={`${variantClasses[variant]} ${className} flex items-center space-x-2 aria-disabled:cursor-not-allowed`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin spinner-loading" aria-hidden="true" />
        ) : (
          <Icon size={16} aria-hidden="true" />
        )}
        <span>{children}</span>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={12}
        collisionPadding={8}
        className="w-64 p-te-md bg-te-cream border-2 border-te-grey-300 rounded-te-lg shadow-xl"
      >
        <div className="flex items-start gap-te-sm">
          <Icon size={16} className="text-te-orange mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-te-display font-medium text-te-grey-800 text-sm">{title}</p>
            <p className="font-te-mono text-te-grey-600 text-xs mt-1">{description}</p>
          </div>
        </div>
        <TooltipArrow className="te-popup-arrow" />
      </TooltipContent>
    </Tooltip>
  );
};
