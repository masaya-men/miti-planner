/**
 * Housing-workspace scoped toast (info / error).
 *
 * NOTE: A global `showToast()` already exists in `src/components/Toast.tsx`.
 * We ship this scoped duplicate for now so the housing workspace can layer
 * within its own z-index stack and own its visual language. Future iterate
 * should consider consolidating these two systems.
 */
import { useEffect, useRef } from 'react';

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
  // Keep onClose in a ref so the auto-dismiss timer is not reset when the
  // parent passes a fresh inline callback on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const t = window.setTimeout(() => onCloseRef.current(), duration);
    return () => window.clearTimeout(t);
  }, [duration]);

  return (
    <div role="status" data-variant={variant} className="housing-toast">
      {message}
    </div>
  );
};
