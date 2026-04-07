import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import type { Phase } from '../types';
import { getPhaseName } from '../types';

interface HeaderPhaseDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    phases: Phase[];
    onJump: (time: number) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    triggerRef: React.RefObject<HTMLElement | null>;
}

export const HeaderPhaseDropdown: React.FC<HeaderPhaseDropdownProps> = ({
    isOpen, onClose, phases, onJump, isCollapsed, onToggleCollapse, triggerRef
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    useEscapeClose(isOpen, onClose);

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

    const handlePhaseClick = (phaseIndex: number) => {
        const startTime = phases[phaseIndex].startTime;
        onJump(startTime);
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
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-3 py-2 bg-glass-header border-b border-glass-border">
                <span className="text-app-lg font-black text-app-text uppercase tracking-wider">
                    {t('timeline.nav_phase_jump')}
                </span>
                <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                    <X size={14} />
                </button>
            </div>

            {/* フェーズリスト */}
            <div className="max-h-[240px] overflow-y-auto">
                {phases.length === 0 ? (
                    <div className="px-3 py-4 text-center text-app-text-muted text-app-lg">
                        {t('timeline.nav_no_phases')}
                    </div>
                ) : (
                    phases.map((phase, index) => (
                        <button
                            key={phase.id}
                            onClick={() => handlePhaseClick(index)}
                            className="w-full px-3 py-2.5 text-left text-app-2xl text-app-text hover:bg-glass-hover border-b border-glass-border last:border-b-0 cursor-pointer transition-colors"
                        >
                            {getPhaseName(phase.name)}
                        </button>
                    ))
                )}
            </div>

            {/* 折りたたみトグル */}
            <div className="border-t border-glass-border">
                <button
                    onClick={() => { onToggleCollapse(); onClose(); }}
                    className="w-full px-3 py-2.5 text-left text-app-lg text-app-text-muted hover:bg-glass-hover cursor-pointer transition-colors flex items-center gap-2"
                >
                    {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                    {isCollapsed ? t('timeline.nav_phase_expand') : t('timeline.nav_phase_collapse')}
                </button>
            </div>
        </div>,
        document.body
    );
};
