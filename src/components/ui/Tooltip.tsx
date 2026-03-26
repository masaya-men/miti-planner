import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface TooltipProps {
    content: string | React.ReactNode;
    children: React.ReactNode;
    delay?: number;
    className?: string;
    wrapperClassName?: string;
    /** @deprecated カーソル追従型のため無視されます */
    position?: 'top' | 'bottom' | 'left' | 'right';
    /** @deprecated glass-panel統一のため無視されます */
    invert?: boolean;
}

// カーソル右横からの距離
const CURSOR_OFFSET_X = 16;
// 画面端からの最小マージン
const VIEWPORT_PADDING = 8;

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    delay = 100,
    className,
    wrapperClassName,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef<number>(0);

    // ポップアップをカーソル右横に配置（はみ出す場合のみ補正）
    const updatePopupPosition = useCallback(() => {
        const popup = popupRef.current;
        if (!popup) return;

        const { x, y } = cursorRef.current;
        const pw = popup.offsetWidth;
        const ph = popup.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // カーソルの右横（縦はカーソル中心揃え）
        let left = x + CURSOR_OFFSET_X;
        let top = y - ph / 2;

        // 右端はみ出し → 左側に配置
        if (left + pw > vw - VIEWPORT_PADDING) {
            left = x - CURSOR_OFFSET_X - pw;
        }

        // 上下・左のクランプ
        top = Math.max(VIEWPORT_PADDING, Math.min(top, vh - ph - VIEWPORT_PADDING));
        left = Math.max(VIEWPORT_PADDING, left);

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        cursorRef.current = { x: e.clientX, y: e.clientY };
        if (popupRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(updatePopupPosition);
        }
    }, [updatePopupPosition]);

    const handleMouseEnter = useCallback((e: React.MouseEvent) => {
        cursorRef.current = { x: e.clientX, y: e.clientY };
        // 離脱猶予中なら取り消してそのまま表示を維持
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
            return;
        }
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    }, [delay]);

    // アニメーション中の要素で一瞬マウスが外れてもチラつかないよう猶予を設ける
    const LEAVE_GRACE = 80;

    const handleMouseLeave = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        leaveTimeoutRef.current = setTimeout(() => {
            leaveTimeoutRef.current = null;
            cancelAnimationFrame(rafRef.current);
            setIsVisible(false);
        }, LEAVE_GRACE);
    }, []);

    // マウント直後に初回位置を設定
    useEffect(() => {
        if (isVisible) {
            rafRef.current = requestAnimationFrame(updatePopupPosition);
        }
    }, [isVisible, updatePopupPosition]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
            cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <div
            ref={wrapperRef}
            className={clsx("relative flex items-center justify-center w-fit h-fit", wrapperClassName)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            {children}
            {createPortal(
                <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            ref={popupRef}
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                            style={{
                                position: 'fixed',
                                zIndex: 9999,
                                pointerEvents: 'none',
                                left: -9999,
                                top: -9999,
                            }}
                            className={clsx(
                                "glass-tier2 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-tight text-app-text",
                                className
                            )}
                        >
                            {content}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};
