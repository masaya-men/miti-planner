import React, { useState, useMemo, useEffect, useRef, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { TimelineRow } from './TimelineRow';

import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';
import { useThemeStore } from '../store/useThemeStore';
import type { TimelineEvent, Mitigation, AppliedMitigation } from '../types';
import { EventModal } from './EventModal';
import { ClearMitigationsPopover } from './ClearMitigationsPopover';
import { PhaseModal } from './PhaseModal';

import { MitigationSelector } from './MitigationSelector';
import { JobPicker } from './JobPicker';
import { PartySettingsModal } from './PartySettingsModal';
import { JobMigrationModal } from './JobMigrationModal';
import { migrateMitigations } from '../utils/jobMigration';
import { AASettingsPopover } from './AASettingsPopover';
import {
    Pencil, Trash2, Plus, X, Undo2, Redo2, AlignJustify, CloudDownload, Sparkles, Settings, Sword, ChevronDown
} from 'lucide-react';
import { JOBS, MITIGATIONS } from '../data/mockData';
import clsx from 'clsx';
import { generateAutoPlan } from '../utils/autoPlanner';
import { FFLogsImportModal } from './FFLogsImportModal';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { getColumnWidth } from '../utils/calculator';
import { ConfirmDialog } from './ConfirmDialog';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { Tooltip } from './ui/Tooltip';
import { MobileBottomSheet } from './MobileBottomSheet';

function genId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id_' + Math.random().toString(36).substring(2, 9);
}


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
    timeToYMap: Map<number, number>;
    isVirtual?: boolean;
    iconOverride?: string;
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
        scrollContainerRef, activeMitigations, schAetherflowPattern, overlapOffset = 0, recastHeight, timeToYMap,
        isVirtual = false, iconOverride
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
        if (dragStartRef.current || isVirtual) return;
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
        if (e.button !== 0 || isVirtual) return;
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

    const getEffectiveIcon = () => {
        if (iconOverride) return iconOverride;
        if (!def) return "/icons/Placeholder.png";

        // アーサリースターの動的変化判定 (設置後10秒で変化)
        if (def.id === 'earthly_star') {
            // タイムライン上の表示位置（selectedTimeではない、個別のアイテム位置）
            // ここでは簡易的に現在の配置時間からの経過で判定するロジックを想定
            // シミュレーターとして「10秒後の位置」を特定するのは描画ロジックに依存するため
            // 配置されたオブジェクト自体は1つのため、アイコン1つを表示する
            // ユーザー要望: 10秒後に巨星へ。表示を分ける場合は別ロジックだが
            // ここでは「配置したスターが10s経過位置にあるか」ではなく「スター自体」を表示
        }

        // 学者: サモン・セラフィム中のアイコン置換
        const isSeraphActive = activeMitigations.some(am =>
            am.mitigationId === 'summon_seraph' &&
            am.ownerId === mitigation.ownerId &&
            mitigation.time >= am.time &&
            mitigation.time < am.time + am.duration
        );

        if (isSeraphActive) {
            if (def.id === 'whispering_dawn') return "/icons/Angel's_Whisper.png";
            if (def.id === 'fey_illumination') return "/icons/Seraphic_Illumination.png";
        }

        return def.icon;
    };

    const iconUrl = getEffectiveIcon();
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
                        "rounded shadow-md relative z-20 flex items-center justify-center",
                        "w-6 h-6",
                        !isVirtual && "cursor-grab hover:scale-110 pointer-events-auto",
                        isVirtual && "cursor-default pointer-events-none",
                        myJobHighlight && myMemberId && myMemberId !== mitigation.ownerId && "opacity-40 grayscale"
                    )}
                    onContextMenu={handleContextMenu}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                >
                    <Tooltip content={`${nameStr || t('timeline.mitigation')} ${mitigation.targetId ? `(→ ${mitigation.targetId})` : ''} ${t('timeline.mitigation_drag_hint')}`} wrapperClassName="w-full h-full">
                        <div className={clsx(
                            "w-full h-full bg-black/50 overflow-hidden rounded border border-app-border flex items-center justify-center",
                            isVirtual && "bg-transparent border-none shadow-none"
                        )}>
                            <img
                                src={iconUrl}
                                alt=""
                                className={clsx(
                                    "object-contain",
                                    isVirtual ? (
                                        (iconUrl.includes('Giant_Dominance.png') || iconUrl.includes('horoscope_helios.png'))
                                            ? "w-3 h-auto"
                                            : "w-5 h-5"
                                    ) : "w-full h-full rounded"
                                )}
                            />
                        </div>
                    </Tooltip>

                    {!isVirtual && mitigation.targetId && (() => {
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
                        "absolute top-3 w-1.5 z-10 rounded-b-sm border-x pointer-events-none",
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
                            "absolute w-0 border-l-[2px] border-dotted border-app-border z-0 pointer-events-none",
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

const Timeline: React.FC = () => {
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();
    const {
        mobilePartyOpen, setMobilePartyOpen,
        mobileToolsOpen, setMobileToolsOpen,
    } = useContext(MobileTriggersContext);

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
        changeMemberJobWithMitigations,
        clipboardEvent,
        setClipboardEvent,
        hideEmptyRows,
        timelineSortOrder: partySortOrder,
    } = useMitigationStore();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
    const [selectedTime, setSelectedTime] = useState<number>(0);
    const [eventModalPosition, setEventModalPosition] = useState({ x: 0, y: 0 });
    const [eventPopover, setEventPopover] = useState<{ event: TimelineEvent; position: { x: number; y: number } } | null>(null);

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

    const [migrationConfig, setMigrationConfig] = useState<{
        isOpen: boolean;
        memberId: string;
        oldJobId: string;
        newJobId: string;
    } | null>(null);

    const pixelsPerSecond = 50;
    const fightDuration = 1200;

    const handleAutoPlan = useCallback(() => {
        const executePlan = () => {
            const { timelineEvents, partyMembers, currentLevel } = useMitigationStore.getState();
            const result = generateAutoPlan(timelineEvents, partyMembers, currentLevel);
            useMitigationStore.getState().applyAutoPlan(result);
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
    }, [t]);

    // Consolidated Header Event Listeners
    useEffect(() => {
        const handleAutoPlanEvent = () => handleAutoPlan();
        const handleImportEvent = () => setImportModalOpen(true);
        window.addEventListener('timeline:autoplan', handleAutoPlanEvent);
        window.addEventListener('timeline:import', handleImportEvent);
        return () => {
            window.removeEventListener('timeline:autoplan', handleAutoPlanEvent);
            window.removeEventListener('timeline:import', handleImportEvent);
        };
    }, [handleAutoPlan]);

    const [partySettingsOpen, setPartySettingsOpen] = useState(false);

    // Tutorial auto-open logic
    const { isActive: tutorialActive, currentStepIndex: tutorialStepIndex } = useTutorialStore();
    useEffect(() => {
        if (tutorialActive && tutorialStepIndex === 0) {
            setIsAaModeEnabled(false);
            setAaSettingsOpen(false);
        }
    }, [tutorialActive, tutorialStepIndex]);

    useEffect(() => {
        if (tutorialActive && TUTORIAL_STEPS[tutorialStepIndex]?.id === 'party-slots' && !partySettingsOpen) {
            setPartySettingsOpen(true);
        }
    }, [tutorialActive, tutorialStepIndex, partySettingsOpen]);

    useEffect(() => {
        if (mobilePartyOpen) {
            setPartySettingsOpen(true);
            setMobilePartyOpen(false);
            useTutorialStore.getState().completeEvent('party-settings:opened');
        }
    }, [mobilePartyOpen]);
    useEffect(() => {
        if (mobilePartyOpen) {
            setPartySettingsOpen(true);
            setMobilePartyOpen(false);
            useTutorialStore.getState().completeEvent('party-settings:opened');
        }
    }, [mobilePartyOpen]);

    // チュートリアル戻るボタン用: ストアからモーダル制御するカスタムイベント
    useEffect(() => {
        const handleCloseAll = () => {
            setPartySettingsOpen(false);
            setMitigationSelectorOpen(false);
            setIsModalOpen(false);
        };
        const handleOpenParty = () => {
            setPartySettingsOpen(true);
        };
        window.addEventListener('tutorial:close-all-modals', handleCloseAll);
        window.addEventListener('tutorial:open-party-modal', handleOpenParty);
        return () => {
            window.removeEventListener('tutorial:close-all-modals', handleCloseAll);
            window.removeEventListener('tutorial:open-party-modal', handleOpenParty);
        };
    }, []);

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
    const controlBarRef = useRef<HTMLDivElement>(null);
    const schBarRef = useRef<HTMLDivElement>(null);
    const timeToYMapRef = useRef(new Map<number, number>());

    const handleScrollSync = () => {
        if (!scrollContainerRef.current) return;
        const scrollLeft = scrollContainerRef.current.scrollLeft;

        // Use transform for more reliable sync across different content widths
        const containers = [
            { ref: headerRef, id: 'timeline-header-inner' },
            { ref: controlBarRef, id: 'timeline-controls-inner' },
            { ref: schBarRef, id: 'timeline-sch-inner' }
        ];

        containers.forEach(({ ref, id }) => {
            if (ref.current) {
                const inner = ref.current.querySelector(`#${id}`) as HTMLElement;
                if (inner) {
                    inner.style.transform = `translateX(-${scrollLeft}px)`;
                } else if (ref.current.firstElementChild) {
                    (ref.current.firstElementChild as HTMLElement).style.transform = `translateX(-${scrollLeft}px)`;
                }
            }
        });
    };

    useEffect(() => {
        const syncPadding = () => {
            if (scrollContainerRef.current && headerRef.current) {
                const scrollbarWidth = scrollContainerRef.current.offsetWidth - scrollContainerRef.current.clientWidth;
                headerRef.current.style.paddingRight = `${scrollbarWidth}px`;
                if (controlBarRef.current) controlBarRef.current.style.paddingRight = `${scrollbarWidth}px`;
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
        useTutorialStore.getState().completeEvent('tutorial:opened-add-event-modal');
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

        setEventPopover({ event, position: { x: e.clientX, y: e.clientY } });
    };

    const handlePopoverEdit = () => {
        if (!eventPopover) return;
        const { event, position } = eventPopover;
        setEventPopover(null);
        setEventModalPosition(position);
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const handlePopoverAdd = () => {
        if (!eventPopover) return;
        const { event, position } = eventPopover;
        setEventPopover(null);
        setEventModalPosition(position);
        setSelectedTime(event.time);
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handlePopoverDelete = () => {
        if (!eventPopover) return;
        const event = eventPopover.event;
        setEventPopover(null);
        setConfirmDialog({
            title: t('timeline.event_delete'),
            message: t('timeline.delete_event_confirm'),
            variant: 'danger',
            onConfirm: () => {
                removeEvent(event.id);
                setConfirmDialog(null);
            },
        });
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
            setConfirmDialog({
                title: t('timeline.event_delete'),
                message: t('timeline.delete_event_confirm'),
                variant: 'danger',
                onConfirm: () => {
                    removeEvent(selectedEvent.id);
                    setIsModalOpen(false);
                    setConfirmDialog(null);
                },
            });
        }
    };

    const handleCellClick = (memberId: string, time: number, e: React.MouseEvent) => {
        const member = partyMembers.find(m => m.id === memberId);
        if (!member || !member.jobId) return;

        setSelectorPosition({ x: e.clientX, y: e.clientY });
        setSelectedMemberId(memberId);
        setSelectedMitigationTime(time);
        setMitigationSelectorOpen(true);
        useTutorialStore.getState().completeEvent('tutorial:opened-miti-selector');
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
        useTutorialStore.getState().completeEvent('tutorial:opened-miti-selector');
    };

    const handleMitigationSelect = (mitigation: Mitigation & { _targetId?: string }) => {
        if (!selectedMemberId) return;

        addMitigation({
            id: genId(),
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

    type MigrationMode = 'inherit' | 'common_only' | 'reset';
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
        const map = new Map<string, { unmitigated: number; mitigated: number, mitigationPercent: number, shieldTotal: number, isInvincible?: boolean, mitigationStates?: Record<string, { stacks?: number }> }>();
        const sortedEvents = [...timelineEvents].sort((a, b) => a.time - b.time);
        const shieldStates = new Map<string, Map<string, number>>();
        const stackStates = new Map<string, Map<string, number>>(); // 🚀 Added for Haima/Panhaima

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

        // 🚀 Helper to manage stack states
        const getStackState = (context: string, instanceId: string, maxStacks: number) => {
            if (!stackStates.has(context)) {
                stackStates.set(context, new Map());
            }
            const contextMap = stackStates.get(context)!;
            if (!contextMap.has(instanceId)) {
                contextMap.set(instanceId, maxStacks);
            }
            return contextMap.get(instanceId)!;
        };

        const updateStackState = (context: string, instanceId: string, newValue: number) => {
            if (!stackStates.has(context)) {
                stackStates.set(context, new Map());
            }
            stackStates.get(context)!.set(instanceId, newValue);
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
            let isInvincibleForEvent = false;
            const eventMitigationStates: Record<string, { stacks?: number }> = {}; // 🚀 Store per-event mitigation states

            const activeMitigations = timelineMitigations.filter(m =>
                m.time <= event.time && event.time < m.time + m.duration
            );

            activeMitigations.forEach(appMit => {
                const def = MITIGATIONS.find(m => m.id === appMit.mitigationId);
                if (!def) return;

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

                let burstMultiplier = 1;
                if (def.burstValue && def.burstDuration && event.time < appMit.time + def.burstDuration) {
                    burstMultiplier = (1 - def.burstValue / 100);
                }

                const multiplier = (1 - mitigationValue / 100) * burstMultiplier;
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
                            // Self-only healing increase (e.g. Dissipation, Neutral Sect) only applies to the caster's own heals
                            if (bDef.healingIncreaseSelfOnly && buff.ownerId !== appMit.ownerId) return;
                            healingMultiplier += (bDef.healingIncrease / 100);
                        }
                    });

                    const localizedName = contentLanguage === 'en' ? def.name.en : def.name.ja;
                    let maxValBase = member.computedValues[localizedName] || 0;

                    if ((def.id === 'helios_conjunction' || def.id === 'aspected_helios') && isConditionalShield) {
                        maxValBase = member.computedValues[`${def.name.en} (Neutral)`] || member.computedValues[`${def.name.ja} (Nセクト)`] || 0;
                    }

                    const maxVal = Math.floor(maxValBase * healingMultiplier);

                    // 🚀 Handle stacks (Haima/Panhaima)
                    affectedContexts.forEach(ctx => {
                        let shieldRemaining = getShieldState(ctx, appMit.id, maxVal);
                        let stacksRemaining = def.stacks !== undefined ? getStackState(ctx, appMit.id, def.stacks) : undefined;

                        if (shieldRemaining > 0) {
                            const absorbed = Math.min(shieldRemaining, damageForShields);
                            const isBroken = absorbed >= shieldRemaining;

                            let finalShield = shieldRemaining - absorbed;
                            let finalStacks = stacksRemaining;

                            // 🚨 仕様修正：1回の着弾で複数スタックを一気に消費しない
                            if (isBroken && finalStacks !== undefined && finalStacks > 0 && def.reapplyOnAbsorption) {
                                finalStacks -= 1;
                                finalShield = maxVal; // 貼り直されたので次は新品
                            }

                            updateShieldState(ctx, appMit.id, finalShield);
                            if (finalStacks !== undefined) updateStackState(ctx, appMit.id, finalStacks);

                            if (ctx === displayContext) {
                                displayShieldTotal += shieldRemaining;
                                eventMitigationStates[appMit.id] = { stacks: finalStacks };
                                currentDamage = Math.max(0, currentDamage - absorbed);
                            }
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
                isInvincible: isInvincibleForEvent,
                mitigationStates: eventMitigationStates // 🚀 Store for UI
            });
        });

        return map;
    }, [eventsByTime, timelineMitigations, partyMembers]);

    const [clearMenuOpen, setClearMenuOpen] = useState(false);
    const clearMenuButtonRef = useRef<HTMLButtonElement>(null);

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
        const handleReset = () => {
            setIsAaModeEnabled(false);
        };
        window.addEventListener('tutorial:reset-ui', handleReset);
        return () => {
            window.removeEventListener('tutorial:reset-ui', handleReset);
        };
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
            {/* ── Main Content Column ── */}
            <div className="flex flex-col h-full w-full bg-transparent pb-16 md:pb-0 overflow-hidden relative z-[1]">
                <div className="absolute inset-0 pointer-events-none"></div>

                <div className={clsx(
                    "relative flex-1 flex flex-col pt-0 glass-panel overflow-hidden shadow-sm border transition-all duration-300 ease-out",
                    "border-app-border h-full z-[1]",
                    "mx-2 md:mx-6 mt-2 md:mt-4 mb-2 rounded-xl"
                )}>
                    <div
                        ref={controlBarRef}
                        className={clsx(
                            "flex-shrink-0 z-[51] h-7 relative border-b select-none overflow-hidden",
                            "bg-app-surface2 border-app-border"
                        )}
                    >
                        <div id="timeline-controls-inner" className="flex items-center gap-0 shrink-0 h-full w-full md:w-max md:min-w-max will-change-transform">
                            {/* Area A: PHASE(100) + TIME(70) = 170px */}
                            <div className="w-[30px] min-w-[30px] md:w-[170px] md:min-w-[170px] flex-none flex items-center px-1 md:px-2">
                                <button
                                    onClick={() => useMitigationStore.getState().setHideEmptyRows(!useMitigationStore.getState().hideEmptyRows)}
                                    className={clsx(
                                        "flex items-center justify-center gap-2 px-1 md:px-3 py-0.5 my-auto rounded-md text-[10px] font-black transition-all duration-300 group/btn cursor-pointer relative overflow-hidden h-6 w-full",
                                        hideEmptyRows
                                            ? "bg-app-text text-app-bg"
                                            : "text-app-text"
                                    )}
                                >
                                    <AlignJustify
                                        size={14}
                                        className={clsx(
                                            "transition-all duration-300 group-hover/btn:scale-110 shrink-0",
                                            hideEmptyRows
                                                ? ""
                                                : ""
                                        )}
                                    />
                                    <span className={clsx(
                                        "uppercase tracking-wider hidden md:block",
                                        hideEmptyRows
                                            ? ""
                                            : ""
                                    )}>
                                        {t('ui.compact_view')}
                                    </span>
                                </button>
                            </div>

                            {/* Area B: MECHANIC(200) */}
                            <div className="flex-1 md:flex-none md:w-[200px] md:min-w-[200px] flex items-center px-1 md:px-2">
                                <div className={clsx(
                                    "flex items-center gap-0 relative rounded-md transition-all duration-300 overflow-hidden h-6 w-full",
                                    isAaModeEnabled && "bg-app-text/10"
                                )}>
                                    <button
                                        onClick={() => setIsAaModeEnabled(!isAaModeEnabled)}
                                        className={clsx(
                                            "flex-1 flex items-center justify-center gap-2 px-2 md:px-3 h-full transition-all duration-300 group/btn cursor-pointer",
                                            isAaModeEnabled
                                                ? "text-app-accent"
                                                : "text-app-text"
                                        )}
                                    >
                                        <Sword size={14} className={clsx("transition-transform duration-300 group-hover/btn:scale-110 shrink-0", isAaModeEnabled ? "text-app-text" : "")} />
                                        <span className="font-black text-[10px] uppercase tracking-wider hidden md:block">{t('aa_settings.title')}</span>
                                    </button>
                                    <div className={clsx(
                                        "h-3 w-[1px]",
                                        isAaModeEnabled ? "bg-app-accent/40" : "bg-app-border"
                                    )} />
                                    <button
                                        ref={aaSettingsButtonRef}
                                        onClick={() => setAaSettingsOpen(!aaSettingsOpen)}
                                        className={clsx(
                                            "px-2 h-full transition-all duration-300 cursor-pointer flex items-center justify-center group/opt",
                                            isAaModeEnabled
                                                ? "text-app-accent hover:text-app-accent/70"
                                                : "text-app-text"
                                        )}
                                    >
                                        <Settings size={12} className="transition-transform duration-300 group-hover/opt:rotate-45" />
                                    </button>
                                </div>
                                <AASettingsPopover
                                    isOpen={aaSettingsOpen}
                                    onClose={() => setAaSettingsOpen(false)}
                                    settings={aaSettings}
                                    onSettingsChange={setAaSettings}
                                    triggerRef={aaSettingsButtonRef}
                                />
                            </div>

                            {/* Area C: Remaining (RAW/TAKEN/Columns) */}
                            <div className="flex-none md:w-[200px] md:min-w-[200px] flex items-center gap-0.5 border-l border-app-border pl-2 h-full">
                                <Tooltip content={t('timeline.undo')}>
                                    <button
                                        onClick={() => useMitigationStore.getState().undo()}
                                        disabled={useMitigationStore.getState()._history.length === 0}
                                        className={clsx(
                                            "p-1 rounded transition-all duration-150 cursor-pointer",
                                            useMitigationStore.getState()._history.length > 0
                                                ? "text-app-text hover:bg-app-surface2"
                                                : "text-app-text-muted cursor-default"
                                        )}
                                    >
                                        <Undo2 size={12} />
                                    </button>
                                </Tooltip>
                                <Tooltip content={t('timeline.redo')}>
                                    <button
                                        onClick={() => useMitigationStore.getState().redo()}
                                        disabled={useMitigationStore.getState()._future.length === 0}
                                        className={clsx(
                                            "p-1 rounded transition-all duration-150 cursor-pointer",
                                            useMitigationStore.getState()._future.length > 0
                                                ? "text-app-text hover:bg-app-surface2"
                                                : "text-app-text-muted cursor-default"
                                        )}
                                    >
                                        <Redo2 size={12} />
                                    </button>
                                </Tooltip>
                                <div className="w-[1px] h-3 bg-app-border mx-0.5" />
                                <div className="relative">
                                    <Tooltip content={t('timeline.clear_mitigations')}>
                                        <button
                                            ref={clearMenuButtonRef}
                                            onClick={() => setClearMenuOpen(!clearMenuOpen)}
                                            className="flex items-center gap-0.5 p-1 rounded transition-all duration-150 cursor-pointer text-app-text hover:bg-red-500/10 hover:text-red-400"
                                        >
                                            <Trash2 size={12} />
                                            <ChevronDown size={7} />
                                        </button>
                                    </Tooltip>
                                    {clearMenuOpen && (
                                        <ClearMitigationsPopover
                                            isOpen={clearMenuOpen}
                                            onClose={() => setClearMenuOpen(false)}
                                            triggerRef={clearMenuButtonRef}
                                            partyMembers={partyMembers}
                                            timelineMitigations={timelineMitigations}
                                            contentLanguage={contentLanguage}
                                            setConfirmDialog={setConfirmDialog}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        ref={schBarRef}
                        className="pointer-events-none absolute left-0 right-0 h-7 z-[51] overflow-hidden"
                    >
                        <div id="timeline-sch-inner" className="relative h-full w-full md:w-max md:min-w-max will-change-transform">
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
                                            <Tooltip content={isPatternOne ? t('timeline.dissipation_to_post') : t('timeline.post_to_dissipation')} position="bottom" wrapperClassName="pointer-events-auto">
                                            <button
                                                onClick={() => setSchAetherflowPattern(member.id, isPatternOne ? 2 : 1)}
                                                className={clsx(
                                                    "flex items-center gap-1 px-2.5 py-0.5 rounded-full border transition-all duration-300 cursor-pointer group shadow-lg pointer-events-auto",
                                                    "bg-app-surface border-app-border hover:border-app-text hover:bg-app-surface2"
                                                )}
                                            >
                                                <span className="text-[8px] font-bold text-app-text-muted uppercase tracking-widest mr-0.5">{t('common.start', 'START')}</span>
                                                <div className="flex items-center gap-0.5">
                                                    <div className={clsx(
                                                        "w-5 h-5 rounded-md overflow-hidden transition-all duration-300 ring-1",
                                                        isPatternOne
                                                            ? "ring-app-text/60"
                                                            : "ring-white/10 opacity-60"
                                                    )}>
                                                        <img src="/icons/Dissipation.png" alt={t('mitigation.dissipation', 'Dissipation')} className="w-full h-full object-contain" />
                                                    </div>
                                                </div>
                                                <div className="w-[1px] h-3.5 bg-app-border mx-0.5" />
                                                <div className="flex items-center gap-0.5">
                                                    <div className={clsx(
                                                        "w-5 h-5 rounded-md overflow-hidden transition-all duration-300 ring-1",
                                                        !isPatternOne
                                                            ? "ring-app-text/60"
                                                            : "ring-white/10 opacity-60"
                                                    )}>
                                                        <img src="/icons/Aetherflow.png" alt={t('mitigation.aetherflow', 'Aetherflow')} className="w-full h-full object-contain" />
                                                    </div>
                                                </div>
                                            </button>
                                            </Tooltip>
                                        </div>
                                    );
                                });
                            })()}
                        </div>


                    </div>

                    <div
                        ref={headerRef}
                        className={clsx(
                            "flex-shrink-0 z-50 bg-glass-header border-b border-glass-border text-[11px] font-barlow font-medium text-app-text uppercase tracking-wider text-center h-10 select-none overflow-hidden"
                        )}
                    >
                        <div id="timeline-header-inner" className="flex items-center h-full w-full md:w-max md:min-w-max will-change-transform">
                            <div className="w-[30px] min-w-[30px] md:w-[100px] md:min-w-[100px] md:max-w-[100px] flex-none border-r border-app-border h-full flex items-center justify-center text-app-accent font-black bg-transparent text-[8px] md:text-[11px]">
                                {t('timeline.header_phase')}
                            </div>
                            <div className="w-[40px] min-w-[40px] md:w-[70px] md:min-w-[70px] md:max-w-[70px] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text font-black text-[8px] md:text-[10px]">{t('timeline.header_time')}</div>
                            <div className="flex-1 md:flex-none md:w-[200px] md:min-w-[200px] md:max-w-[200px] border-r border-app-border h-full flex items-center bg-transparent text-app-text text-[9px] md:text-[10px] pl-2 justify-start font-black">{t('timeline.header_mechanic')}</div>
                            <div className="w-[45px] min-w-[45px] md:w-[100px] md:min-w-[100px] md:max-w-[100px] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text text-[8px] md:text-[10px] font-black">{t('timeline.header_raw')}</div>
                            <div className="w-[45px] min-w-[45px] md:w-[100px] md:min-w-[100px] md:max-w-[100px] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text text-[8px] md:text-[10px] font-black">{t('timeline.header_taken')}</div>

                            {sortedPartyMembers.map((member, index) => (
                                <div
                                    key={member.id}
                                    style={{ width: `${getColumnWidth(member.role)}px`, minWidth: `${getColumnWidth(member.role)}px`, maxWidth: `${getColumnWidth(member.role)}px` }}
                                    className={clsx(
                                        "hidden md:flex flex-none border-r border-app-border h-full flex-col items-center justify-center p-0.5 relative group",
                                        index === sortedPartyMembers.length - 1 && "rounded-tr-2xl border-r-0",
                                        partySortOrder === 'role' ? (
                                            member.role === 'tank' ? "bg-gradient-to-b from-blue-600/20 via-blue-600/5 to-transparent shadow-[inset_0_1px_0_rgba(37,99,235,0.5)]" :
                                                member.role === 'healer' ? "bg-gradient-to-b from-green-500/20 via-green-500/5 to-transparent shadow-[inset_0_1px_0_rgba(34,197,94,0.5)]" :
                                                    "bg-gradient-to-b from-red-500/20 via-red-500/5 to-transparent shadow-[inset_0_1px_0_rgba(239,68,68,0.5)]"
                                        ) : (
                                            ['MT', 'H1', 'D1', 'D3'].includes(member.id)
                                                ? "bg-gradient-to-b from-blue-500/20 via-blue-600/5 to-transparent shadow-[inset_0_1px_0_rgba(59,130,246,0.5)]"
                                                : "bg-gradient-to-b from-cyan-500/20 via-cyan-600/5 to-transparent shadow-[inset_0_1px_0_rgba(6,182,212,0.5)]"
                                        )
                                    )}
                                >
                                    <Tooltip content={`${member.id} (${t('ui.change_job')})`} position="bottom" wrapperClassName="w-full h-full">
                                        <div
                                            className={clsx(
                                                "flex items-center justify-center w-full h-full rounded cursor-pointer hover:bg-app-surface2 transition-all duration-300 relative"
                                            )}
                                            onClick={(e) => handleJobIconClick(member.id, e)}
                                        >
                                            {member.jobId ? (
                                                <img src={getJobIcon(member.jobId) || ''} alt={member.jobId} className="w-6 h-6 object-contain opacity-90 drop-shadow-sm transition-transform hover:scale-110" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border border-app-border bg-app-surface2 flex items-center justify-center hover:bg-app-surface2">
                                                    <Plus size={10} className="text-app-text-muted" />
                                                </div>
                                            )}
                                        </div>
                                    </Tooltip>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div
                        ref={scrollContainerRef}
                        className="timeline-scroll-container flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto relative custom-scrollbar bg-white dark:bg-[var(--color-bg-primary)]  duration-200"
                        onScroll={handleScrollSync}
                    >
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
                                            const startTime = index === 0 ? 0 : phases[index - 1].endTime;
                                            const endTime = phase.endTime;

                                            if (!showPreStart && endTime <= 0) return null;

                                            const effectiveStartTime = Math.max(startTime, offsetTime);
                                            const effectiveEndTime = Math.max(endTime, offsetTime);

                                            const startY = timeToYMap.get(effectiveStartTime) ?? (Math.max(0, effectiveStartTime - offsetTime) * pixelsPerSecond);
                                            const top = startY;
                                            const height = Math.max(0, (timeToYMap.get(effectiveEndTime) ?? (Math.max(0, effectiveEndTime - offsetTime) * pixelsPerSecond)) - startY);

                                            return (
                                                <div
                                                    key={phase.id}
                                                    className="absolute left-0 w-[30px] md:w-[100px] border-r border-b border-app-border bg-app-surface2 cursor-pointer hover:bg-app-surface2 pointer-events-auto z-10"
                                                    style={{ top: `${top}px`, height: `${height}px` }}
                                                    onClick={(e) => handlePhaseEdit(phase.id, phase.name, e)}
                                                >
                                                    <Tooltip content={t('timeline.click_rename', 'クリックして名前を変更')} position="right" wrapperClassName="sticky top-0 w-full">
                                                        <div className="w-full h-[100px] md:h-[150px] flex items-center justify-center pt-4 md:pt-6">
                                                            <div className="transform -rotate-90 overflow-visible px-2 drop-shadow-md origin-center flex flex-col items-center gap-0.5">
                                                                <span className="whitespace-nowrap text-[10px] md:text-sm font-bold text-app-text leading-none">
                                                                    {phase.name.split('\n')[0]}
                                                                </span>
                                                                {phase.name.split('\n')[1] && (
                                                                    <span className="whitespace-nowrap text-[8px] md:text-[10px] font-medium text-blue-700/70 dark:text-app-text/70 leading-none">
                                                                        {phase.name.split('\n')[1]}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Tooltip>
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

                                                const displayItems: any[] = [];
                                                ownerMitigations.forEach(m => {
                                                    const def = MITIGATIONS.find((d: any) => d.id === m.mitigationId);
                                                    displayItems.push({ ...m, isVirtual: false, parentId: null });

                                                    if (def?.id === 'horoscope') {
                                                        const heliosEvents = ownerMitigations.filter((am: any) =>
                                                            (am.mitigationId === 'aspected_helios' || am.mitigationId === 'helios_conjunction') &&
                                                            am.ownerId === m.ownerId &&
                                                            am.time >= m.time &&
                                                            am.time < m.time + m.duration
                                                        );
                                                        heliosEvents.forEach(he => {
                                                            const displayTime = he.time + 1;
                                                            displayItems.push({
                                                                ...he,
                                                                id: `virtual-horo-${he.id}`,
                                                                time: displayTime,
                                                                duration: 29,
                                                                mitigationId: m.mitigationId,
                                                                isVirtual: true,
                                                                iconOverride: "/icons/horoscope_helios.png",
                                                                parentId: m.id
                                                            });
                                                        });
                                                    }
                                                    if (def?.id === 'earthly_star') {
                                                        const giantTime = m.time + 10;
                                                        if (giantTime < m.time + m.duration) {
                                                            displayItems.push({
                                                                ...m,
                                                                id: `virtual-giant-${m.id}`,
                                                                time: giantTime,
                                                                duration: m.duration - 10,
                                                                isVirtual: true,
                                                                iconOverride: "/icons/Giant_Dominance.png",
                                                                parentId: m.id
                                                            });
                                                        }
                                                    }
                                                });

                                                displayItems.sort((a, b) => {
                                                    if (a.time === b.time) {
                                                        const isA_Base = a.mitigationId === 'horoscope' || a.mitigationId === 'earthly_star';
                                                        const isB_Base = b.mitigationId === 'horoscope' || b.mitigationId === 'earthly_star';
                                                        if (isA_Base && !isB_Base) return -1;
                                                        if (!isA_Base && isB_Base) return 1;
                                                    }
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

                                                const assignedPositions: { m: any, left: number }[] = [];

                                                displayItems.forEach(mitigation => {
                                                    const timeOverlaps = assignedPositions.filter(a =>
                                                        (a.m.time < mitigation.time + mitigation.duration) &&
                                                        (a.m.time + a.m.duration > mitigation.time)
                                                    );

                                                    let candidateLeft = 0;
                                                    if (mitigation.isVirtual) {
                                                        const parentPos = assignedPositions.find(a => a.m.id === mitigation.parentId);
                                                        if (parentPos) {
                                                            candidateLeft = parentPos.left;
                                                        }
                                                    } else {
                                                        while (candidateLeft <= MAX_LEFT) {
                                                            const hasCollision = timeOverlaps.some(a => {
                                                                if (a.m.isVirtual && a.m.parentId === mitigation.id) return false;
                                                                const isSameTime = Math.abs(a.m.time - mitigation.time) < 1;
                                                                const threshold = isSameTime ? FULL_LANE_WIDTH : HALF_LANE_WIDTH;
                                                                return Math.abs(a.left - candidateLeft) < threshold;
                                                            });
                                                            if (!hasCollision) break;
                                                            candidateLeft += PLACEMENT_STEP;
                                                        }
                                                    }

                                                    if (candidateLeft > MAX_LEFT) candidateLeft = MAX_LEFT;

                                                    assignedPositions.push({ m: mitigation, left: candidateLeft });

                                                    const offsetTime = showPreStart ? -10 : 0;
                                                    const durationSeconds = Math.max(1, mitigation.duration);
                                                    const durationEndTime = mitigation.time + durationSeconds - 1;

                                                    const getMappedY = (t: number) => {
                                                        if (timeToYMap.has(t)) return timeToYMap.get(t)!;
                                                        const gridKeys = Array.from(timeToYMap.keys());
                                                        const maxGridTime = gridKeys.length > 0 ? Math.max(...gridKeys) : 0;
                                                        const maxGridY = timeToYMap.get(maxGridTime) ?? 0;
                                                        if (t > maxGridTime) return maxGridY + (t - maxGridTime) * pixelsPerSecond;
                                                        return Math.max(0, t - offsetTime) * pixelsPerSecond;
                                                    };

                                                    const startY = getMappedY(mitigation.time);
                                                    const endY = getMappedY(durationEndTime) + 24;
                                                    const def = MITIGATIONS.find((m: any) => m.id === mitigation.mitigationId);
                                                    const recast = def?.recast || def?.recast || 0;
                                                    const recastEndTime = mitigation.time + Math.max(1, recast) - 1;
                                                    const recastEndY = getMappedY(recastEndTime) + 24;
                                                    const calculatedRecastHeight = Math.max(0, recastEndY - startY);

                                                    const top = startY;
                                                    let height = Math.max(0, Math.round(endY - startY));

                                                    if (!mitigation.isVirtual) {
                                                        if (def?.id === 'horoscope') {
                                                            const heliosInHoro = displayItems.filter((am: any) =>
                                                                am.isVirtual && am.parentId === mitigation.id
                                                            ).sort((a: any, b: any) => a.time - b.time);
                                                            if (heliosInHoro.length > 0) {
                                                                const cutY = getMappedY(heliosInHoro[0].time);
                                                                height = Math.max(0, Math.round(cutY - startY) - 8);
                                                            }
                                                        }
                                                        if (def?.id === 'earthly_star' && durationSeconds > 10) {
                                                            const cutY = getMappedY(mitigation.time + 10);
                                                            height = Math.max(0, Math.round(cutY - startY) - 8);
                                                        }
                                                    }

                                                    const absoluteLeft = colStart + 2 + candidateLeft;

                                                    renderedItems.push(
                                                        <MitigationItem
                                                            key={mitigation.id}
                                                            mitigation={mitigation}
                                                            pixelsPerSecond={pixelsPerSecond}
                                                            onRemove={mitigation.isVirtual ? () => { } : removeMitigation}
                                                            onUpdateTime={mitigation.isVirtual ? () => { } : updateMitigationTime}
                                                            top={top}
                                                            height={height}
                                                            recastHeight={mitigation.isVirtual ? 0 : calculatedRecastHeight}
                                                            left={absoluteLeft}
                                                            laneIndex={candidateLeft / PLACEMENT_STEP}
                                                            partySortOrder={partySortOrder}
                                                            offsetTime={offsetTime}
                                                            scrollContainerRef={scrollContainerRef}
                                                            activeMitigations={ownerMitigations}
                                                            schAetherflowPattern={schAetherflowPatterns[mitigation.ownerId] ?? 1}
                                                            overlapOffset={0}
                                                            timeToYMap={timeToYMap}
                                                            isVirtual={mitigation.isVirtual}
                                                            iconOverride={mitigation.iconOverride}
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
            </div>

            {clipboardEvent && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[5000] bg-app-text text-app-bg px-5 py-2.5 rounded-full shadow-sm flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200 border border-app-text">
                    <div className="flex items-center gap-2">
                        <span className="text-xl drop-shadow-md">📋</span>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight drop-shadow-md">
                                {clipboardEvent.name ? (contentLanguage === 'en' ? clipboardEvent.name.en : clipboardEvent.name.ja) : 'イベント'} {t('timeline.copying')}
                            </span>
                            <span className="text-[10px] text-app-bg/70 leading-tight">
                                {t('timeline.paste_hint')}
                            </span>
                        </div>
                    </div>
                    <Tooltip content={t('timeline.cancel_copy')}>
                        <button
                            onClick={() => setClipboardEvent(null)}
                            className="ml-3 bg-black/20 hover:bg-black/40 p-1.5 rounded-full  cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </Tooltip>
                </div>
            )
            }

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

            {
                mobileMitiFlow.isOpen && (
                    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }))}>
                        <div className={clsx(
                            "rounded-2xl w-full max-w-sm shadow-sm overflow-hidden flex flex-col transition-all duration-200",
                            "bg-app-surface border border-app-border"
                        )} onClick={e => e.stopPropagation()}>
                            <div className={clsx(
                                "p-4 border-b flex justify-between items-center ",
                                "border-app-border bg-app-surface2"
                            )}>
                                <h3 className={clsx(
                                    "font-bold text-sm tracking-wider ",
                                    "text-slate-800 dark:text-white"
                                )}>
                                    {mobileMitiFlow.step === 'job' ? t('timeline.select_member') : t('timeline.select_mitigation')}
                                </h3>
                                <button onClick={() => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }))} className="text-app-text p-1.5 bg-app-surface2 hover:bg-app-surface2 rounded-lg ">
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
                                                    "bg-app-surface2 border-app-border active:bg-app-text/10"
                                                )}>
                                                    <img src={job.icon} className="w-8 h-8 object-contain drop-shadow-md" />
                                                    <span className={clsx(
                                                        "text-[10px] font-bold ",
                                                        "text-app-text"
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
                                                                    ? "bg-app-surface2 border-app-border active:bg-app-text/10"
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
                                                        <span className="text-[9px] font-bold text-app-text truncate w-full text-center leading-tight">{contentLanguage === 'en' ? mit.name.en : mit.name.ja}</span>
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>
                            {mobileMitiFlow.step === 'skill' && (
                                <div className={clsx(
                                    "p-3 border-t ",
                                    "border-app-border bg-app-surface2"
                                )}>
                                    <button onClick={() => setMobileMitiFlow(prev => ({ ...prev, step: 'job' }))} className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-bold px-3 py-1.5 flex items-center gap-1 ">
                                        ← メンバー選択に戻る
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            <MitigationSelector
                isOpen={mitigationSelectorOpen}
                onClose={() => setMitigationSelectorOpen(false)}
                onSelect={handleMitigationSelect}
                onRemove={removeMitigation}
                ownerId={selectedMemberId}
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
                                "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border  cursor-pointer",
                                useMitigationStore.getState().hideEmptyRows
                                    ? "bg-app-text/15 border-app-text text-app-text"
                                    : "bg-app-surface2 border-app-border text-app-text"
                            )}
                        >
                            <AlignJustify size={16} />
                            <span className="text-xs font-bold">COMPACT</span>
                        </button>
                        <button
                            onClick={() => useMitigationStore.getState().undo()}
                            disabled={useMitigationStore.getState()._history.length === 0}
                            className={clsx(
                                "px-3 py-2.5 rounded-xl border  cursor-pointer",
                                "bg-app-surface2 border-app-border text-app-text"
                            )}
                        >
                            <Undo2 size={16} />
                        </button>
                        <button
                            onClick={() => useMitigationStore.getState().redo()}
                            disabled={useMitigationStore.getState()._future.length === 0}
                            className={clsx(
                                "px-3 py-2.5 rounded-xl border  cursor-pointer",
                                "bg-app-surface2 border-app-border text-app-text"
                            )}
                        >
                            <Redo2 size={16} />
                        </button>
                    </div>

                    <div className={clsx(
                        "h-px ",
                        "bg-app-border"
                    )} />

                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            setImportModalOpen(true);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-app-text/5 border border-app-border text-app-text hover:bg-app-text/10 cursor-pointer"
                    >
                        <CloudDownload size={20} />
                        <div className="text-left">
                            <div className="text-sm font-bold">FFLogs Import</div>
                            <div className="text-[10px] text-app-text-muted">FFLogsからタイムラインをインポート</div>
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            handleAutoPlan();
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-app-text/5 border border-app-border text-app-text hover:bg-app-text/10 cursor-pointer"
                    >
                        <Sparkles size={20} />
                        <div className="text-left">
                            <div className="text-sm font-bold">Auto Plan</div>
                            <div className="text-[10px] text-app-text-muted">軽減を自動配置</div>
                        </div>
                    </button>
                </div>
            </MobileBottomSheet>
            {eventPopover && createPortal(
                <div
                    className="fixed inset-0 z-[9998]"
                    onClick={() => setEventPopover(null)}
                >
                    <div
                        className={clsx(
                            "absolute min-w-[200px] rounded-xl py-1.5 glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]"
                        )}
                        style={{
                            left: Math.min(eventPopover.position.x, window.innerWidth - 220),
                            top: Math.min(eventPopover.position.y, window.innerHeight - 160),
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={handlePopoverEdit}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                                "text-app-text hover:bg-app-surface2"
                            )}
                        >
                            <Pencil size={15} className="text-blue-500 dark:text-blue-400 shrink-0" />
                            <span>{t('timeline.event_edit')}</span>
                        </button>
                        <button
                            onClick={handlePopoverAdd}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                                "text-app-text hover:bg-app-surface2"
                            )}
                        >
                            <Plus size={15} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                            <span>{t('timeline.event_add_here')}</span>
                        </button>
                        <div className={clsx("h-px mx-3 my-1", "bg-app-border")} />
                        <button
                            onClick={handlePopoverDelete}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                                "text-red-500 hover:bg-red-50/80 dark:text-red-400 dark:hover:bg-red-500/10"
                            )}
                        >
                            <Trash2 size={15} className="shrink-0" />
                            <span>{t('timeline.event_delete')}</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default Timeline;