import React from 'react';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

export interface SkeletonCardProps {
  variant?: 'pinterest' | 'right-panel';
}

/**
 * Generic loading placeholder for the housing workspace.
 * Two layouts: `pinterest` (grid card) and `right-panel` (horizontal mini row).
 * Shimmer pauses automatically under prefers-reduced-motion.
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({ variant = 'pinterest' }) => {
  const reduced = useReducedMotion();
  const shimmer = reduced ? 'false' : 'true';

  if (variant === 'right-panel') {
    return (
      <div className="housing-skeleton-row-item" data-shimmer={shimmer} aria-hidden="true">
        <div className="housing-skeleton-row-item-thumb" />
        <div className="housing-skeleton-row-item-body">
          <div className="housing-skeleton-row" />
          <div className="housing-skeleton-row-sub" />
        </div>
      </div>
    );
  }

  return (
    <div className="housing-skeleton-card" data-shimmer={shimmer} aria-hidden="true">
      <div className="housing-skeleton-card-thumb" />
      <div className="housing-skeleton-card-body">
        <div className="housing-skeleton-row" />
        <div className="housing-skeleton-row-sub" />
      </div>
    </div>
  );
};
