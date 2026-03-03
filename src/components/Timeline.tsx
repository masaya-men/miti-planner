import React, { useMemo, useState, useRef, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { TimelineRow } from './TimelineRow';

import { useMitigationStore } from '../store/useMitigationStore';
import { useThemeStore } from '../store/useThemeStore';
import type { TimelineEvent, Mitigation, AppliedMitigation } from '../types';
import { EventModal } from './EventModal';
import { PhaseModal } from './PhaseModal';

import { MitigationSelector } from './MitigationSelector';
import { JobPicker } from './JobPicker';
import { PartyStatusPopover } from './PartyStatusPopover';
import { PartySettingsModal } from './PartySettingsModal';
import { JobMigrationModal } from './JobMigrationModal';
import { migrateMitigations } from '../utils/jobMigration';
import { AASettingsPopover } from './AASettingsPopover';
import { Plus, Settings, Shield, User, Sword, AlignJustify, Eye, EyeOff, Sparkles, CloudDownload, Undo2, Redo2, Trash2, ChevronDown, X } from 'lucide-react';
import { JOBS, MITIGATIONS } from '../data/mockData';
import clsx from 'clsx';
import { generateAutoPlan } from '../utils/autoPlanner';
import { FFLogsImportModal } from './FFLogsImportModal';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { ConfirmDialog } from './ConfirmDialog';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { MobileBottomSheet } from './MobileBottomSheet';

function genId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id_' + Math.random().toString(36).substring(2, 9);
}

// Helper for column widths
export const getColumnWidth = (role: string) => {
    if (role === 'tank' || role === 'healer') return 125; // 25px * 5 slots
    return 50; // 25px * 2 slots for DPS
};

interface MitigationItemProps {
    mitigation: AppliedMitigation;
    pixelsPerSecond: number;
    onRemove: (id: string) => void;
    onUpdateTime: (id: string, newTime: number) => void;
    top: number;
    height: number;
    left: number;
    laneIndex?: number;
    partySortOrder?: 'role' | 'light_party';
    offsetTime: number;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    activeMitigations: AppliedMitigation[];
    schAetherflowPattern: 1 | 2;
    overlapOffset?: number;
    recastHeight?: number;
    timeToYMap: Map<number, number>; // 👈 追加：コンパクトモードの吸着計算用
}

const getMitigationColorClasses = (jobId: string | undefined, ownerId: string, partySortOrder: string = 'role') => {
    if (partySortOrder === 'light_party') {
        const mtGroup = ['MT', 'H1', 'D1', 'D3'];
        if (mtGroup.includes(ownerId)) {
            return {
                bg: "bg-cyan-500/80",
                border: "border-cyan-400/30",
                shadow: "shadow-[0_0_5px_rgba(6,182,212,0.5)]"
            };
        } else {
            return {
                bg: "bg-amber-500/80",
                border: "border-amber-400/30",
                shadow: "shadow-[0_0_5px_rgba(245,158,11,0.5)]"
            };
        }
    }

    if (!jobId) return {
        bg: "bg-slate-400/80",
        border: "border-slate-300/30",
        shadow: "shadow-[0_0_5px_rgba(148,163,184,0.5)]"
    };

    const tank = ['pld', 'war', 'drk', 'gnb'];
    const healer = ['whm', 'sch', 'ast', 'sge'];
    const melee = ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'];
    const ranged = ['brd', 'mch', 'dnc', 'blm', 'smn', 'rdm', 'pct'];

    if (tank.includes(jobId)) {
        return {
            bg: "bg-blue-500/80",
            border: "border-blue-400/30",
            shadow: "shadow-[0_0_5px_rgba(59,130,246,0.5)]"
        };
    }
    if (healer.includes(jobId)) {
        return {
            bg: "bg-green-500/80",
            border: "border-green-400/30",
            shadow: "shadow-[0_0_5px_rgba(34,197,94,0.5)]"
        };
    }
    if (melee.includes(jobId)) {
        return {
            bg: "bg-red-500/80",
            border: "border-red-400/30",
            shadow: "shadow-[0_0_5px_rgba(239,68,68,0.5)]"
        };
    }
    if (ranged.includes(jobId)) {
        return {
            bg: "bg-orange-500/80",
            border: "border-orange-400/30",
            shadow: "shadow-[0_0_5px_rgba(249,115,22,0.5)]"
        };
    }

    return {
        bg: "bg-slate-400/80",
        border: "border-slate-300/30",
        shadow: "shadow-[0_0_5px_rgba(148,163,184,0.5)]"
    };
};

