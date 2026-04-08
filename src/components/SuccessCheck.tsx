// src/components/SuccessCheck.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING } from '../tokens/motionTokens';
import { useHaptic } from '../hooks/useHaptic';
import { useEffect } from 'react';

interface SuccessCheckProps {
  visible: boolean;
  onComplete?: () => void;
  size?: number;
  duration?: number;
}

export function SuccessCheck({ visible, onComplete, size = 48, duration = 1500 }: SuccessCheckProps) {
  const { vibrate } = useHaptic();

  useEffect(() => {
    if (visible) {
      vibrate('success');
      if (onComplete) {
        const timer = setTimeout(onComplete, duration);
        return () => clearTimeout(timer);
      }
    }
  }, [visible, onComplete, duration, vibrate]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={SPRING.default}
          className="flex items-center justify-center rounded-full bg-green-500"
          style={{ width: size, height: size }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            style={{ width: size * 0.5, height: size * 0.5 }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
