import React from 'react';

export interface ConfidenceBadgeProps {
  confidence: number;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence }) => {
  if (confidence >= 90) {
    return <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">High</span>;
  } else if (confidence >= 70) {
    return <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded-full">Medium</span>;
  } else {
    return <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full">Low</span>;
  }
};