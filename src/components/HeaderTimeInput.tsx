import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface HeaderTimeInputProps {
    isOpen: boolean;
    onClose: () => void;
    onJump: (time: number) => void;
    triggerRef: React.RefObject<HTMLElement | null>;
    maxTime: number;
}

/** "2:30" → 150, "120" → 120, invalid → null */
function parseTimeInput(input: string): number | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (trimmed.includes(':')) {
        const parts = trimmed.split(':');
        if (parts.length !== 2) return null;
        const min = parseInt(parts[0], 10);
        const sec = parseInt(parts[1], 10);
        if (isNaN(min) || isNaN(sec) || min < 0 || sec < 0 || sec >= 60) return null;
        return min * 60 + sec;
    }

    const seconds = parseInt(trimmed, 10);
    if (isNaN(seconds) || seconds < 0) return null;
    return seconds;
}

export const HeaderTimeInput: React.FC<HeaderTimeInputProps> = ({
    isOpen, onClose, onJump, triggerRef, maxTime
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();
    const [value, setValue] = useState('');
    const [error, setError] = useState(false);
    useEscapeClose(isOpen, onClose);

    // オートフォーカス
    useEffect(() => {
        if (isOpen) {
            setValue('');
            setError(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // クリック外閉じ
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                if (triggerRef?.current && triggerRef.current.contains(event.target as Node)) return;
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, triggerRef]);

    // 位置計算
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isPositioned, setIsPositioned] = useState(false);

    useLayoutEffect(() => {
        if (isOpen && triggerRef?.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({ top: rect.bottom + 4, left: rect.left });
            setIsPositioned(true);
        } else if (!isOpen) {
            setIsPositioned(false);
        }
    }, [isOpen, triggerRef]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const time = parseTimeInput(value);
        if (time === null || time > maxTime) {
            setError(true);
            return;
        }
        onJump(time);
        onClose();
    };

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                "fixed w-[200px] glass-tier3 rounded-lg z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-sm transition-opacity",
                !isPositioned ? "opacity-0" : "opacity-100"
            )}
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
            <div className="flex items-center justify-between px-3 py-2 bg-glass-header border-b border-glass-border">
                <span className="text-app-lg font-black text-app-text uppercase tracking-wider">
                    {t('timeline.nav_time_jump')}
                </span>
                <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                    <X size={14} />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="p-3">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(false); }}
                    placeholder={t('timeline.nav_time_placeholder')}
                    className={clsx(
                        "w-full px-3 py-2 rounded-md bg-app-bg border text-app-2xl text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1",
                        error ? "border-red-500 focus:ring-red-500" : "border-app-border focus:ring-app-text"
                    )}
                />
                {error && (
                    <p className="mt-1 text-app-lg text-red-500">{t('timeline.nav_time_invalid')}</p>
                )}
            </form>
        </div>,
        document.body
    );
};
