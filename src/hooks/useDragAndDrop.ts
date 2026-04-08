// src/hooks/useDragAndDrop.ts
import { useRef, useState, useCallback, useEffect } from 'react';
import { INTERACTION } from '../tokens/interactionTokens';
import { useHaptic } from './useHaptic';

interface Position { x: number; y: number }

interface UseDragAndDropOptions<T> {
  holdDelay?: number;
  onDrop: (item: T, targetId: string) => void;
}

interface DragState<T> {
  isDragging: boolean;
  item: T | null;
  position: Position;
  activeTargetId: string | null;
}

export function useDragAndDrop<T>({ holdDelay, onDrop }: UseDragAndDropOptions<T>) {
  const { vibrate } = useHaptic();
  const delay = holdDelay ?? INTERACTION.drag.holdDelay;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<Position>({ x: 0, y: 0 });
  const [state, setState] = useState<DragState<T>>({
    isDragging: false,
    item: null,
    position: { x: 0, y: 0 },
    activeTargetId: null,
  });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const startDrag = useCallback((item: T, e: React.TouchEvent | React.MouseEvent) => {
    const pos = 'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };
    startPos.current = pos;

    timerRef.current = setTimeout(() => {
      vibrate('medium');
      setState({ isDragging: true, item, position: pos, activeTargetId: null });
    }, delay);
  }, [delay, vibrate]);

  const moveDrag = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const pos = 'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

    // Cancel hold if moved too far before drag started
    if (!state.isDragging && timerRef.current) {
      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;
      if (Math.abs(dx) > INTERACTION.drag.moveThreshold || Math.abs(dy) > INTERACTION.drag.moveThreshold) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        return;
      }
    }

    if (state.isDragging) {
      setState(prev => ({ ...prev, position: pos }));
    }
  }, [state.isDragging]);

  const endDrag = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (state.isDragging && state.item && state.activeTargetId) {
      vibrate('success');
      onDrop(state.item, state.activeTargetId);
    }
    setState({ isDragging: false, item: null, position: { x: 0, y: 0 }, activeTargetId: null });
  }, [state.isDragging, state.item, state.activeTargetId, onDrop, vibrate]);

  const setActiveTarget = useCallback((targetId: string | null) => {
    setState(prev => ({ ...prev, activeTargetId: targetId }));
  }, []);

  return {
    ...state,
    startDrag,
    moveDrag,
    endDrag,
    setActiveTarget,
  };
}
