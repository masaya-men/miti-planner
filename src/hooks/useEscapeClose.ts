import { useEffect, useRef } from 'react';
import { useTutorialStore } from '../store/useTutorialStore';

// グローバルスタック: 複数モーダルが重なった時に最前面だけがEscapeに反応する
const escapeStack: Array<() => void> = [];

export function useEscapeClose(isOpen: boolean, onClose: () => void) {
  const callbackRef = useRef(onClose);
  callbackRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const entry = () => callbackRef.current();
    escapeStack.push(entry);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (useTutorialStore.getState().isActive) return;
      // スタックの最後（最前面）が自分の場合のみ反応
      if (escapeStack[escapeStack.length - 1] === entry) {
        e.stopImmediatePropagation();
        callbackRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const idx = escapeStack.indexOf(entry);
      if (idx >= 0) escapeStack.splice(idx, 1);
    };
  }, [isOpen]);
}
