import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    /** Height of the sheet: 'auto' or a specific height like '60vh' */
    height?: string;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
    isOpen, onClose, title, children, height = '60vh'
}) => {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Mount/unmount animation cycle
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            // Delay to trigger CSS transition
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
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!mounted) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={clsx(
                    "fixed inset-0 bg-black/50 z-[300] transition-opacity duration-300",
                    visible ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />
            {/* Sheet */}
            <div
                ref={sheetRef}
                className={clsx(
                    "fixed bottom-0 left-0 right-0 z-[301]",
                    "bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl",
                    "rounded-t-2xl shadow-2xl border-t border-white/20 dark:border-white/10",
                    "flex flex-col overflow-hidden",
                    "transition-transform duration-300 ease-out",
                    visible ? "translate-y-0" : "translate-y-full"
                )}
                style={{ maxHeight: height }}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-2 pb-1">
                    <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>

                {/* Title bar */}
                {title && (
                    <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-200/50 dark:border-white/5">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            <X size={16} className="text-slate-400" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                    {children}
                </div>
            </div>
        </>
    );
};
