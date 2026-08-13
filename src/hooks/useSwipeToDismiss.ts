// src/hooks/useSwipeToDismiss.ts
import { useRef, useCallback } from 'react';

/**
 * モバイルボトムシートの「下スワイプで閉じる」ジェスチャの共通実装。
 * MobileBottomSheet / MobileContextMenu で共有 (元は MobileBottomSheet 内に個別実装だった)。
 */
export function useSwipeToDismiss<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
    const sheetRef = useRef<T>(null);
    const dragRef = useRef<{ startY: number; isDragging: boolean }>({
        startY: 0, isDragging: false
    });

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        dragRef.current.startY = e.touches[0].clientY;
        dragRef.current.isDragging = true;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!dragRef.current.isDragging || !sheetRef.current) return;
        const deltaY = e.touches[0].clientY - dragRef.current.startY;
        if (deltaY > 0) {
            sheetRef.current.style.transform = `translateY(${deltaY}px)`;
            sheetRef.current.style.transition = 'none';
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!dragRef.current.isDragging || !sheetRef.current) return;
        dragRef.current.isDragging = false;
        const deltaY = parseInt(sheetRef.current.style.transform.replace(/[^-?\d]/g, '') || '0');
        if (deltaY > 100) {
            onClose();
        } else {
            sheetRef.current.style.transform = 'translateY(0)';
            sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
        }
    }, [onClose]);

    return { sheetRef, handleTouchStart, handleTouchMove, handleTouchEnd };
}
