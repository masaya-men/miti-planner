import React, { useRef, useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import type { TimelineEvent, Phase } from '../types';
import { getPhaseName as getPhaseNameStr } from '../types';
import { useThemeStore } from '../store/useThemeStore';

interface MechanicOccurrence {
    time: number;
    phaseName: string;
    formattedTime: string;
}

interface MechanicEntry {
    name: string;
    occurrences: MechanicOccurrence[];
}

interface HeaderMechanicSearchProps {
    isOpen: boolean;
    onClose: () => void;
    events: TimelineEvent[];
    phases: Phase[];
    onJump: (time: number) => void;
    triggerRef: React.RefObject<HTMLElement | null>;
}

function formatTime(seconds: number): string {
    const m = Math.floor(Math.abs(seconds) / 60);
    const s = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function getPhaseName(time: number, phases: Phase[]): string {
    for (let i = 0; i < phases.length; i++) {
        const start = i === 0 ? 0 : phases[i - 1].endTime;
        if (time >= start && time < phases[i].endTime) {
            return getPhaseNameStr(phases[i].name).split('\n')[0];
        }
    }
    return '';
}

export const HeaderMechanicSearch: React.FC<HeaderMechanicSearchProps> = ({
    isOpen, onClose, events, phases, onJump, triggerRef
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [selectedMechanic, setSelectedMechanic] = useState<string | null>(null);
    useEscapeClose(isOpen, onClose);

    const { contentLanguage } = useThemeStore();

    // オートフォーカス
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedMechanic(null);
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
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                const width = Math.min(window.innerWidth - 16, 320);
                setPosition({
                    top: rect.bottom + 4,
                    left: Math.max(8, (window.innerWidth - width) / 2),
                });
            } else {
                setPosition({ top: rect.bottom + 4, left: rect.left });
            }
            setIsPositioned(true);
        } else if (!isOpen) {
            setIsPositioned(false);
        }
    }, [isOpen, triggerRef]);

    // ユニーク攻撃名リスト構築（AA除外）
    const mechanics: MechanicEntry[] = useMemo(() => {
        const map = new Map<string, MechanicOccurrence[]>();
        const getEventName = (ev: TimelineEvent) =>
            ev.name ? getPhaseNameStr(ev.name, contentLanguage) : ev.name;

        events
            .filter(ev => {
                const name = getEventName(ev);
                return name && name !== 'AA';
            })
            .sort((a, b) => a.time - b.time)
            .forEach(ev => {
                const name = getEventName(ev)!;
                if (!map.has(name)) map.set(name, []);
                map.get(name)!.push({
                    time: ev.time,
                    phaseName: getPhaseName(ev.time, phases),
                    formattedTime: formatTime(ev.time),
                });
            });

        return Array.from(map.entries()).map(([name, occurrences]) => ({ name, occurrences }));
    }, [events, phases, contentLanguage]);

    // 検索フィルタ
    const filtered = useMemo(() => {
        if (!query.trim()) return mechanics;
        const q = query.toLowerCase();
        return mechanics.filter(m => m.name.toLowerCase().includes(q));
    }, [mechanics, query]);

    if (!isOpen) return null;

    const handleMechanicClick = (entry: MechanicEntry) => {
        if (entry.occurrences.length === 1) {
            onJump(entry.occurrences[0].time);
            onClose();
        } else {
            setSelectedMechanic(selectedMechanic === entry.name ? null : entry.name);
        }
    };

    const handleOccurrenceClick = (time: number) => {
        onJump(time);
        onClose();
    };

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                "fixed glass-tier3 rounded-lg z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-sm transition-opacity",
                !isPositioned ? "opacity-0" : "opacity-100"
            )}
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: typeof window !== 'undefined' && window.innerWidth < 768
                    ? `${Math.min(window.innerWidth - 16, 320)}px`
                    : selectedMechanic ? '420px' : '240px',
            }}
        >
            <div className={clsx("flex", typeof window !== 'undefined' && window.innerWidth < 768 ? "flex-col" : "flex-row")}>
                {/* 1段目: 攻撃名リスト */}
                <div className={clsx("flex-shrink-0", typeof window !== 'undefined' && window.innerWidth < 768 ? "w-full" : "w-[240px]")}>
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between px-3 py-2 bg-glass-header border-b border-glass-border">
                        <span className="text-app-lg font-black text-app-text uppercase tracking-wider">
                            {t('timeline.nav_mechanic_jump')}
                        </span>
                        <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                            <X size={14} />
                        </button>
                    </div>

                    {/* 検索ボックス */}
                    <div className="p-2 border-b border-glass-border">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-app-bg border border-app-border">
                            <Search size={14} className="text-app-text-muted flex-shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setSelectedMechanic(null); }}
                                placeholder={t('timeline.nav_mechanic_search')}
                                className="w-full bg-transparent text-app-2xl text-app-text placeholder:text-app-text-muted focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* リスト */}
                    <div className="max-h-[300px] overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-app-text-muted text-app-lg">
                                {t('timeline.nav_no_results')}
                            </div>
                        ) : (
                            filtered.map(entry => (
                                <button
                                    key={entry.name}
                                    onClick={() => handleMechanicClick(entry)}
                                    className={clsx(
                                        "w-full px-3 py-2.5 text-left text-app-2xl border-b border-glass-border last:border-b-0 cursor-pointer transition-colors flex items-center justify-between",
                                        selectedMechanic === entry.name
                                            ? "bg-glass-active text-app-text"
                                            : "text-app-text hover:bg-glass-hover"
                                    )}
                                >
                                    <span className="truncate">{entry.name}</span>
                                    <span className="text-app-lg text-app-text-muted flex-shrink-0 ml-2">
                                        {entry.occurrences.length > 1 && (
                                            <>{t('timeline.nav_mechanic_count', { count: entry.occurrences.length })} &#9658;</>
                                        )}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* 2段目: 出現箇所サブリスト */}
                {selectedMechanic && (
                    <div className={clsx("flex-shrink-0", typeof window !== 'undefined' && window.innerWidth < 768 ? "w-full border-t border-glass-border" : "w-[180px] border-l border-glass-border")}>
                        <div className="px-3 py-2 bg-glass-header border-b border-glass-border">
                            <span className="text-app-lg font-bold text-app-text truncate block">
                                {selectedMechanic}
                            </span>
                        </div>
                        <div className="max-h-[340px] overflow-y-auto">
                            {mechanics.find(m => m.name === selectedMechanic)?.occurrences.map((occ, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleOccurrenceClick(occ.time)}
                                    className="w-full px-3 py-2.5 text-left text-app-2xl text-app-text hover:bg-glass-hover border-b border-glass-border last:border-b-0 cursor-pointer transition-colors flex items-center justify-between"
                                >
                                    <span className="text-app-text-muted text-app-lg truncate">{occ.phaseName}</span>
                                    <span className="font-mono text-app-lg">{occ.formattedTime}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