const MitigationItem: React.FC<MitigationItemProps> = (props) => {
    const {
        mitigation, pixelsPerSecond, onRemove, onUpdateTime,
        top, height, left, partySortOrder, offsetTime,
        scrollContainerRef, activeMitigations, schAetherflowPattern, overlapOffset = 0, recastHeight, timeToYMap
    } = props;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const dragStartRef = useRef<{ pointerY: number; scrollTop: number } | null>(null);
    const autoScrollRef = useRef<number | null>(null);
    const lastPointerYRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const timeLabelRef = useRef<HTMLDivElement>(null);

    const myJobHighlight = useMitigationStore(state => state.myJobHighlight);
    const myMemberId = useMitigationStore(state => state.myMemberId);
    const hideEmptyRows = useMitigationStore(state => state.hideEmptyRows);

    const def = MITIGATIONS.find(m => m.id === mitigation.mitigationId);
    const colors = getMitigationColorClasses(def?.jobId, mitigation.ownerId, partySortOrder);

    const durationHeight = height;
    const recast = def?.recast || 0;
    const recastPx = recastHeight ?? (recast * pixelsPerSecond);

    // 👇 追加：Y座標から、コンパクトモード時でも正確に「どの時間の行を指しているか」を逆算する関数
    const getTimeFromY = (targetY: number): number => {
        if (!hideEmptyRows) {
            return Math.max(offsetTime, offsetTime + Math.round(targetY / pixelsPerSecond));
        }

        // コンパクトモード時：Y座標が一番近い「可視行の時間」を探す
        let closestTime = offsetTime;
        let minDiff = Infinity;

        timeToYMap.forEach((mappedY, time) => {
            const diff = Math.abs(mappedY - targetY);
            if (diff < minDiff) {
                minDiff = diff;
                closestTime = time;
            } else if (diff === minDiff && time > closestTime) {
                // 👇 修正：同じY座標（距離が同じ）なら、必ず一番大きい時間（＝実際の可視行）を選ぶ
                closestTime = time;
            }
        });

        return closestTime;
    };

    const updateDragPosition = (dy: number, animateSnap: boolean = false) => {
        if (!containerRef.current) return;

        if (animateSnap) {
            containerRef.current.style.transition = 'top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        } else {
            containerRef.current.style.transition = 'none';
        }

        const currentY = top + dy;
        containerRef.current.style.top = `${currentY + 13}px`;
        containerRef.current.style.zIndex = '50';
        containerRef.current.style.opacity = '0.9';

        // 修正：スナップ先の時間を計算
        const snappedTime = getTimeFromY(currentY);
        // その時間の正しいY座標（コンパクトモードの圧縮を加味）
        const snappedY = hideEmptyRows ? (timeToYMap.get(snappedTime) ?? currentY) : (snappedTime - offsetTime) * pixelsPerSecond;
        const relativeY = snappedY - currentY; // containerRefからの相対位置

        if (indicatorRef.current) {
            indicatorRef.current.style.display = 'block';
            indicatorRef.current.style.top = `${relativeY}px`;
        }
        if (timeLabelRef.current) {
            timeLabelRef.current.style.display = 'block';
            timeLabelRef.current.style.top = `${relativeY - 8}px`;
            const min = Math.floor(Math.abs(snappedTime) / 60);
            const sec = Math.abs(snappedTime) % 60;
            const sign = snappedTime < 0 ? '-' : '';
            timeLabelRef.current.textContent = `${sign}${min}:${sec.toString().padStart(2, '0')} `;
        }
    };

    const resetDragPosition = (animate: boolean = false) => {
        if (!containerRef.current) return;

        if (animate) {
            containerRef.current.style.transition = 'top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        } else {
            containerRef.current.style.transition = 'none';
        }

        containerRef.current.style.top = `${top + 13}px`;

        if (animate) {
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.style.zIndex = '';
                    containerRef.current.style.opacity = '';
                    containerRef.current.style.transition = '';
                }
            }, 300);
        } else {
            containerRef.current.style.zIndex = '';
            containerRef.current.style.opacity = '';
        }

        if (indicatorRef.current) indicatorRef.current.style.display = 'none';
        if (timeLabelRef.current) timeLabelRef.current.style.display = 'none';
    };

    const [toastMessage, setToastMessage] = useState<{ message: string; leftOffset: number } | null>(null);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 2500);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragStartRef.current) return;
        onRemove(mitigation.id);
    };

    const handleTouchStart = () => {
        timerRef.current = setTimeout(() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
            onRemove(mitigation.id);
        }, 600);
    };

    const handleTouchEnd = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const handleTouchMove = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const EDGE_ZONE = 60;
    const MAX_SCROLL_SPEED = 15;

    const stopAutoScroll = () => {
        if (autoScrollRef.current !== null) {
            cancelAnimationFrame(autoScrollRef.current);
            autoScrollRef.current = null;
        }
    };

    const startAutoScroll = () => {
        const tick = () => {
            const container = scrollContainerRef.current;
            if (!container || !dragStartRef.current) { stopAutoScroll(); return; }

            const rect = container.getBoundingClientRect();
            const pointerY = lastPointerYRef.current;
            const distFromTop = pointerY - rect.top;
            const distFromBottom = rect.bottom - pointerY;

            let scrollDelta = 0;
            if (distFromTop < EDGE_ZONE && distFromTop >= 0) {
                scrollDelta = -MAX_SCROLL_SPEED * (1 - distFromTop / EDGE_ZONE);
            } else if (distFromBottom < EDGE_ZONE && distFromBottom >= 0) {
                scrollDelta = MAX_SCROLL_SPEED * (1 - distFromBottom / EDGE_ZONE);
            }

            if (scrollDelta !== 0) {
                container.scrollTop += scrollDelta;
                const scrollTop = container.scrollTop;
                const totalScrollDelta = scrollTop - dragStartRef.current.scrollTop;
                const dy = pointerY - dragStartRef.current.pointerY + totalScrollDelta;
                updateDragPosition(dy);
            }

            autoScrollRef.current = requestAnimationFrame(tick);
        };
        stopAutoScroll();
        autoScrollRef.current = requestAnimationFrame(tick);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        dragStartRef.current = { pointerY: e.clientY, scrollTop };
        lastPointerYRef.current = e.clientY;
        updateDragPosition(0);
        startAutoScroll();
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragStartRef.current) return;
        lastPointerYRef.current = e.clientY;
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        const scrollDelta = scrollTop - dragStartRef.current.scrollTop;
        const dy = e.clientY - dragStartRef.current.pointerY + scrollDelta;
        updateDragPosition(dy);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragStartRef.current) return;
        stopAutoScroll();
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        const scrollDelta = scrollTop - dragStartRef.current.scrollTop;
        const dy = e.clientY - dragStartRef.current.pointerY + scrollDelta;

        // 👇 修正：指を離した最終的なY座標から、スナップ先の時間を計算する
        const finalY = top + dy;
        const newTime = getTimeFromY(finalY);

        dragStartRef.current = null;

        if (newTime !== mitigation.time && def) {
            const status = validateMitigationPlacement(def, newTime, activeMitigations, schAetherflowPattern, t, mitigation.id);

            if (status.available) {
                resetDragPosition(false);
                onUpdateTime(mitigation.id, newTime);
            } else {
                const containerLeft = scrollContainerRef.current?.getBoundingClientRect().left ?? 0;
                setToastMessage({
                    message: status.message || t('timeline.invalid_placement', 'Invalid placement'),
                    leftOffset: containerLeft + left
                });
                resetDragPosition(true);
            }
        } else {
            resetDragPosition(false);
        }
    };

    const iconUrl = def?.icon;
    const nameStr = def ? (contentLanguage === 'en' ? def.name.en : def.name.ja) : '';

    return (
        <>
            {toastMessage && (
                <div
                    className="fixed z-[150] bg-red-600 border border-red-400 text-slate-800 dark:text-white px-3 py-1.5 rounded-lg shadow-[0_4px_16px_rgba(220,38,38,0.5)] flex items-center justify-center gap-2 pointer-events-none transition-all duration-200 animate-in slide-in-from-top-2 fade-in whitespace-nowrap"
                    style={{
                        left: `${toastMessage.leftOffset + 12}px`,
                        top: `88px`,
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-600 border-l border-t border-red-400 rotate-45" />
                    <span className="text-xs font-bold whitespace-nowrap relative z-10">{toastMessage.message}</span>
                </div>
            )}

            <div
                ref={containerRef}
                className="absolute flex flex-col items-center group select-none pointer-events-none animate-in zoom-in-90 fade-in duration-200"
                style={{ left: `${left}px`, top: `${top + 13}px`, width: '24px' }}
            >
                <div
                    ref={indicatorRef}
                    className="absolute pointer-events-none"
                    style={{ display: 'none', left: '-4px', width: '32px', height: '2px', background: 'rgba(56,189,248,0.8)', boxShadow: '0 0 6px rgba(56,189,248,0.6)', borderRadius: '1px', zIndex: 100 }}
                />
                <div
                    ref={timeLabelRef}
                    className="absolute pointer-events-none text-[10px] font-mono text-sky-300 bg-black/70 px-1 rounded"
                    style={{ display: 'none', left: '28px', zIndex: 100 }}
                />
                <div
                    className={clsx(
                        "w-6 h-6 rounded shadow-md relative z-20 cursor-grab hover:scale-110 transition-transform pointer-events-auto",
                        myJobHighlight && myMemberId && myMemberId !== mitigation.ownerId && "opacity-40 grayscale"
                    )}
                    onContextMenu={handleContextMenu}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    title={`${nameStr || t('timeline.mitigation')} ${mitigation.targetId ? `(→ ${mitigation.targetId})` : ''} ${t('timeline.mitigation_drag_hint')} `}
                >
                    <div className="w-full h-full bg-black/50 overflow-hidden rounded border border-white/20">
                        {iconUrl ? <img src={iconUrl} className="w-full h-full object-cover pointer-events-none" draggable={false} /> : <div className="w-full h-full bg-slate-500"></div>}
                    </div>

                    {mitigation.targetId && (() => {
                        const members = useMitigationStore.getState().partyMembers;
                        const targetMember = members.find((m: import('../types').PartyMember) => m.id === mitigation.targetId);
                        const targetJob = targetMember?.jobId ? JOBS.find(j => j.id === targetMember.jobId) : null;
                        return (
                            <div className="absolute -bottom-2 -right-2 z-30 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                                {targetJob ? (
                                    <img src={targetJob.icon} alt={contentLanguage === 'en' ? targetJob.name.en : targetJob.name.ja} className="w-[20px] h-[20px] object-contain rounded-sm" />
                                ) : (
                                    <div className="bg-black/90 rounded px-1 py-0.5 text-[8px] font-black text-slate-800 dark:text-white ring-1 ring-white/20 origin-bottom-right">
                                        {mitigation.targetId}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                <div
                    className={clsx(
                        "absolute top-3 w-1.5 z-10 rounded-b-sm border-x backdrop-blur-sm pointer-events-none",
                        colors.bg,
                        colors.border,
                        colors.shadow,
                        myJobHighlight && myMemberId && myMemberId !== mitigation.ownerId && "opacity-40"
                    )}
                    style={{
                        height: `${Math.max(0, durationHeight)}px`,
                        left: `calc(50% + ${overlapOffset}px)`,
                        transform: 'translateX(-50%)'
                    }}
                ></div>

                {recastPx > durationHeight && (
                    <div
                        className={clsx(
                            "absolute w-0 border-l-[2px] border-dotted border-slate-500/40 z-0 pointer-events-none",
                            myJobHighlight && myMemberId && myMemberId !== mitigation.ownerId && "opacity-30"
                        )}
                        style={{
                            top: `${12 + Math.max(0, durationHeight)}px`,
                            height: `${Math.max(0, recastPx - durationHeight)}px`,
                            left: `calc(50% + ${overlapOffset}px)`,
                            transform: 'translateX(-50%)'
                        }}
                    ></div>
                )}
            </div>
        </>
    );
};

export const Timeline: React.FC = () => {
    const { theme, contentLanguage } = useThemeStore();
    const { t } = useTranslation();
    const { mobilePartyOpen, setMobilePartyOpen, mobileStatusOpen, setMobileStatusOpen, mobileToolsOpen, setMobileToolsOpen } = useContext(MobileTriggersContext);

    const {
        addEvent, updateEvent, removeEvent, addMitigation,
        setMemberJob,
        aaSettings, setAaSettings,
        schAetherflowPatterns, setSchAetherflowPattern,
        partyMembers,
        timelineMitigations,
        timelineEvents,
        removeMitigation,
        updateMitigationTime,
        addPhase,
        updatePhase,
        removePhase,
        phases,
        myJobHighlight,
        setMyJobHighlight,
        changeMemberJobWithMitigations,
        clipboardEvent,
        setClipboardEvent,
        hideEmptyRows,
    } = useMitigationStore();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
    const [selectedTime, setSelectedTime] = useState<number>(0);
    const [eventModalPosition, setEventModalPosition] = useState({ x: 0, y: 0 });

    const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState<{ id: string, name: string } | null>(null);
    const [selectedPhaseTime, setSelectedPhaseTime] = useState<number>(0);
    const [phaseModalPosition, setPhaseModalPosition] = useState({ x: 0, y: 0 });

    const [mobileMitiFlow, setMobileMitiFlow] = useState<{
        isOpen: boolean;
        time: number;
        step: 'job' | 'skill';
        selectedMemberId: string | null;
    }>({ isOpen: false, time: 0, step: 'job', selectedMemberId: null });

    const [mitigationSelectorOpen, setMitigationSelectorOpen] = useState(false);
    const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedMitigationTime, setSelectedMitigationTime] = useState<number>(0);

    const [jobPickerOpen, setJobPickerOpen] = useState(false);
    const [jobPickerPosition, setJobPickerPosition] = useState({ x: 0, y: 0 });
    const [jobPickerMemberId, setJobPickerMemberId] = useState<string | null>(null);

    type MigrationMode = 'inherit' | 'common_only' | 'reset';
    const [migrationConfig, setMigrationConfig] = useState<{
        isOpen: boolean;
        memberId: string;
        oldJobId: string;
        newJobId: string;
    } | null>(null);

    const [partySettingsOpen, setPartySettingsOpen] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);

    useEffect(() => {
        if (mobilePartyOpen) {
            setPartySettingsOpen(true);
            setMobilePartyOpen(false);
        }
    }, [mobilePartyOpen]);
    useEffect(() => {
        if (mobileStatusOpen) {
            setStatusOpen(true);
            setMobileStatusOpen(false);
        }
    }, [mobileStatusOpen]);

    const [mobileToolsSheetOpen, setMobileToolsSheetOpen] = useState(false);
    useEffect(() => {
        if (mobileToolsOpen) {
            setMobileToolsSheetOpen(true);
            setMobileToolsOpen(false);
        }
    }, [mobileToolsOpen]);

    const [isAaModeEnabled, setIsAaModeEnabled] = useState(false);
    const [aaSettingsOpen, setAaSettingsOpen] = useState(false);
    const aaSettingsButtonRef = useRef<HTMLButtonElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const schBarRef = useRef<HTMLDivElement>(null);
    const timeToYMapRef = useRef(new Map<number, number>());

    const handleScrollSync = () => {
        if (!scrollContainerRef.current) return;
        const scrollLeft = scrollContainerRef.current.scrollLeft;
        if (headerRef.current) headerRef.current.scrollLeft = scrollLeft;
        if (schBarRef.current) schBarRef.current.scrollLeft = scrollLeft;
    };

    useEffect(() => {
        const syncPadding = () => {
            if (scrollContainerRef.current && headerRef.current) {
                const scrollbarWidth = scrollContainerRef.current.offsetWidth - scrollContainerRef.current.clientWidth;
                headerRef.current.style.paddingRight = `${scrollbarWidth}px`;
                if (schBarRef.current) schBarRef.current.style.paddingRight = `${scrollbarWidth}px`;
            }
        };

        syncPadding();
        window.addEventListener('resize', syncPadding);
        return () => window.removeEventListener('resize', syncPadding);
    }, []);

    const [showPreStart] = useState(true);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'warning' } | null>(null);

    const handleAutoPlan = () => {
        const executePlan = () => {
            const { timelineEvents, partyMembers } = useMitigationStore.getState();
            const newMitigations = generateAutoPlan(timelineEvents, partyMembers);
            useMitigationStore.getState().applyAutoPlan(newMitigations);
        };

        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setTimeout(() => {
                const isConfirmed = window.confirm(
                    t('timeline.auto_plan_confirm_mobile', "オートプランを実行しますか？\n\n※現在の軽減の配置はすべて削除され、新しく上書きされます。")
                );
                if (isConfirmed) {
                    executePlan();
                }
            }, 150);
        } else {
            setConfirmDialog({
                title: t('timeline.auto_plan_title', 'オートプラン実行'),
                message: t('timeline.auto_plan_confirm', '現在のタイムラインに基づいて軽減プランを自動生成します。\n既存の配置はすべて削除され、新しく上書きされます。実行しますか？'),
                variant: 'warning',
                onConfirm: () => {
                    executePlan();
                    setConfirmDialog(null);
                },
            });
        }
    };

    const pixelsPerSecond = 50;
    const fightDuration = 1200;

    const gridLines = useMemo(() => {
        const lines = [];
        const start = -10;
        const end = fightDuration;
        for (let i = start; i <= end; i++) {
            lines.push(i);
        }
        return lines;
    }, [fightDuration]);

    const eventsByTime = useMemo(() => {
        const map = new Map<number, TimelineEvent[]>();
        timelineEvents.forEach(event => {
            const t = event.time;
            if (!map.has(t)) map.set(t, []);
            map.get(t)?.push(event);
        });
        return map;
    }, [timelineEvents]);

    const handleAddClick = (time: number, e: React.MouseEvent) => {
        e.stopPropagation();

        if (clipboardEvent) {
            const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
            addEvent({
                ...clipboardEvent,
                id: generateId(),
                time: time
            });
            return;
        }

        if (isAaModeEnabled) {
            const existingEvents = eventsByTime.get(time) || [];
            if (existingEvents.length < 2) {
                const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
                addEvent({
                    id: newId,
                    time: time,
                    name: { ja: 'AA', en: 'AA' },
                    damageAmount: aaSettings.damage,
                    damageType: aaSettings.type,
                    target: aaSettings.target
                });
                return;
            } else {
                setIsAaModeEnabled(false);
            }
        }

        setEventModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedTime(time);
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handlePhaseAdd = (time: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setPhaseModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedPhaseTime(time + 1);
        setSelectedPhase(null);
        setIsPhaseModalOpen(true);
    };

    const handlePhaseEdit = (id: string, currentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPhaseModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedPhase({ id, name: currentName });
        setIsPhaseModalOpen(true);
    };

    const handlePhaseSave = (name: string, time?: number) => {
        if (selectedPhase) {
            updatePhase(selectedPhase.id, name);
        } else {
            const targetTime = time !== undefined ? time : selectedPhaseTime;
            if (targetTime !== undefined) {
                addPhase(targetTime, name);
            }
        }
    };

    const handlePhaseDelete = () => {
        if (selectedPhase) {
            removePhase(selectedPhase.id);
            setIsPhaseModalOpen(false);
        }
    };

    const handleEventClick = (event: TimelineEvent, e: React.MouseEvent) => {
        e.stopPropagation();

        if (isAaModeEnabled) {
            setIsAaModeEnabled(false);
        }

        setEventModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const handleSave = (eventData: Omit<TimelineEvent, 'id'>) => {
        const generateId = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return 'evt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        };

        const newId = generateId();

        if (selectedEvent) {
            updateEvent(selectedEvent.id, eventData);
        } else {
            addEvent({
                ...eventData,
                id: newId,
            });
        }
        setIsModalOpen(false);

        setTimeout(() => {
            if (scrollContainerRef.current) {
                const targetY = timeToYMapRef.current.get(eventData.time);
                if (targetY !== undefined) {
                    scrollContainerRef.current.scrollTo({
                        top: targetY,
                        behavior: 'smooth'
                    });
                }
            }
        }, 100);
    };

    const handleDelete = () => {
        if (selectedEvent) {
            if (confirm(t('timeline.delete_event_confirm'))) {
                removeEvent(selectedEvent.id);
                setIsModalOpen(false);
            }
        }
    };

    const handleCellClick = (memberId: string, time: number, e: React.MouseEvent) => {
        const member = partyMembers.find(m => m.id === memberId);
        if (!member || !member.jobId) return;

        setSelectorPosition({ x: e.clientX, y: e.clientY });
        setSelectedMemberId(memberId);
        setSelectedMitigationTime(time);
        setMitigationSelectorOpen(true);
    };

    const handleMobileDamageClick = (time: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setMobileMitiFlow({ isOpen: true, time, step: 'job', selectedMemberId: null });
    };

    const handleDamageClick = (time: number, e: React.MouseEvent) => {
        const targetId = useMitigationStore.getState().myMemberId || partyMembers.find(m => m.role === 'healer')?.id;
        if (!targetId) return;
        const member = partyMembers.find(m => m.id === targetId);
        if (!member || !member.jobId) return;

        setSelectorPosition({ x: e.clientX, y: e.clientY });
        setSelectedMemberId(targetId);
        setSelectedMitigationTime(time);
        setMitigationSelectorOpen(true);
    };

    const handleMitigationSelect = (mitigation: Mitigation & { _targetId?: string }) => {
        if (!selectedMemberId) return;

        addMitigation({
            id: globalThis.crypto?.randomUUID() || Math.random().toString(36).substring(2, 15),
            mitigationId: mitigation.id,
            time: selectedMitigationTime,
            duration: mitigation.duration,
            ownerId: selectedMemberId,
            targetId: mitigation._targetId
        });
        setMitigationSelectorOpen(false);
    };

    const handleJobIconClick = (memberId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setJobPickerPosition({ x: e.clientX, y: e.clientY });
        setJobPickerMemberId(memberId);
        setJobPickerOpen(true);
    };

    const handleJobSelect = (jobId: string) => {
        if (jobPickerMemberId) {
            const targetMember = partyMembers.find(m => m.id === jobPickerMemberId);
            if (targetMember) {
                if (targetMember.jobId === jobId) {
                    setJobPickerOpen(false);
                    return;
                }

                const hasMitigations = timelineMitigations.some(m => m.ownerId === targetMember.id);

                if (hasMitigations && targetMember.jobId) {
                    setMigrationConfig({
                        isOpen: true,
                        memberId: targetMember.id,
                        oldJobId: targetMember.jobId,
                        newJobId: jobId
                    });
                    setJobPickerOpen(false);
                    return;
                } else {
                    setMemberJob(targetMember.id, jobId);
                }
            }
        }
        setJobPickerOpen(false);
    };

    const handleMigrationConfirm = (mode: MigrationMode) => {
        if (!migrationConfig) return;

        const { memberId, oldJobId, newJobId } = migrationConfig;

        const memberMitis = timelineMitigations.filter(m => m.ownerId === memberId);
        const newMitis = migrateMitigations(oldJobId, newJobId, memberId, memberMitis, mode);

        changeMemberJobWithMitigations(memberId, newJobId, newMitis);
        setMigrationConfig(null);
    };

    const handleMigrationCancel = () => {
        setMigrationConfig(null);
    };

    const damageMap = useMemo(() => {
        const map = new Map<string, { unmitigated: number; mitigated: number, mitigationPercent: number, shieldTotal: number, isInvincible?: boolean }>();
        const sortedEvents = [...timelineEvents].sort((a, b) => a.time - b.time);
        const shieldStates = new Map<string, Map<string, number>>();

        const getShieldState = (context: string, instanceId: string, maxValue: number) => {
            if (!shieldStates.has(context)) {
                shieldStates.set(context, new Map());
            }
            const contextMap = shieldStates.get(context)!;
            if (!contextMap.has(instanceId)) {
                contextMap.set(instanceId, maxValue);
            }
            return contextMap.get(instanceId)!;
        };

        const updateShieldState = (context: string, instanceId: string, newValue: number) => {
            if (!shieldStates.has(context)) {
                shieldStates.set(context, new Map());
            }
            shieldStates.get(context)!.set(instanceId, newValue);
        };

        sortedEvents.forEach(event => {
            if (!event.damageAmount) {
                map.set(event.id, { unmitigated: 0, mitigated: 0, mitigationPercent: 0, shieldTotal: 0, isInvincible: false });
                return;
            }

            const target = event.target;
            const displayContext = (target === 'MT' || target === 'ST') ? target : 'Party';
            const affectedContexts = (target === 'MT' || target === 'ST') ? [target] : ['Party', 'MT', 'ST'];

            let currentDamage = event.damageAmount;
            let mitigationMultipliers = 1;
            let displayShieldTotal = 0;
            let displayShieldAbsorbed = 0;
            let isInvincibleForEvent = false;

            const activeMitigations = timelineMitigations.filter(m =>
                m.time <= event.time && event.time < m.time + m.duration
            );

            activeMitigations.forEach(appMit => {
                const def = MITIGATIONS.find(m => m.id === appMit.mitigationId);
                if (!def || def.isShield) return;

                if (def.scope === 'self' && appMit.ownerId !== displayContext && appMit.targetId !== displayContext) return;
                if (appMit.targetId && appMit.targetId !== displayContext) return;

                if (def.isInvincible) {
                    currentDamage = 0;
                    isInvincibleForEvent = true;
                }

                if (isInvincibleForEvent) return;

                let mitigationValue = def.value;
                if (event.damageType === 'physical' && def.valuePhysical !== undefined) {
                    mitigationValue = def.valuePhysical;
                } else if (event.damageType === 'magical' && def.valueMagical !== undefined) {
                    mitigationValue = def.valueMagical;
                } else {
                    if (def.type === 'physical' && event.damageType === 'magical') return;
                    if (def.type === 'magical' && event.damageType === 'physical') return;
                }

                const multiplier = (1 - mitigationValue / 100);
                currentDamage *= multiplier;
                mitigationMultipliers *= multiplier;
            });

            currentDamage = Math.floor(currentDamage);
            const damageForShields = currentDamage;

            if (!isInvincibleForEvent) {
                activeMitigations.forEach(appMit => {
                    const def = MITIGATIONS.find(m => m.id === appMit.mitigationId);
                    if (!def) return;

                    let isConditionalShield = false;
                    if (def.id === 'helios_conjunction') {
                        const nsActive = timelineMitigations.some(m =>
                            m.mitigationId === 'neutral_sect' &&
                            m.time <= appMit.time &&
                            appMit.time < m.time + m.duration
                        );
                        if (nsActive) isConditionalShield = true;
                    }

                    if (!def.isShield && !isConditionalShield) return;
                    if (def.scope === 'self' && appMit.ownerId !== displayContext && appMit.targetId !== displayContext) return;
                    if (appMit.targetId && appMit.targetId !== displayContext) return;
                    if (def.type === 'physical' && event.damageType === 'magical') return;
                    if (def.type === 'magical' && event.damageType === 'physical') return;

                    const member = partyMembers.find(m => m.id === appMit.ownerId);
                    if (!member) return;

                    let healingMultiplier = 1;
                    const buffsAtCast = timelineMitigations.filter(b =>
                        b.time <= appMit.time && appMit.time < b.time + b.duration && b.id !== appMit.id
                    );

                    buffsAtCast.forEach(buff => {
                        const bDef = MITIGATIONS.find(d => d.id === buff.mitigationId);
                        if (bDef && bDef.healingIncrease) {
                            if (bDef.scope === 'self' && buff.ownerId !== displayContext) return;
                            healingMultiplier += (bDef.healingIncrease / 100);
                        }
                    });

                    const maxValBase = member.computedValues[def.name.en] || member.computedValues[def.name.ja] || 0;
                    const maxVal = Math.floor(maxValBase * healingMultiplier);

                    const remainingForDisplay = getShieldState(displayContext, appMit.id, maxVal);
                    displayShieldTotal += remainingForDisplay;

                    if (remainingForDisplay > 0 && currentDamage > 0) {
                        const absorbed = Math.min(remainingForDisplay, currentDamage);
                        currentDamage -= absorbed;
                        displayShieldAbsorbed += absorbed;
                    }

                    affectedContexts.forEach(ctx => {
                        const remaining = getShieldState(ctx, appMit.id, maxVal);
                        if (remaining > 0) {
                            const absorbed = Math.min(remaining, damageForShields);
                            updateShieldState(ctx, appMit.id, remaining - absorbed);
                        }
                    });
                });
            }

            const finalTaken = Math.max(0, currentDamage);
            const percentMod = Math.round((1 - mitigationMultipliers) * 100);

            map.set(event.id, {
                unmitigated: event.damageAmount,
                mitigated: finalTaken,
                mitigationPercent: percentMod,
                shieldTotal: displayShieldTotal,
                isInvincible: isInvincibleForEvent
            });
        });

        return map;
    }, [eventsByTime, timelineMitigations, partyMembers]);

    const [partySortOrder, setPartySortOrder] = useState<'light_party' | 'role'>('light_party');
    const [clearMenuOpen, setClearMenuOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                useMitigationStore.getState().undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                useMitigationStore.getState().redo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                useMitigationStore.getState().redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!clearMenuOpen) return;
        const handleClick = () => setClearMenuOpen(false);
        const timer = setTimeout(() => {
            window.addEventListener('click', handleClick);
        }, 0);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('click', handleClick);
        };
    }, [clearMenuOpen]);

    const sortedPartyMembers = useMemo(() => {
        const lightPartyOrder = ['MT', 'H1', 'D1', 'D3', 'ST', 'H2', 'D2', 'D4'];
        const roleOrder = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];

        const order = partySortOrder === 'light_party' ? lightPartyOrder : roleOrder;

        return [...partyMembers].sort((a, b) => {
            const indexA = order.indexOf(a.id);
            const indexB = order.indexOf(b.id);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });
    }, [partyMembers, partySortOrder]);

    const memberLayout = useMemo(() => {
        let currentLeft = 570;
        const layout = new Map<string, { left: number; width: number }>();
        sortedPartyMembers.forEach(m => {
            const width = getColumnWidth(m.role);
            layout.set(m.id, { left: currentLeft, width });
            currentLeft += width;
        });
        return layout;
    }, [sortedPartyMembers]);

    const getJobIcon = (jobId: string | null) => {
        if (!jobId) return null;
        const job = JOBS.find(j => j.id === jobId);
        return job ? job.icon : null;
    };

    return (
        <>
            <div className="flex flex-col h-full w-full bg-transparent px-2 md:px-6 pt-1 md:pt-2 pb-16 md:pb-6 overflow-auto relative z-[1]">
                <div className="absolute inset-0 pointer-events-none"></div>

                <div className="mb-4 hidden md:flex items-center justify-between bg-glass-panel backdrop-blur-xl p-2 rounded-2xl shadow-glass border border-glass-border relative z-[100] group/bar">
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

                    <div className="flex items-center gap-2 relative">
                        <button
                            onClick={() => setPartySettingsOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm text-slate-700 dark:text-slate-200 group/btn relative overflow-hidden cursor-pointer water-drop"
                            title={t('party.title')}
                        >
                            <User size={16} className="text-blue-600 dark:text-blue-300 opacity-100 group-hover/btn:text-blue-800 dark:group-hover/btn:text-white group-hover/btn:scale-110 transition-all duration-300" />
                            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-700 dark:text-slate-200 group-hover/btn:text-slate-900 dark:group-hover/btn:text-white transition-colors shadow-black/50 drop-shadow-sm">{t('party.comp_short')}</span>
                        </button>

                        <button
                            onClick={() => setStatusOpen(!statusOpen)}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-2xl text-sm transition-all duration-300 relative overflow-hidden group/btn cursor-pointer",
                                statusOpen
                                    ? "bg-blue-500/40 border-blue-400 text-slate-900 dark:text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] border"
                                    : "water-drop text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
                            )}
                            title={t('settings.party_stats')}
                        >
                            <Shield size={16} className={clsx("transition-transform duration-300 group-hover/btn:scale-110", statusOpen ? "text-slate-900 dark:text-white" : "text-blue-600 dark:text-blue-300 group-hover/btn:text-blue-800 dark:group-hover/btn:text-white")} />
                            <span className="font-bold text-[10px] uppercase tracking-wider shadow-black/50 drop-shadow-sm">{t('settings.config_short')}</span>
                        </button>

                        <div className="flex items-center gap-0.5 relative">
                            <button
                                onClick={() => setIsAaModeEnabled(!isAaModeEnabled)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-2 rounded-l-2xl text-sm transition-all duration-300 relative overflow-hidden group/btn cursor-pointer border",
                                    isAaModeEnabled
                                        ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.6)]"
                                        : "bg-transparent border-transparent water-drop text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10"
                                )}
                                title="AA Registration Mode"
                            >
                                <Sword size={16} className={clsx("transition-transform duration-300 group-hover/btn:scale-110", isAaModeEnabled ? "text-white" : "text-slate-600 dark:text-slate-300 group-hover/btn:text-slate-900 dark:group-hover/btn:text-white")} />
                                <span className="font-bold text-[10px] uppercase tracking-wider shadow-black/50 drop-shadow-sm">AA Mode</span>
                            </button>
                            <button
                                ref={aaSettingsButtonRef}
                                onClick={() => setAaSettingsOpen(!aaSettingsOpen)}
                                className={clsx(
                                    "px-1.5 py-2 rounded-r-2xl border-l-[1px] border-black/10 dark:border-white/10 transition-colors cursor-pointer hover:bg-black/10 dark:hover:bg-white/10",
                                    isAaModeEnabled ? "bg-blue-600 border-blue-500 text-white" : "bg-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                )}
                                title="AA Settings"
                            >
                                <Settings size={12} />
                            </button>

                            <div className="absolute top-0 left-full ml-2 z-[101] origin-top-left">
                                <AASettingsPopover
                                    isOpen={aaSettingsOpen}
                                    onClose={() => setAaSettingsOpen(false)}
                                    settings={aaSettings}
                                    onSettingsChange={setAaSettings}
                                    triggerRef={aaSettingsButtonRef}
                                />
                            </div>
                        </div>

                        <div className="w-[1px] h-6 bg-slate-900/ dark:bg-white/ mx-1" />

                        <button
                            onClick={handleAutoPlan}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl transition-all duration-300 cursor-pointer bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/40 hover:text-slate-800 dark:hover:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] group/btn"
                            title="Auto Plan Mitigations"
                        >
                            <Sparkles size={16} className="text-blue-400 group-hover/btn:scale-110 transition-transform" />
                            <span className="text-[10px] font-bold uppercase tracking-wider mt-[1px]">Auto Plan</span>
                        </button>

                        <button
                            onClick={() => setImportModalOpen(true)}
                            className="p-2 rounded-2xl transition-all duration-300 flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 group/btn border border-transparent hover:border-black/5 dark:hover:border-white/10"
                            title="Import from FFLogs"
                        >
                            <CloudDownload size={16} className="group-hover/btn:-translate-y-0.5 transition-transform" />
                        </button>
                    </div>

                    <PartyStatusPopover isOpen={statusOpen} onClose={() => setStatusOpen(false)} />

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMyJobHighlight(!myJobHighlight)}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all duration-300 relative overflow-hidden group/btn cursor-pointer border",
                                myJobHighlight
                                    ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-700 dark:text-yellow-100 shadow-[inset_0_1px_0_rgba(250,204,21,0.2)]"
                                    : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
                            )}
                            title={t('party.my_job_select')}
                        >
                            {myJobHighlight ? (
                                <Eye size={14} className="text-yellow-600 dark:text-yellow-400" />
                            ) : (
                                <EyeOff size={14} className="text-slate-500 dark:text-slate-400 group-hover/btn:text-slate-800 dark:group-hover/btn:text-slate-200" />
                            )}
                            <span className="font-bold text-[10px] uppercase tracking-wider mt-[1px]">MY JOB HIGHLIGHT</span>
                            <div className={clsx(
                                "w-7 h-4 rounded-full flex items-center p-0.5 transition-colors ml-1",
                                myJobHighlight ? "bg-yellow-500" : "bg-black/20 dark:bg-white/10"
                            )}>
                                <div className={clsx(
                                    "w-3 h-3 rounded-full bg-white transition-transform shadow-sm",
                                    myJobHighlight ? "translate-x-3" : "translate-x-0"
                                )} />
                            </div>
                        </button>

                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-200/50 dark:bg-black/50 rounded-2xl border border-slate-300/50 dark:border-white/15 relative shadow-inner">
                            <div className="absolute inset-x-0 top-0 h-[1px] bg-white/[0.05] pointer-events-none" />
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mr-2 shadow-black/50 drop-shadow-sm">{t('ui.sort')}:</span>

                            <div className="flex gap-1 bg-slate-300/50 dark:bg-black/30 p-1 rounded-xl border border-slate-400/30 dark:border-white/10">
                                <button
                                    onClick={() => setPartySortOrder('light_party')}
                                    className={clsx(
                                        "px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-300 border cursor-pointer",
                                        partySortOrder === 'light_party'
                                            ? "bg-blue-100 text-blue-700 border-blue-300 shadow-sm dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30"
                                            : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-black/5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
                                    )}
                                >
                                    LIGHT PARTY
                                </button>
                                <div className="w-[1px] h-4 bg-slate-400/50 dark:bg-white/10 my-auto" />
                                <button
                                    onClick={() => setPartySortOrder('role')}
                                    className={clsx(
                                        "px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-300 border cursor-pointer",
                                        partySortOrder === 'role'
                                            ? "bg-blue-100 text-blue-700 border-blue-300 shadow-sm dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30"
                                            : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-black/5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
                                    )}
                                >
                                    Role Order
                                </button>
                            </div>

                            <div className="w-[1px] h-4 bg-slate-400/50 dark:bg-white/10 my-auto mx-1" />
                            <button
                                onClick={() => useMitigationStore.getState().setHideEmptyRows(!useMitigationStore.getState().hideEmptyRows)}
                                className={clsx(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-300 border cursor-pointer",
                                    useMitigationStore.getState().hideEmptyRows
                                        ? "bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30"
                                        : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-black/5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
                                )}
                                title="Toggle Empty Rows"
                            >
                                <AlignJustify size={14} className={useMitigationStore.getState().hideEmptyRows ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"} />
                                COMPACT
                            </button>
                        </div>
                    </div>
                </div >

                <div className={clsx(
                    "relative flex-1 flex flex-col pt-0 glass-panel rounded-xl overflow-hidden shadow-2xl border transition-colors",
                    theme === 'dark' ? "border-white/5" : "border-slate-200"
                )}>
                    <div
                        className={clsx(
                            "flex-shrink-0 z-[51] h-7 relative backdrop-blur-md border-b flex items-center justify-between px-1 transition-colors",
                            theme === 'dark' ? "bg-[#111214]/90 border-white/[0.03]" : "bg-slate-50/90 border-slate-200"
                        )}>
                        <div className="flex items-center relative flex-1">
                            {(() => {
                                const schMembers = sortedPartyMembers
                                    .map((m, idx) => ({ member: m, idx }))
                                    .filter(({ member }) => member.jobId === 'sch');
                                if (schMembers.length === 0) return null;
                                const fixedColsWidth = 570;
                                return schMembers.map(({ member, idx }) => {
                                    let schLeft = fixedColsWidth;
                                    for (let i = 0; i < idx; i++) {
                                        schLeft += getColumnWidth(sortedPartyMembers[i].role);
                                    }
                                    const schWidth = getColumnWidth('healer');
                                    const isPatternOne = (schAetherflowPatterns[member.id] ?? 1) === 1;
                                    return (
                                        <div
                                            key={member.id}
                                            className="absolute top-0 h-full flex items-center justify-center"
                                            style={{ left: `${schLeft - 30}px`, width: `${schWidth + 60}px` }}
                                        >
                                            <button
                                                onClick={() => setSchAetherflowPattern(member.id, isPatternOne ? 2 : 1)}
                                                className={clsx(
                                                    "flex items-center gap-1 px-2.5 py-0.5 rounded-full border transition-all duration-300 cursor-pointer group shadow-lg",
                                                    theme === 'dark'
                                                        ? "bg-black/50 border-white/10 hover:border-amber-400/40 hover:bg-black/70"
                                                        : "bg-white border-slate-200 hover:border-amber-400/60 hover:bg-slate-50"
                                                )}
                                                title={isPatternOne ? t('timeline.dissipation_to_post') : t('timeline.post_to_dissipation')}
                                            >
                                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mr-0.5">START</span>
                                                <div className="flex items-center gap-0.5">
                                                    <div className={clsx(
                                                        "w-5 h-5 rounded-md overflow-hidden transition-all duration-300 ring-1",
                                                        isPatternOne
                                                            ? "ring-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                                                            : "ring-white/10 opacity-60"
                                                    )}>
                                                        <img src="/icons/Dissipation.png" alt="転化" className="w-full h-full object-contain" />
                                                    </div>
                                                </div>
                                                <div className="w-[1px] h-3.5 bg-slate-900/ dark:bg-white/ mx-0.5" />
                                                <div className="flex items-center gap-0.5">
                                                    <div className={clsx(
                                                        "w-5 h-5 rounded-md overflow-hidden transition-all duration-300 ring-1",
                                                        !isPatternOne
                                                            ? "ring-cyan-400/60 shadow-[0_0_8px_rgba(34,211,238,0.3)]"
                                                            : "ring-white/10 opacity-60"
                                                    )}>
                                                        <img src="/icons/Aetherflow.png" alt="AF" className="w-full h-full object-contain" />
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                            <button
                                onClick={() => useMitigationStore.getState().undo()}
                                disabled={useMitigationStore.getState()._history.length === 0}
                                className={clsx(
                                    "p-1 rounded transition-all duration-150 cursor-pointer",
                                    useMitigationStore.getState()._history.length > 0
                                        ? "text-slate-400 hover:bg-white/10 hover:text-white"
                                        : "text-slate-700 cursor-default"
                                )}
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo2 size={12} />
                            </button>
                            <button
                                onClick={() => useMitigationStore.getState().redo()}
                                disabled={useMitigationStore.getState()._future.length === 0}
                                className={clsx(
                                    "p-1 rounded transition-all duration-150 cursor-pointer",
                                    useMitigationStore.getState()._future.length > 0
                                        ? "text-slate-400 hover:bg-white/10 hover:text-white"
                                        : "text-slate-700 cursor-default"
                                )}
                                title="Redo (Ctrl+Shift+Z)"
                            >
                                <Redo2 size={12} />
                            </button>
                            <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                            <div className="relative">
                                <button
                                    onClick={() => setClearMenuOpen(!clearMenuOpen)}
                                    className="flex items-center gap-0.5 p-1 rounded transition-all duration-150 cursor-pointer text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                                    title="Clear Mitigations"
                                >
                                    <Trash2 size={12} />
                                    <ChevronDown size={7} />
                                </button>
                                {clearMenuOpen && (
                                    <div className="absolute top-full right-0 mt-1 min-w-[180px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-xl shadow-2xl z-[200] py-1">
                                        <button
                                            onClick={() => {
                                                setClearMenuOpen(false);
                                                setConfirmDialog({
                                                    title: t('timeline.clear_all'),
                                                    message: t('timeline.clear_all_confirm'),
                                                    variant: 'danger',
                                                    onConfirm: () => {
                                                        useMitigationStore.getState().clearAllMitigations();
                                                        setConfirmDialog(null);
                                                    },
                                                });
                                            }}
                                            className="w-full text-left px-3 py-2 text-[11px] font-bold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                        >
                                            <Trash2 size={12} />
                                            全ての軽減を削除
                                        </button>
                                        <div className="h-[1px] bg-slate-200/50 dark:bg-white/5 my-1" />
                                        <div className="px-3 py-1 text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wider">
                                            メンバー別に削除
                                        </div>
                                        {partyMembers.map(m => {
                                            const job = JOBS.find(j => j.id === m.jobId);
                                            const count = timelineMitigations.filter(mit => mit.ownerId === m.id).length;
                                            if (!job || count === 0) return null;
                                            return (
                                                <button
                                                    key={m.id}
                                                    onClick={() => {
                                                        setClearMenuOpen(false);
                                                        setConfirmDialog({
                                                            title: t('timeline.clear_member', { member: m.id }).replace('{{member}}', m.id),
                                                            message: t('timeline.clear_member_confirm', { member: m.id, job: contentLanguage === 'en' ? job.name.en : job.name.ja }).replace('{{member}}', m.id).replace('{{job}}', contentLanguage === 'en' ? job.name.en : job.name.ja),
                                                            variant: 'danger',
                                                            onConfirm: () => {
                                                                useMitigationStore.getState().clearMitigationsByMember(m.id);
                                                                setConfirmDialog(null);
                                                            },
                                                        });
                                                    }}
                                                    className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
                                                >
                                                    <img src={job.icon} alt={contentLanguage === 'en' ? job.name.en : job.name.ja} className="w-4 h-4 rounded" />
                                                    <span className="font-medium">{m.id}</span>
                                                    <span className="text-slate-400 dark:text-slate-500">({contentLanguage === 'en' ? job.name.en : job.name.ja})</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div
                        ref={headerRef}
                        className={clsx(
                            "flex-shrink-0 z-50 bg-glass-header backdrop-blur-xl border-b border-glass-border text-[11px] font-barlow font-medium text-app-text-muted uppercase tracking-wider text-center h-10 shadow-glass select-none overflow-hidden"
                        )}
                    >
                        <div className="flex items-center h-full w-full md:w-max md:min-w-full">
                            <div className="w-[30px] min-w-[30px] md:w-[100px] md:min-w-[100px] md:max-w-[100px] flex-none border-r border-white/5 h-full flex items-center justify-center text-app-accent-secondary/80 font-bold bg-transparent text-[8px] md:text-[11px]">
                                PH
                            </div>
                            <div className="w-[40px] min-w-[40px] md:w-[70px] md:min-w-[70px] md:max-w-[70px] flex-none border-r border-white/5 h-full flex items-center justify-center bg-transparent text-slate-700 dark:text-app-text-muted/70 font-bold text-[8px] md:text-[10px]">TIME</div>
                            <div className="flex-1 md:flex-none md:w-[200px] md:min-w-[200px] md:max-w-[200px] border-r border-white/5 h-full flex items-center bg-transparent text-slate-700 dark:text-app-text-muted/70 text-[9px] md:text-[10px] pl-2 justify-start font-bold">MECHANIC</div>
                            <div className="w-[45px] min-w-[45px] md:w-[100px] md:min-w-[100px] md:max-w-[100px] flex-none border-r border-white/5 h-full flex items-center justify-center bg-transparent text-slate-700 dark:text-app-text-muted/70 text-[8px] md:text-[10px] font-bold">RAW</div>
                            <div className="w-[45px] min-w-[45px] md:w-[100px] md:min-w-[100px] md:max-w-[100px] flex-none border-r border-white/5 h-full flex items-center justify-center bg-transparent text-slate-700 dark:text-app-text-muted/70 text-[8px] md:text-[10px] font-bold">TAKEN</div>

                            {sortedPartyMembers.map((member, index) => (
                                <div
                                    key={member.id}
                                    style={{ width: `${getColumnWidth(member.role)}px`, minWidth: `${getColumnWidth(member.role)}px`, maxWidth: `${getColumnWidth(member.role)}px` }}
                                    className={clsx(
                                        "hidden md:flex flex-none border-r border-white/5 h-full flex-col items-center justify-center p-0.5 relative group",
                                        index === sortedPartyMembers.length - 1 && "rounded-tr-2xl border-r-0",
                                        partySortOrder === 'role' ? (
                                            member.role === 'tank' ? "bg-gradient-to-b from-blue-600/20 via-blue-600/5 to-transparent shadow-[inset_0_1px_0_rgba(37,99,235,0.5)]" :
                                                member.role === 'healer' ? "bg-gradient-to-b from-green-500/20 via-green-500/5 to-transparent shadow-[inset_0_1px_0_rgba(34,197,94,0.5)]" :
                                                    "bg-gradient-to-b from-red-500/20 via-red-500/5 to-transparent shadow-[inset_0_1px_0_rgba(239,68,68,0.5)]"
                                        ) : (
                                            ['MT', 'H1', 'D1', 'D3'].includes(member.id)
                                                ? "bg-gradient-to-b from-cyan-500/20 via-blue-500/5 to-transparent shadow-[inset_0_1px_0_rgba(6,182,212,0.5)]"
                                                : "bg-gradient-to-b from-amber-500/20 via-orange-500/5 to-transparent shadow-[inset_0_1px_0_rgba(245,158,11,0.5)]"
                                        )
                                    )}
                                >
                                    <div
                                        className={clsx(
                                            "flex items-center justify-center w-full h-full rounded cursor-pointer hover:bg-slate-900/ dark:hover:bg-white/ transition-all duration-300 relative"
                                        )}
                                        onClick={(e) => handleJobIconClick(member.id, e)}
                                        title={`${member.id} (${t('ui.change_job')})`}
                                    >
                                        {member.jobId ? (
                                            <img src={getJobIcon(member.jobId) || ''} alt={member.jobId} className="w-6 h-6 object-contain opacity-90 drop-shadow-sm transition-transform hover:scale-110" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border border-white/10 bg-slate-900/ dark:bg-white/ flex items-center justify-center hover:bg-slate-900/ dark:hover:bg-white/ transition-colors">
                                                <Plus size={10} className="text-app-text-muted" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto relative" ref={scrollContainerRef} onScroll={handleScrollSync}>
                        <div className="relative bg-transparent md:w-max md:min-w-full" style={{
                            height: `${(() => {
                                let totalHeight = 0;
                                let maxPopulatedTime = -11;
                                if (hideEmptyRows) {
                                    timelineEvents.forEach(e => { if (e.time > maxPopulatedTime) maxPopulatedTime = e.time; });
                                    timelineMitigations.forEach(m => { if (m.time > maxPopulatedTime) maxPopulatedTime = m.time; });
                                }

                                gridLines.forEach(time => {
                                    const rowEvents = eventsByTime.get(time) || [];
                                    const hasEvents = rowEvents.length > 0;
                                    const hasMitigationStart = timelineMitigations.some(m => m.time === time);

                                    const isBottomEmptyRow = hideEmptyRows && time === maxPopulatedTime + 1;

                                    if (!hideEmptyRows || hasEvents || hasMitigationStart || isBottomEmptyRow) {
                                        totalHeight += pixelsPerSecond;
                                    }
                                });
                                return `calc(${totalHeight}px + 70vh)`;
                            })()}`
                        }}>
                            {(() => {
                                const renderItems: React.ReactElement[] = [];
                                let currentY = 0;
                                let maxPopulatedTime = -11;
                                if (hideEmptyRows) {
                                    timelineEvents.forEach(e => { if (e.time > maxPopulatedTime) maxPopulatedTime = e.time; });
                                    timelineMitigations.forEach(m => { if (m.time > maxPopulatedTime) maxPopulatedTime = m.time; });
                                }

                                const timeToYMap = new Map<number, number>();

                                // 🚀 Performance Optimization: Pre-calculate mitigations map
                                const mitigationsByTime = new Map<number, AppliedMitigation[]>();
                                const mitStartsByTime = new Map<number, boolean>();
                                timelineMitigations.forEach(mit => {
                                    mitStartsByTime.set(mit.time, true);
                                    for (let t = mit.time; t < mit.time + mit.duration; t++) {
                                        if (!mitigationsByTime.has(t)) mitigationsByTime.set(t, []);
                                        mitigationsByTime.get(t)!.push(mit);
                                    }
                                });

                                gridLines.forEach((time) => {
                                    const rowEvents = eventsByTime.get(time) || [];
                                    const rowDamages = rowEvents.map(event => damageMap.get(event.id) || null);

                                    const hasEvents = rowEvents.length > 0;
                                    const activeMitigationsForRow = mitigationsByTime.get(time) || [];
                                    const hasMitigationStart = mitStartsByTime.has(time);

                                    const isBottomEmptyRow = hideEmptyRows && time === maxPopulatedTime + 1;

                                    if (hideEmptyRows && !hasEvents && !hasMitigationStart && !isBottomEmptyRow) {
                                        timeToYMap.set(time, currentY);
                                        return;
                                    }

                                    timeToYMap.set(time, currentY);

                                    renderItems.push(
                                        <TimelineRow
                                            key={time}
                                            time={time}
                                            top={currentY}
                                            damages={rowDamages}
                                            events={rowEvents}
                                            partyMembers={sortedPartyMembers}
                                            activeMitigations={activeMitigationsForRow} // 👈 Added prop
                                            onPhaseAdd={handlePhaseAdd}
                                            onAddEventClick={handleAddClick}
                                            onEventClick={handleEventClick}
                                            onCellClick={handleCellClick}
                                            onDamageClick={handleDamageClick}
                                            onMobileDamageClick={handleMobileDamageClick}
                                        />
                                    );

                                    currentY += pixelsPerSecond;
                                });

                                timeToYMapRef.current = timeToYMap;

                                return (
                                    <>
                                        {renderItems}

                                        {phases.map((phase, index) => {
                                            if (!showPreStart && phase.endTime <= 0) return null;

                                            const offsetTime = showPreStart ? -10 : 0;
                                            const startTime = index === 0 ? -10 : phases[index - 1].endTime;
                                            const endTime = phase.endTime;

                                            if (!showPreStart && endTime <= 0) return null;

                                            const effectiveStartTime = Math.max(startTime, offsetTime);
                                            const effectiveEndTime = Math.max(endTime, offsetTime);

                                            const startY = timeToYMap.get(effectiveStartTime) ?? (Math.max(0, effectiveStartTime - offsetTime) * pixelsPerSecond);
                                            const endY = timeToYMap.get(effectiveEndTime) ?? (Math.max(0, effectiveEndTime - offsetTime) * pixelsPerSecond);

                                            const top = startY;
                                            const height = Math.max(0, endY - startY);

                                            return (
                                                <div
                                                    key={phase.id}
                                                    className="absolute left-0 w-[100px] border-r border-white/20 bg-slate-900/40 dark:bg-white/5 flex items-center justify-center text-sm font-bold text-slate-100 cursor-pointer hover:bg-slate-900/60 dark:hover:bg-white/10 transition-colors pointer-events-auto z-10 backdrop-blur-sm shadow-[inset_4px_0_0_0_rgba(255,255,255,0.2)]"
                                                    style={{ top: `${top}px`, height: `${height}px` }}
                                                    onClick={(e) => handlePhaseEdit(phase.id, phase.name, e)}
                                                    title={t('timeline.click_rename', 'クリックして名前を変更')}
                                                >
                                                    <div className="transform -rotate-90 whitespace-nowrap overflow-hidden text-ellipsis px-2 drop-shadow-md">
                                                        {phase.name}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {(() => {
                                            const visibleMitigations = timelineMitigations.filter(m =>
                                                showPreStart || (m.time + m.duration > 0)
                                            );

                                            const mitigationsByOwner: Record<string, typeof timelineMitigations> = {};

                                            visibleMitigations.forEach(m => {
                                                if (!mitigationsByOwner[m.ownerId]) mitigationsByOwner[m.ownerId] = [];
                                                mitigationsByOwner[m.ownerId].push(m);
                                            });

                                            const renderedItems: React.ReactElement[] = [];

                                            Object.entries(mitigationsByOwner).forEach(([, ownerMitigations]) => {
                                                const getRecast = (mitigationId: string): number => {
                                                    const def = MITIGATIONS.find((m: any) => m.id === mitigationId);
                                                    return def ? (def.recast || def.recast || 999) : 999;
                                                };

                                                ownerMitigations.sort((a, b) => {
                                                    const rA = getRecast(a.mitigationId);
                                                    const rB = getRecast(b.mitigationId);
                                                    if (rA !== rB) return rA - rB;
                                                    if (a.time !== b.time) return a.time - b.time;
                                                    return a.mitigationId.localeCompare(b.mitigationId);
                                                });

                                                const PLACEMENT_STEP = 12;
                                                const FULL_LANE_WIDTH = 24;
                                                const HALF_LANE_WIDTH = 12;
                                                const member = partyMembers.find(m => m.id === ownerMitigations[0]?.ownerId);
                                                const layout = memberLayout.get(ownerMitigations[0]?.ownerId);
                                                const colStart = layout ? layout.left : 0;
                                                const colWidth = (member?.role === 'tank' || member?.role === 'healer') ? 120 : 60;
                                                const MAX_LEFT = colWidth - 24;

                                                const assignedPositions: { m: typeof timelineMitigations[0], left: number }[] = [];

                                                ownerMitigations.forEach(mitigation => {
                                                    const timeOverlaps = assignedPositions.filter(a =>
                                                        (a.m.time < mitigation.time + mitigation.duration) &&
                                                        (a.m.time + a.m.duration > mitigation.time)
                                                    );

                                                    let candidateLeft = 0;
                                                    while (candidateLeft <= MAX_LEFT) {
                                                        const hasCollision = timeOverlaps.some(a => {
                                                            const isSameTime = a.m.time === mitigation.time;
                                                            const threshold = isSameTime ? FULL_LANE_WIDTH : HALF_LANE_WIDTH;
                                                            return Math.abs(a.left - candidateLeft) < threshold;
                                                        });
                                                        if (!hasCollision) break;
                                                        candidateLeft += PLACEMENT_STEP;
                                                    }

                                                    if (candidateLeft > MAX_LEFT) {
                                                        candidateLeft = MAX_LEFT;
                                                    }

                                                    assignedPositions.push({ m: mitigation, left: candidateLeft });

                                                    const offsetTime = showPreStart ? -10 : 0;

                                                    const durationSeconds = Math.max(1, mitigation.duration);
                                                    const durationEndTime = mitigation.time + durationSeconds - 1;
                                                    const startY = timeToYMap.get(mitigation.time) ?? (Math.max(0, mitigation.time - offsetTime) * pixelsPerSecond);

                                                    const gridKeys = Array.from(timeToYMap.keys());
                                                    const maxGridTime = gridKeys.length > 0 ? Math.max(...gridKeys) : 0;
                                                    const maxGridY = timeToYMap.get(maxGridTime) ?? 0;
                                                    const getMappedY = (t: number) => {
                                                        if (timeToYMap.has(t)) return timeToYMap.get(t)!;
                                                        if (t > maxGridTime) return maxGridY + (t - maxGridTime) * pixelsPerSecond;
                                                        return Math.max(0, t - offsetTime) * pixelsPerSecond;
                                                    };

                                                    const endY = getMappedY(durationEndTime) + 24;

                                                    const def = MITIGATIONS.find((m: any) => m.id === mitigation.mitigationId);
                                                    const recast = def?.recast || def?.recast || 0;
                                                    const recastEndTime = mitigation.time + Math.max(1, recast) - 1;
                                                    const recastEndY = getMappedY(recastEndTime) + 24;
                                                    const calculatedRecastHeight = Math.max(0, recastEndY - startY);

                                                    const top = startY;
                                                    const height = Math.max(0, Math.round(endY - startY));

                                                    const absoluteLeft = colStart + 2 + candidateLeft;

                                                    renderedItems.push(
                                                        <MitigationItem
                                                            key={mitigation.id}
                                                            mitigation={mitigation}
                                                            pixelsPerSecond={pixelsPerSecond}
                                                            onRemove={removeMitigation}
                                                            onUpdateTime={updateMitigationTime}
                                                            top={top}
                                                            height={height}
                                                            recastHeight={calculatedRecastHeight}
                                                            left={absoluteLeft}
                                                            laneIndex={candidateLeft / PLACEMENT_STEP}
                                                            partySortOrder={partySortOrder}
                                                            offsetTime={offsetTime}
                                                            scrollContainerRef={scrollContainerRef}
                                                            activeMitigations={ownerMitigations}
                                                            schAetherflowPattern={schAetherflowPatterns[mitigation.ownerId] ?? 1}
                                                            overlapOffset={0}
                                                            timeToYMap={timeToYMap} /* 👈 追加：マップを渡す */
                                                        />
                                                    );
                                                });
                                            });

                                            return renderedItems;
                                        })()}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div >

            {clipboardEvent && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[5000] bg-blue-600/90 text-white px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200 border border-blue-400/50">
                    <div className="flex items-center gap-2">
                        <span className="text-xl drop-shadow-md">📋</span>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight drop-shadow-md">
                                {clipboardEvent.name ? (contentLanguage === 'en' ? clipboardEvent.name.en : clipboardEvent.name.ja) : 'イベント'} {t('timeline.copying')}
                            </span>
                            <span className="text-[10px] text-blue-100/90 leading-tight">
                                {t('timeline.paste_hint')}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => setClipboardEvent(null)}
                        className="ml-3 bg-black/20 hover:bg-black/40 p-1.5 rounded-full transition-colors cursor-pointer"
                        title={t('timeline.cancel_copy')}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <EventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
                initialData={selectedEvent}
                initialTime={selectedTime}
                position={eventModalPosition}
            />

            <PhaseModal
                isOpen={isPhaseModalOpen}
                isEdit={!!selectedPhase}
                initialName={selectedPhase?.name || ''}
                initialTime={selectedPhaseTime}
                onClose={() => setIsPhaseModalOpen(false)}
                onSave={handlePhaseSave}
                onDelete={selectedPhase ? handlePhaseDelete : undefined}
                position={phaseModalPosition}
            />

            {mobileMitiFlow.isOpen && (
                <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }))}>
                    <div className={clsx(
                        "rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col transition-all duration-200",
                        theme === 'dark' ? "bg-slate-900 border border-white/10" : "bg-white border border-slate-200"
                    )} onClick={e => e.stopPropagation()}>
                        <div className={clsx(
                            "p-4 border-b flex justify-between items-center transition-colors",
                            theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50/50"
                        )}>
                            <h3 className={clsx(
                                "font-bold text-sm tracking-wider transition-colors",
                                theme === 'dark' ? "text-white" : "text-slate-800"
                            )}>
                                {mobileMitiFlow.step === 'job' ? '誰の軽減を追加しますか？' : '追加する軽減を選択'}
                            </h3>
                            <button onClick={() => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }))} className="text-slate-400 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {mobileMitiFlow.step === 'job' && (
                                <div className="grid grid-cols-4 gap-3">
                                    {partyMembers.map(m => {
                                        const job = JOBS.find(j => j.id === m.jobId);
                                        if (!job) return null;
                                        return (
                                            <button key={m.id} onClick={() => setMobileMitiFlow(prev => ({ ...prev, step: 'skill', selectedMemberId: m.id }))} className={clsx(
                                                "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all active:scale-95",
                                                theme === 'dark' ? "bg-white/5 border-white/10 active:bg-blue-500/30" : "bg-slate-50 border-slate-200 active:bg-blue-100"
                                            )}>
                                                <img src={job.icon} className="w-8 h-8 object-contain drop-shadow-md" />
                                                <span className={clsx(
                                                    "text-[10px] font-bold transition-colors",
                                                    theme === 'dark' ? "text-slate-300" : "text-slate-600"
                                                )}>{m.id}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            {mobileMitiFlow.step === 'skill' && (
                                <div className="grid grid-cols-4 gap-3">
                                    {(() => {
                                        const member = partyMembers.find(m => m.id === mobileMitiFlow.selectedMemberId);
                                        const job = JOBS.find(j => j.id === member?.jobId);
                                        if (!member || !job) return null;

                                        const availableMitis = MITIGATIONS.filter(m => {
                                            if (m.jobId === job.id) return true;
                                            return false;
                                        });

                                        return availableMitis.map(mit => {
                                            const memberMitis = timelineMitigations.filter(m => m.ownerId === member.id);
                                            const isAlreadyPlaced = memberMitis.some(am => am.mitigationId === mit.id && am.time === mobileMitiFlow.time);
                                            const status = validateMitigationPlacement(
                                                mit,
                                                mobileMitiFlow.time,
                                                memberMitis,
                                                schAetherflowPatterns[member.id] ?? 1,
                                                t
                                            );
                                            const isClickable = status.available || isAlreadyPlaced;

                                            return (
                                                <button
                                                    key={mit.id}
                                                    disabled={!isClickable}
                                                    onClick={() => {
                                                        if (isAlreadyPlaced) {
                                                            const amToRemove = memberMitis.find(am => am.mitigationId === mit.id && am.time === mobileMitiFlow.time);
                                                            if (amToRemove) removeMitigation(amToRemove.id);
                                                            setMobileMitiFlow(prev => ({ ...prev, isOpen: false }));
                                                            return;
                                                        }

                                                        if (!status.available) {
                                                            alert(status.message || 'このタイミングには配置できません（リキャスト等）');
                                                            return;
                                                        }

                                                        addMitigation({
                                                            id: genId(),
                                                            mitigationId: mit.id,
                                                            time: mobileMitiFlow.time,
                                                            duration: mit.duration,
                                                            ownerId: member.id,
                                                        });
                                                        setMobileMitiFlow(prev => ({ ...prev, isOpen: false }));
                                                    }}
                                                    className={clsx(
                                                        "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all relative overflow-hidden",
                                                        isAlreadyPlaced
                                                            ? "bg-red-500/20 border-red-500/50 active:bg-red-500/40"
                                                            : status.available
                                                                ? theme === 'dark' ? "bg-white/5 border-white/10 active:bg-blue-500/30" : "bg-slate-50 border-slate-200 active:bg-blue-100"
                                                                : "bg-black/40 border-transparent opacity-40"
                                                    )}
                                                >
                                                    <div className="relative">
                                                        <img src={mit.icon} className={clsx("w-8 h-8 object-contain rounded drop-shadow-md", isAlreadyPlaced ? "ring-2 ring-red-500 ring-offset-1 ring-offset-transparent" : "opacity-90")} />
                                                        {isAlreadyPlaced && (
                                                            <div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5">
                                                                <X size={10} className="text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-300 truncate w-full text-center leading-tight">{contentLanguage === 'en' ? mit.name.en : mit.name.ja}</span>
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            )}
                        </div>
                        {mobileMitiFlow.step === 'skill' && (
                            <div className={clsx(
                                "p-3 border-t transition-colors",
                                theme === 'dark' ? "border-white/5 bg-black/40" : "border-slate-100 bg-slate-50"
                            )}>
                                <button onClick={() => setMobileMitiFlow(prev => ({ ...prev, step: 'job' }))} className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-bold px-3 py-1.5 flex items-center gap-1 transition-colors">
                                    ← メンバー選択に戻る
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <MitigationSelector
                isOpen={mitigationSelectorOpen}
                onClose={() => setMitigationSelectorOpen(false)}
                onSelect={handleMitigationSelect}
                jobId={selectedMemberId ? partyMembers.find(m => m.id === selectedMemberId)?.jobId || null : null}
                position={selectorPosition}
                activeMitigations={timelineMitigations.filter(m => m.ownerId === selectedMemberId)}
                selectedTime={selectedMitigationTime}
                schAetherflowPattern={(schAetherflowPatterns[selectedMemberId!] ?? 1)}
            />

            <JobPicker
                isOpen={jobPickerOpen}
                onClose={() => setJobPickerOpen(false)}
                onSelect={handleJobSelect}
                position={jobPickerPosition}
                currentJobId={jobPickerMemberId ? partyMembers.find(m => m.id === jobPickerMemberId)?.jobId || null : null}
            />

            <PartySettingsModal
                isOpen={partySettingsOpen}
                onClose={() => setPartySettingsOpen(false)}
            />

            <FFLogsImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
            />

            {
                migrationConfig && (
                    <JobMigrationModal
                        isOpen={migrationConfig.isOpen}
                        onConfirm={handleMigrationConfirm}
                        onCancel={handleMigrationCancel}
                        oldJob={JOBS.find(j => j.id === migrationConfig.oldJobId) || JOBS[0]}
                        newJob={JOBS.find(j => j.id === migrationConfig.newJobId) || JOBS[0]}
                        memberName={partyMembers.find(m => m.id === migrationConfig.memberId)?.id || ''}
                    />
                )
            }

            <ConfirmDialog
                isOpen={confirmDialog !== null}
                title={confirmDialog?.title ?? ''}
                message={confirmDialog?.message ?? ''}
                variant={confirmDialog?.variant ?? 'danger'}
                onConfirm={() => confirmDialog?.onConfirm?.()}
                onCancel={() => setConfirmDialog(null)}
                confirmLabel="実行"
                cancelLabel="キャンセル"
            />
            <MobileBottomSheet
                isOpen={mobileToolsSheetOpen}
                onClose={() => setMobileToolsSheetOpen(false)}
                title="ツール"
                height="55vh"
            >
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const store = useMitigationStore.getState();
                                store.setHideEmptyRows(!store.hideEmptyRows);
                            }}
                            className={clsx(
                                "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer",
                                useMitigationStore.getState().hideEmptyRows
                                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                                    : theme === 'dark'
                                        ? "bg-white/5 border-white/10 text-slate-400"
                                        : "bg-slate-50 border-slate-200 text-slate-500"
                            )}
                        >
                            <AlignJustify size={16} />
                            <span className="text-xs font-bold">COMPACT</span>
                        </button>
                        <button
                            onClick={() => useMitigationStore.getState().undo()}
                            disabled={useMitigationStore.getState()._history.length === 0}
                            className={clsx(
                                "px-3 py-2.5 rounded-xl border transition-colors cursor-pointer",
                                theme === 'dark' ? "bg-white/5 border-white/10 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                            )}
                        >
                            <Undo2 size={16} />
                        </button>
                        <button
                            onClick={() => useMitigationStore.getState().redo()}
                            disabled={useMitigationStore.getState()._future.length === 0}
                            className={clsx(
                                "px-3 py-2.5 rounded-xl border transition-colors cursor-pointer",
                                theme === 'dark' ? "bg-white/5 border-white/10 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                            )}
                        >
                            <Redo2 size={16} />
                        </button>
                    </div>

                    <div className={clsx(
                        "h-px transition-colors",
                        theme === 'dark' ? "bg-white/10" : "bg-slate-100"
                    )} />

                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            setImportModalOpen(true);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-colors cursor-pointer"
                    >
                        <CloudDownload size={20} />
                        <div className="text-left">
                            <div className="text-sm font-bold">FFLogs Import</div>
                            <div className="text-[10px] text-blue-600/70 dark:text-blue-400/70">FFLogsからタイムラインをインポート</div>
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            handleAutoPlan();
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30 transition-colors cursor-pointer"
                    >
                        <Sparkles size={20} />
                        <div className="text-left">
                            <div className="text-sm font-bold">Auto Plan</div>
                            <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">軽減を自動配置</div>
                        </div>
                    </button>
                </div>
            </MobileBottomSheet>
        </>
    );
};

export default Timeline;