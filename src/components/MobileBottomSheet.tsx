import React, { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    /** Max height. Default '70vh' */
    height?: string;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
    isOpen, onClose, title, children, height = '65vh'
}) => {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const sheetRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startY: number; currentY: number; isDragging: boolean }>({
        startY: 0, currentY: 0, isDragging: false
    });

    // Mount/unmount animation cycle
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setVisible(true));
            });
        } else {
            setVisible(false);
            const timer = setTimeout(() => setMounted(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Swipe-to-dismiss handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        dragRef.current.startY = e.touches[0].clientY;
        dragRef.current.isDragging = true;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!dragRef.current.isDragging || !sheetRef.current) return;
        const deltaY = e.touches[0].clientY - dragRef.current.startY;
        // Only allow dragging down (positive delta)
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
            // Dismiss
            onClose();
        } else {
            // Snap back
            sheetRef.current.style.transform = 'translateY(0)';
            sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)';
        }
    }, [onClose]);

    if (!mounted) return null;

    return (
        <>
            {/* Backdrop — モバイルのみ */}
            <div
                className={clsx(
                    "md:hidden fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[300] transition-opacity duration-300",
                    visible ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />
            {/* Sheet — モバイルのみ */}
            <div
                ref={sheetRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={clsx(
                    "md:hidden fixed left-0 right-0 z-[301]",
                    "glass-tier3",
                    "rounded-t-2xl shadow-sm",
                    "flex flex-col overflow-hidden",
                    "transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                    visible ? "translate-y-0" : "translate-y-full"
                )}
                style={{ maxHeight: height, bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
            >
                {/* Drag handle — visual cue for swipe */}
                <div className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing">
                    <div className="w-10 h-1 rounded-full bg-app-border" />
                </div>

                {/* Title bar */}
                {title && (
                    <div className="flex items-center justify-between px-4 pb-2 border-b border-app-border">
                        <h3 className="text-sm font-black text-app-text tracking-wide">{title}</h3>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-app-surface2 transition-colors cursor-pointer"
                        >
                            <X size={16} className="text-app-text-secondary" />
                        </button>
                    </div>
                )}

                {/* Content — scrollable */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-20">
                    {children}
                </div>
            </div>
        </>
    );
};
