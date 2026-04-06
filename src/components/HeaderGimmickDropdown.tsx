import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useThemeStore } from '../store/useThemeStore';
import type { TimelineEvent, Phase } from '../types';
import { getPhaseName } from '../types';

export interface GimmickGroup {
    ja: string;
    en: string;
    startTime: number;
}

/** timelineEvents + phases からギミック区間リストを算出 */
export function computeGimmickGroups(events: TimelineEvent[], phases: Phase[]): GimmickGroup[] {
    const sorted = [...events].sort((a, b) => a.time - b.time);
    const groups: GimmickGroup[] = [];
    let currentJa: string | null = null;
    let groupStart = 0;

    const flush = () => {
        if (currentJa) {
            // en は最初に見つけたイベントのものを保持（computeで別途取得）
        }
        currentJa = null;
    };

    sorted.forEach((ev) => {
        const mgJa = ev.mechanicGroup?.ja || '';

        // ラベルなしのイベントはスキップ
        if (!mgJa) return;

        // 異なるラベルが来たらグループを閉じる
        if (mgJa !== currentJa) {
            flush();
            currentJa = mgJa;
            groupStart = ev.time;
            groups.push({ ja: mgJa, en: ev.mechanicGroup?.en || '', startTime: ev.time });
        }
    });

    return groups;
}

interface HeaderGimmickDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    events: TimelineEvent[];
    phases: Phase[];
    onJump: (time: number) => void;
    triggerRef: React.RefObject<HTMLElement | null>;
}

export const HeaderGimmickDropdown: React.FC<HeaderGimmickDropdownProps> = ({
    isOpen, onClose, events, phases, onJump, triggerRef
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    useEscapeClose(isOpen, onClose);

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

    const groups = computeGimmickGroups(events, phases);

    const handleClick = (group: GimmickGroup) => {
        onJump(group.startTime);
        onClose();
    };

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                "fixed w-[220px] glass-tier3 rounded-lg z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-sm transition-opacity",
                !isPositioned ? "opacity-0" : "opacity-100"
            )}
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
            <div className="flex items-center justify-between px-3 py-2 bg-glass-header border-b border-glass-border">
                <span className="text-app-lg font-black text-app-text uppercase tracking-wider">
                    {t('timeline.nav_label_jump')}
                </span>
                <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                    <X size={14} />
                </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto">
                {groups.length === 0 ? (
                    <div className="px-3 py-4 text-center text-app-text-muted text-app-lg">
                        {t('timeline.nav_no_labels')}
                    </div>
                ) : (
                    groups.map((group, index) => {
                        const label = getPhaseName(group, contentLanguage);
                        const subLabel = contentLanguage === 'en' ? group.ja : group.en;
                        return (
                            <button
                                key={`${group.ja}-${index}`}
                                onClick={() => handleClick(group)}
                                className="w-full px-3 py-2 text-left hover:bg-glass-hover border-b border-glass-border last:border-b-0 cursor-pointer transition-colors"
                            >
                                <div className="text-app-xl text-app-text">{label}</div>
                                {subLabel && (
                                    <div className="text-app-sm text-app-text-muted">{subLabel}</div>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>,
        document.body
    );
};
