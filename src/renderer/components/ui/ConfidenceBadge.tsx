import React from 'react';

export interface ConfidenceBadgeProps {
  confidence: number;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence }) => {
  if (confidence >= 90) {
    return <span className="confidence-high">High</span>;
  } else if (confidence >= 70) {
    return <span className="confidence-medium">Medium</span>;
  } else {
    return <span className="confidence-low">Low</span>;
  }
};