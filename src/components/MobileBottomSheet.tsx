import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import { SPRING } from '../tokens/motionTokens';

interface MobileBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    /** Max height. Default '65vh' */
    height?: string;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
    isOpen, onClose, title, children, height = '65vh'
}) => {
    const sheetRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startY: number; isDragging: boolean }>({
        startY: 0, isDragging: false
    });

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

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="md:hidden fixed inset-0 z-[300]"
                        style={{ backgroundColor: 'var(--color-overlay)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />
                    {/* Sheet */}
                    <motion.div
                        ref={sheetRef}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className="md:hidden fixed left-0 right-0 z-[301] flex flex-col overflow-hidden shadow-lg"
                        style={{
                            maxHeight: height,
                            bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
                            backgroundColor: 'var(--color-sheet-bg)',
                            borderTopLeftRadius: MOBILE_TOKENS.sheet.radius,
                            borderTopRightRadius: MOBILE_TOKENS.sheet.radius,
                        }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0, transition: { type: "spring", stiffness: 380, damping: 22 } }}
                        exit={{ y: '100%', transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing">
                            <div
                                className="bg-[var(--app-text)]/20"
                                style={{
                                    width: MOBILE_TOKENS.sheet.handleWidth,
                                    height: MOBILE_TOKENS.sheet.handleHeight,
                                    borderRadius: MOBILE_TOKENS.sheet.handleRadius,
                                }}
                            />
                        </div>

                        {/* Title bar */}
                        {title && (
                            <div className="flex items-center justify-between px-4 pb-2 border-b border-app-border">
                                <h3 className="text-app-2xl font-black text-app-text tracking-wide">{title}</h3>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-app-surface2 transition-colors cursor-pointer"
                                >
                                    <X size={16} className="text-app-text-sec" />
                                </button>
                            </div>
                        )}

                        {/* Content — scrollable */}
                        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-20">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
