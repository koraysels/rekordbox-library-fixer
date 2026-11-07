import React from 'react';
import { describeMatch } from '../../utils/describeMatch';

export interface ConfidenceBadgeProps {
  confidence: number;
  /** 'fingerprint' when the audio itself matched; anything else is a details match. */
  matchType?: string;
  filesMissing?: boolean;
}

/** How sure a duplicate match is, said in words, with the reason on hover. */
export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence, matchType = 'metadata', filesMissing = false }) => {
  const { label, tone, explanation } = describeMatch(confidence, matchType, filesMissing);
  return (
    <span className={`confidence-${tone} cursor-help`} title={explanation}>
      {label}
    </span>
  );
};
