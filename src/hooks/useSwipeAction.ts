// src/hooks/useSwipeAction.ts
import { useRef, useState, useCallback } from 'react';
import { INTERACTION } from '../tokens/interactionTokens';

interface UseSwipeActionOptions {
  threshold?: number;
  onSwipe: () => void;
}

export function useSwipeAction({ threshold, onSwipe }: UseSwipeActionOptions) {
  const startX = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const effectiveThreshold = threshold ?? INTERACTION.swipe.deleteThreshold;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setSwiped(false);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 0) {
      setOffsetX(Math.min(diff, effectiveThreshold + 20));
    }
  }, [effectiveThreshold]);

  const onTouchEnd = useCallback(() => {
    if (offsetX >= effectiveThreshold) {
      setOffsetX(effectiveThreshold);
      setSwiped(true);
    } else {
      setOffsetX(0);
    }
  }, [offsetX, effectiveThreshold]);

  const reset = useCallback(() => {
    setOffsetX(0);
    setSwiped(false);
  }, []);

  const confirm = useCallback(() => {
    onSwipe();
    reset();
  }, [onSwipe, reset]);

  return {
    offsetX,
    swiped,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    reset,
    confirm,
  };
}
