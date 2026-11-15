import React from 'react';
import { Progress, ProgressIndicator, ProgressTrack } from '@ui-sdk/react/progress';

const SIZE = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' } as const;

const TONE = {
  light: 'bg-te-grey-200',
  mid: 'bg-te-grey-300',
  dark: 'bg-te-grey-700 border border-te-grey-600',
} as const;

export interface ProgressBarProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  size?: keyof typeof SIZE;
  tone?: keyof typeof TONE;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  label, value, max = 100, unit, size = 'md', tone = 'light', className = '',
}) => {
  const known = max > 0;
  return (
    <Progress
      aria-label={label}
      value={known ? value : 0}
      max={known ? max : 100}
      getValueLabel={unit && known ? (v, d) => `${v ?? 0} of ${d.max} ${unit}` : undefined}
      className={`block w-full min-w-0 ${className}`}
    >
      <ProgressTrack className={`relative w-full rounded-full overflow-hidden ${SIZE[size]} ${TONE[tone]}`}>
        <ProgressIndicator className="h-full bg-te-orange transition-all duration-300" />
      </ProgressTrack>
    </Progress>
  );
};
