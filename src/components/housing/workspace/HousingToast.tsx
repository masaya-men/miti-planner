/**
 * Housing-workspace scoped toast (info / error).
 *
 * NOTE: A global `showToast()` already exists in `src/components/Toast.tsx`.
 * We ship this scoped duplicate for now so the housing workspace can layer
 * within its own z-index stack and own its visual language. Future iterate
 * should consider consolidating these two systems.
 */
import { useEffect } from 'react';

export interface HousingToastProps {
  message: string;
  variant?: 'info' | 'error';
  duration?: number;
  onClose: () => void;
}

export const HousingToast: React.FC<HousingToastProps> = ({
  message,
  variant = 'info',
  duration = 2500,
  onClose,
}) => {
  useEffect(() => {
    const t = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(t);
  }, [duration, onClose]);

  return (
    <div role="status" data-variant={variant} className="housing-toast">
      {message}
    </div>
  );
};
