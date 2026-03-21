import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface TooltipProps {
    content: string | React.ReactNode;
    children: React.ReactNode;
    delay?: number;
    className?: string; // Appears on the popover
    wrapperClassName?: string; // Appears on the wrapper div
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    delay = 100, // 👈 ユーザーの要望に合わせて 100ms
    className,
    wrapperClassName,
    position = 'top'
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    return (
        <div
            className={clsx("relative flex items-center justify-center w-fit h-fit", wrapperClassName)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : position === 'bottom' ? -4 : 0 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 2 : position === 'bottom' ? -2 : 0 }}
                        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                        className={clsx(
                            "absolute z-[9999] pointer-events-none whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-black tracking-tight",
                            "bg-slate-900/80 dark:bg-slate-200/90 text-slate-50 dark:text-slate-900",
                            "backdrop-blur-md border border-white/10 dark:border-black/5 shadow-xl",
                            positionClasses[position],
                            className
                        )}
                    >
                        {content}
                        {/* 小さな矢印 (Optional) */}
                        <div className={clsx(
                            "absolute w-2 h-2 rotate-45 border-white/10 dark:border-black/5",
                            "bg-slate-900/80 dark:bg-slate-200/90",
                            position === 'top' ? "-bottom-1 left-1/2 -translate-x-1/2 border-r border-b" :
                                position === 'bottom' ? "-top-1 left-1/2 -translate-x-1/2 border-l border-t" :
                                    position === 'left' ? "-right-1 top-1/2 -translate-y-1/2 border-r border-t" :
                                        "-left-1 top-1/2 -translate-y-1/2 border-l border-b"
                        )} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
