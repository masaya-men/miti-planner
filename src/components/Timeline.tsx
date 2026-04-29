import React, { useState, useMemo, useEffect, useRef, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { TimelineRow } from './TimelineRow';
import { MobileTimelineRow } from './MobileTimelineRow';
import { MobileContextMenu } from './MobileContextMenu';

import { useMitigationStore } from '../store/useMitigationStore';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/usePlanStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { useThemeStore } from '../store/useThemeStore';
import type { TimelineEvent, Mitigation, AppliedMitigation, LocalizedString, Phase, Label } from '../types';
import { getPhaseName } from '../types';
import { EventModal } from './EventModal';
import { ClearMitigationsPopover } from './ClearMitigationsPopover';
import { BoundaryEditModal } from './BoundaryEditModal';

import { MitigationSelector } from './MitigationSelector';
import { JobPicker } from './JobPicker';
import { PartySettingsModal } from './PartySettingsModal';
import { JobMigrationModal } from './JobMigrationModal';
import { migrateMitigations } from '../utils/jobMigration';
import { AASettingsPopover } from './AASettingsPopover';
import {
    Pencil, Trash2, Plus, X, Undo2, Redo2, AlignJustify, CloudDownload, Sparkles, Sword, ChevronDown, Rows3, Settings, Crosshair, PictureInPicture2
} from 'lucide-react';
const PipView = React.lazy(() => import('./PipView'));
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import clsx from 'clsx';
import { PARTY_MEMBER_IDS, PARTY_MEMBER_ORDER } from '../constants/party';
import { generateAutoPlan } from '../utils/autoPlanner';
import { FFLogsImportModal } from './FFLogsImportModal';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { getColumnWidth, calculateLinkedShieldValue, CRIT_MULTIPLIER } from '../utils/calculator';
import { ConfirmDialog } from './ConfirmDialog';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import { Tooltip } from './ui/Tooltip';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MitigationSheet } from './MitigationSheet';
import { HeaderPhaseDropdown } from './HeaderPhaseDropdown';
import { HeaderGimmickDropdown } from './HeaderGimmickDropdown';
import { HeaderTimeInput } from './HeaderTimeInput';
import { HeaderMechanicSearch } from './HeaderMechanicSearch';

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

const MitigationItem: React.FC<MitigationItemProps> = React.memo((props) => {
    const {
        mitigation, pixelsPerSecond, onRemove, onUpdateTime,
        top, height, left, partySortOrder, offsetTime,
        scrollContainerRef, activeMitigations, overlapOffset = 0, recastHeight, timeToYMap,
        isVirtual = false, iconOverride
    } = props;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { t } = useTranslation();

    const { contentLanguage } = useThemeStore();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();
    const dragStartRef = useRef<{ pointerY: number; scrollTop: number } | null>(null);
    const autoScrollRef = useRef<number | null>(null);
    const lastPointerYRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const timeLabelRef = useRef<HTMLDivElement>(null);

    const { myJobHighlight, myMemberId, hideEmptyRows, conflictingMitigationId } = useMitigationStore(
        useShallow(s => ({ myJobHighlight: s.myJobHighlight, myMemberId: s.myMemberId, hideEmptyRows: s.hideEmptyRows, conflictingMitigationId: s.conflictingMitigationId }))
    );
    const isConflicting = conflictingMitigationId === mitigation.id;

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

    const [toastMessage, setToastMessage] = useState<string | null>(null);

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
            const status = validateMitigationPlacement(def, newTime, activeMitigations, t, mitigation.id);

            if (status.available) {
                resetDragPosition(false);
                onUpdateTime(mitigation.id, newTime);
            } else {
                setToastMessage(t('timeline.cannot_place_here'));
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
    const nameStr = def ? getPhaseName(def.name, contentLanguage) : '';

    return (
        <>
            {toastMessage && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[5000] bg-red-600 text-white px-5 py-2.5 rounded-full shadow-sm flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-200 pointer-events-none">
                    <span className="text-app-2xl font-bold">{toastMessage}</span>
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
                    className="absolute pointer-events-none text-app-base font-mono text-sky-300 bg-black/70 px-1 rounded"
                    style={{ display: 'none', left: '28px', zIndex: 100 }}
                />
                <div
                    className={clsx(
                        "rounded shadow-md relative z-20 flex items-center justify-center",
                        "w-6 h-6",
                        !isVirtual && "cursor-grab hover:scale-110 pointer-events-auto",
                        isVirtual && "cursor-default pointer-events-none",
                        myJobHighlight && myMemberId && myMemberId !== mitigation.ownerId && "opacity-40 grayscale",
                        isConflicting && "animate-conflict-pulse ring-2 ring-amber-400"
                    )}
                    onContextMenu={(e) => {
                        if (isConflicting) useMitigationStore.getState().setConflictingMitigationId(null);
                        handleContextMenu(e);
                    }}
                    onPointerDown={(e) => {
                        if (isConflicting) useMitigationStore.getState().setConflictingMitigationId(null);
                        handlePointerDown(e);
                    }}
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
                                    <img src={targetJob.icon} alt={getPhaseName(targetJob.name, contentLanguage)} className="w-[20px] h-[20px] object-contain rounded-sm" />
                                ) : (
                                    <div className="bg-black/90 rounded px-1 py-0.5 text-app-xs font-black text-slate-800 dark:text-white ring-1 ring-white/20 origin-bottom-right">
                                        {mitigation.targetId}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* エフェクト棒: copiesShieldスキル（展開戦術）とduration≤1秒（瞬発スキル）は非表示 */}
                {mitigation.duration > 1 && !def?.copiesShield && (
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
                )}

                {recastPx > durationHeight && !def?.copiesShield && (
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
});
MitigationItem.displayName = 'MitigationItem';

const Timeline: React.FC = () => {
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();
    const {
        mobilePartyOpen, setMobilePartyOpen,
        mobileToolsOpen, setMobileToolsOpen,
        setMobileMenuOpen,
    } = useContext(MobileTriggersContext);

    // データ（useShallowで浅い比較 → 値が変わったときだけ再レンダー）
    const {
        aaSettings, partyMembers,
        timelineMitigations, timelineEvents, phases,
        clipboardEvent, hideEmptyRows, currentLevel, showRowBorders,
    } = useMitigationStore(useShallow(s => ({
        aaSettings: s.aaSettings,
        partyMembers: s.partyMembers,
        timelineMitigations: s.timelineMitigations,
        timelineEvents: s.timelineEvents,
        phases: s.phases,
        clipboardEvent: s.clipboardEvent,
        hideEmptyRows: s.hideEmptyRows,
        currentLevel: s.currentLevel,
        showRowBorders: s.showRowBorders,
    })));
    const partySortOrder = useMitigationStore(s => s.timelineSortOrder);
    // Undo/Redo可否（リアクティブに監視して disabled 状態を正しく反映する）
    const canUndo = useMitigationStore(s => s._history.length > 0);
    const canRedo = useMitigationStore(s => s._future.length > 0);
    // アクション（参照安定・再レンダー不発火）
    const addEvent = useMitigationStore(s => s.addEvent);
    const updateEvent = useMitigationStore(s => s.updateEvent);
    const removeEvent = useMitigationStore(s => s.removeEvent);
    const addMitigation = useMitigationStore(s => s.addMitigation);
    const setMemberJob = useMitigationStore(s => s.setMemberJob);
    const setAaSettings = useMitigationStore(s => s.setAaSettings);
    const removeMitigation = useMitigationStore(s => s.removeMitigation);
    const updateMitigationTime = useMitigationStore(s => s.updateMitigationTime);
    const addPhase = useMitigationStore(s => s.addPhase);
    const updatePhase = useMitigationStore(s => s.updatePhase);
    const removePhase = useMitigationStore(s => s.removePhase);
    const updatePhaseEndTime = useMitigationStore(s => s.updatePhaseEndTime);
    const updatePhaseStartTime = useMitigationStore(s => s.updatePhaseStartTime);
    const labels = useMitigationStore(s => s.labels);
    const addLabel = useMitigationStore(s => s.addLabel);
    const updateLabel = useMitigationStore(s => s.updateLabel);
    const removeLabel = useMitigationStore(s => s.removeLabel);
    const updateLabelEndTime = useMitigationStore(s => s.updateLabelEndTime);
    const updateLabelStartTime = useMitigationStore(s => s.updateLabelStartTime);
    const changeMemberJobWithMitigations = useMitigationStore(s => s.changeMemberJobWithMitigations);
    const setClipboardEvent = useMitigationStore(s => s.setClipboardEvent);
    const myMemberId = useMitigationStore(s => s.myMemberId);

    // PiP カンペビュー
    const [pipWindow, setPipWindow] = useState<Window | null>(null);
    const [pipContainer, setPipContainer] = useState<HTMLDivElement | null>(null);
    const pipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
    const [selectedTime, setSelectedTime] = useState<number>(0);
    const [eventModalPosition, setEventModalPosition] = useState({ x: 0, y: 0 });
    const [eventPopover, setEventPopover] = useState<{ event: TimelineEvent; position: { x: number; y: number } } | null>(null);

    const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState<{ id: string; name: LocalizedString; startTime: number; endTime: number } | null>(null);
    const [selectedPhaseTime, setSelectedPhaseTime] = useState<number>(0);
    const [phaseModalPosition, setPhaseModalPosition] = useState({ x: 0, y: 0 });
    const [timelineSelectMode, setTimelineSelectMode] = useState<{ phaseId: string; startTime: number; field: 'startTime' | 'endTime' } | null>(null);
    const [labelSelectMode, setLabelSelectMode] = useState<{ labelId: string; startTime: number; field: 'startTime' | 'endTime' } | null>(null);
    const [showPreStart] = useState(true);
    const isMobileTimeline = typeof window !== 'undefined' && window.innerWidth < 768;
    const pixelsPerSecond = isMobileTimeline ? 60 : 50;
    const previewEndTimeRef = useRef<number | null>(null);
    const previewRafRef = useRef<number | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    /** DOM直接操作でプレビューハイライトを更新（React再レンダリングなし） */
    const updatePreviewHighlight = useCallback((time: number | null) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // 前回のハイライトをクリア
        const highlighted = container.querySelectorAll('.preview-highlight');
        for (let i = 0; i < highlighted.length; i++) {
            highlighted[i].classList.remove('preview-highlight');
        }

        if (time === null || (!timelineSelectMode && !labelSelectMode)) {
            if (overlayRef.current) overlayRef.current.style.display = 'none';
            container.classList.remove('phase-select-preview', 'label-select-preview');
            return;
        }

        // コンテナにモード識別クラスを付与（CSS側でフェーズ/ラベル列を区別）
        container.classList.remove('phase-select-preview', 'label-select-preview');
        container.classList.add(timelineSelectMode ? 'phase-select-preview' : 'label-select-preview');

        const mode = timelineSelectMode || labelSelectMode!;
        const min = Math.min(mode.startTime, time);
        const max = Math.max(mode.startTime, time);

        // 範囲内の行にpreview-highlightクラスを付与
        const rows = container.querySelectorAll('[data-time-row]');
        for (let i = 0; i < rows.length; i++) {
            const t = Number(rows[i].getAttribute('data-time-row'));
            if (t >= min && t <= max) {
                rows[i].classList.add('preview-highlight');
            }
        }

        // オーバーレイ位置を直接更新
        if (overlayRef.current && timeToYMapRef.current) {
            const tMap = timeToYMapRef.current;
            const offsetTime = showPreStart ? -10 : 0;
            const pxPerSec = pixelsPerSecond;
            const startTime = Math.max(Math.min(mode.startTime, time), offsetTime);
            const endTime = Math.max(Math.max(mode.startTime, time) + 1, offsetTime);
            const startY = tMap.get(startTime) ?? (Math.max(0, startTime - offsetTime) * pxPerSec);
            const endY = tMap.get(endTime) ?? (Math.max(0, endTime - offsetTime) * pxPerSec);
            const height = Math.max(0, endY - startY);
            overlayRef.current.style.top = `${startY}px`;
            overlayRef.current.style.height = `${height}px`;
            overlayRef.current.style.display = height > 0 ? '' : 'none';
        }
    }, [timelineSelectMode, labelSelectMode, showPreStart, pixelsPerSecond]);

    const throttledUpdatePreview = useCallback((time: number | null) => {
        previewEndTimeRef.current = time;
        if (time === null) {
            if (previewRafRef.current !== null) {
                cancelAnimationFrame(previewRafRef.current);
                previewRafRef.current = null;
            }
            updatePreviewHighlight(null);
            return;
        }
        if (previewRafRef.current === null) {
            previewRafRef.current = requestAnimationFrame(() => {
                updatePreviewHighlight(previewEndTimeRef.current);
                previewRafRef.current = null;
            });
        }
    }, [updatePreviewHighlight]);

    // rAFクリーンアップ（アンマウント時）
    useEffect(() => {
        return () => {
            if (previewRafRef.current !== null) {
                cancelAnimationFrame(previewRafRef.current);
            }
        };
    }, []);

    const [phasePopover, setPhasePopover] = useState<{ phase: Phase; position: { x: number; y: number }; clickTime: number } | null>(null);

    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState<{ id: string; name: LocalizedString; startTime: number; endTime: number } | null>(null);
    const [selectedLabelTime, setSelectedLabelTime] = useState<number>(0);
    const [labelModalPosition, setLabelModalPosition] = useState({ x: 0, y: 0 });
    const [labelPopover, setLabelPopover] = useState<{ label: Label; position: { x: number; y: number }; clickTime: number } | null>(null);

    const [mobileMitiFlow, setMobileMitiFlow] = useState<{
        isOpen: boolean;
        time: number;
        step: 'job' | 'skill';
        selectedMemberId: string | null;
    }>({ isOpen: false, time: 0, step: 'job', selectedMemberId: null });

    const [mobileContextMenu, setMobileContextMenu] = useState<{
        isOpen: boolean;
        event: TimelineEvent | null;
        time: number;
    } | null>(null);

    const [mitigationSelectorOpen, setMitigationSelectorOpen] = useState(false);
    const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedMitigationTime, setSelectedMitigationTime] = useState<number>(0);

    const [jobPickerOpen, setJobPickerOpen] = useState(false);
    const [jobPickerPosition, setJobPickerPosition] = useState({ x: 0, y: 0 });
    const [jobPickerMemberId, setJobPickerMemberId] = useState<string | null>(null);

    // ヘッダーナビゲーション
    const [phaseDropdownOpen, setPhaseDropdownOpen] = useState(false);
    const [gimmickDropdownOpen, setGimmickDropdownOpen] = useState(false);
    const [timeInputOpen, setTimeInputOpen] = useState(false);
    const [mechanicSearchOpen, setMechanicSearchOpen] = useState(false);
    const [phaseColumnCollapsed, setPhaseColumnCollapsed] = useState(() => {
        try { return localStorage.getItem('lopo-phase-col-collapsed') === 'true'; } catch { return false; }
    });
    const [labelColumnCollapsed, setLabelColumnCollapsed] = useState(() => {
        try { return localStorage.getItem('lopo-label-col-collapsed') === 'true'; } catch { return false; }
    });
    const phaseHeaderRef = useRef<HTMLDivElement>(null);
    const gimmickHeaderRef = useRef<HTMLDivElement>(null);
    const timeHeaderRef = useRef<HTMLDivElement>(null);
    const mechanicHeaderRef = useRef<HTMLDivElement>(null);

    const [migrationConfig, setMigrationConfig] = useState<{
        isOpen: boolean;
        memberId: string;
        oldJobId: string;
        newJobId: string;
    } | null>(null);

    const fightDuration = 1200;

    const handleTogglePhaseCollapse = () => {
        setPhaseColumnCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('lopo-phase-col-collapsed', String(next)); } catch {}
            return next;
        });
    };

    const handleToggleLabelCollapse = () => {
        setLabelColumnCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('lopo-label-col-collapsed', String(next)); } catch {}
            return next;
        });
    };

    const hasLabels = labels.length > 0;
    const labelColumnVisible = !labelColumnCollapsed && !(phaseColumnCollapsed && !hasLabels);

    const handleNavJump = (time: number) => {
        if (!scrollContainerRef.current) return;
        const targetY = timeToYMapRef.current.get(time);
        if (targetY !== undefined) {
            scrollContainerRef.current.scrollTo({ top: targetY, behavior: 'smooth' });
        } else {
            const offsetTime = showPreStart ? -10 : 0;
            const y = Math.max(0, (time - offsetTime)) * pixelsPerSecond;
            scrollContainerRef.current.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    const maxTime = useMemo(() => {
        let max = 0;
        timelineEvents.forEach(ev => { if (ev.time > max) max = ev.time; });
        return max;
    }, [timelineEvents]);

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

    const handleOpenPip = useCallback(async () => {
        if (!pipSupported) return;
        try {
            const dpip = (window as any).documentPictureInPicture;
            const win: Window = await dpip.requestWindow({
                width: 320,
                height: 400,
            });

            // スタイルをPiPウィンドウにコピー
            const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
            styles.forEach(s => win.document.head.appendChild(s.cloneNode(true)));

            // ダークテーマclass をコピー + 透過背景
            win.document.documentElement.classList.add(...document.documentElement.classList);
            win.document.documentElement.style.background = 'transparent';
            win.document.body.style.margin = '0';
            win.document.body.style.overflow = 'hidden';
            win.document.body.style.background = 'transparent';

            // Reactマウントポイント
            const container = win.document.createElement('div');
            container.id = 'pip-root';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'relative';
            win.document.body.appendChild(container);

            setPipWindow(win);
            setPipContainer(container);

            // ウィンドウ閉じられた時のクリーンアップ
            win.addEventListener('pagehide', () => {
                setPipWindow(null);
                setPipContainer(null);
            });
        } catch (e) {
            console.warn('PiP open failed:', e);
        }
    }, [pipSupported]);

    const handleClosePip = useCallback(() => {
        pipWindow?.close();
        setPipWindow(null);
        setPipContainer(null);
    }, [pipWindow]);

    // パーティ設定: PC用のローカルstate + モバイル用のContext
    const [partySettingsOpenLocal, setPartySettingsOpenLocal] = useState(false);
    // モバイルではContext経由、PCではローカルstate
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
    const partySettingsOpen = isMobileView ? mobilePartyOpen : partySettingsOpenLocal;
    const setPartySettingsOpen = isMobileView ? setMobilePartyOpen : setPartySettingsOpenLocal;

    // ツール: モバイルではContext経由
    const mobileToolsSheetOpen = mobileToolsOpen;
    const setMobileToolsSheetOpen = setMobileToolsOpen;

    // Tutorial auto-open logic
    const { isActive: tutorialActive, currentStepIndex: tutorialStepIndex } = useTutorialStore();
    useEffect(() => {
        if (tutorialActive && tutorialStepIndex === 0) {
            setIsAaModeEnabled(false);
            setAaSettingsOpen(false);
        }
    }, [tutorialActive, tutorialStepIndex]);

    // 旧チュートリアルのparty-slots自動オープンロジックは削除済み（TutorialBlocker方式に移行）

    // モバイルでパーティが開かれたらチュートリアルイベントを通知
    useEffect(() => {
        if (mobilePartyOpen) {
            useTutorialStore.getState().completeEvent('party:opened');
        }
    }, [mobilePartyOpen]);

    // チュートリアル戻るボタン用: ストアからモーダル制御するカスタムイベント
    useEffect(() => {
        const handleCloseAll = () => {
            setPartySettingsOpenLocal(false);
            setMobilePartyOpen(false);
            setMitigationSelectorOpen(false);
            setIsModalOpen(false);
        };
        const handleOpenParty = () => {
            if (isMobileView) {
                setMobilePartyOpen(true);
            } else {
                setPartySettingsOpenLocal(true);
            }
        };
        const handlePartySettings = (e: Event) => {
            const open = (e as CustomEvent).detail?.open ?? true;
            if (isMobileView) {
                setMobilePartyOpen(open);
            } else {
                setPartySettingsOpenLocal(open);
            }
        };
        const handlePhaseJump = () => setPhaseDropdownOpen(prev => !prev);
        const handleLabelJump = () => setGimmickDropdownOpen(prev => !prev);
        const handleMechanicSearch = () => setMechanicSearchOpen(prev => !prev);
        window.addEventListener('tutorial:close-all-modals', handleCloseAll);
        window.addEventListener('tutorial:open-party-modal', handleOpenParty);
        window.addEventListener('timeline:party-settings', handlePartySettings);
        window.addEventListener('mobile:phase-jump', handlePhaseJump);
        window.addEventListener('mobile:label-jump', handleLabelJump);
        window.addEventListener('mobile:mechanic-search', handleMechanicSearch);
        return () => {
            window.removeEventListener('tutorial:close-all-modals', handleCloseAll);
            window.removeEventListener('tutorial:open-party-modal', handleOpenParty);
            window.removeEventListener('timeline:party-settings', handlePartySettings);
            window.removeEventListener('mobile:phase-jump', handlePhaseJump);
            window.removeEventListener('mobile:label-jump', handleLabelJump);
            window.removeEventListener('mobile:mechanic-search', handleMechanicSearch);
        };
    }, []);


    // プラン切替時に縦横スクロールをトップ・左端へ、空行非表示をデフォルト(コンパクト)にリセット
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, left: 0 });
        }
        // チュートリアル中: NewPlanModal が hideEmptyRows を制御しているのでスキップ
        // 空プラン (新規作成直後・テンプレ未整備コンテンツ等): 軽減配置時刻を見せたいので強制的に展開状態へ
        const isTutorial = useTutorialStore.getState().isActive;
        const plan = usePlanStore.getState().plans.find(p => p.id === currentPlanId);
        const isEmptyPlan = plan ? plan.data.timelineEvents.length === 0 : false;
        if (isTutorial) return;
        if (isEmptyPlan) {
            useMitigationStore.getState().setHideEmptyRows(false);
        } else {
            useMitigationStore.getState().setHideEmptyRows(true);
        }
    }, [currentPlanId]);

    const currentPlan = usePlanStore(s => s.plans.find(p => p.id === s.currentPlanId));
    const currentContentId = currentPlan?.contentId ?? null;
    const [isMitiSheetOpen, setIsMitiSheetOpen] = useState(false);

    const [isAaModeEnabled, setIsAaModeEnabled] = useState(false);
    const [aaSettingsOpen, setAaSettingsOpen] = useState(false);

    const aaSettingsButtonRef = useRef<HTMLButtonElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const controlBarRef = useRef<HTMLDivElement>(null);
    const timeToYMapRef = useRef(new Map<number, number>());

    const handleScrollSync = () => {
        if (!scrollContainerRef.current) return;
        const scrollLeft = scrollContainerRef.current.scrollLeft;

        // Use transform for more reliable sync across different content widths
        const containers = [
            { ref: headerRef, id: 'timeline-header-inner' },
            { ref: controlBarRef, id: 'timeline-controls-inner' },
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
            }
        };

        syncPadding();
        window.addEventListener('resize', syncPadding);
        return () => window.removeEventListener('resize', syncPadding);
    }, []);

    // AA モード中に Escape キーで終了
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isAaModeEnabled) {
                setIsAaModeEnabled(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isAaModeEnabled]);

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
        const targetOrder = { MT: 0, ST: 1 } as const;
        const map = new Map<number, TimelineEvent[]>();
        timelineEvents.forEach(event => {
            const t = event.time;
            if (!map.has(t)) map.set(t, []);
            map.get(t)?.push(event);
        });
        // 同一時刻内: MT → ST → AoE の順を保証
        map.forEach(events => {
            if (events.length > 1) {
                events.sort((a, b) =>
                    (targetOrder[a.target as keyof typeof targetOrder] ?? 2) -
                    (targetOrder[b.target as keyof typeof targetOrder] ?? 2)
                );
            }
        });
        return map;
    }, [timelineEvents]);

    const handleAddClick = useCallback((time: number, e: React.MouseEvent) => {
        e.stopPropagation();

        const currentClipboard = useMitigationStore.getState().clipboardEvent;
        if (currentClipboard) {
            const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
            useMitigationStore.getState().addEvent({
                ...currentClipboard,
                id: generateId(),
                time: time
            });
            return;
        }

        if (isAaModeEnabled) {
            const existingEvents = eventsByTime.get(time) || [];
            if (existingEvents.length < 2) {
                const currentAaSettings = useMitigationStore.getState().aaSettings;
                const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
                useMitigationStore.getState().addEvent({
                    id: newId,
                    time: time,
                    name: { ja: 'AA', en: 'AA' },
                    damageAmount: currentAaSettings.damage,
                    damageType: currentAaSettings.type,
                    target: currentAaSettings.target
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
        useTutorialStore.getState().completeEvent('create:event-modal-opened');
    }, [isAaModeEnabled, eventsByTime]);

    const handlePhaseAdd = useCallback((time: number, e: React.MouseEvent) => {
        e.stopPropagation();
        // このtimeがどのフェーズに属するか判定
        const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
        const ownerPhase = sorted.slice().reverse().find(p => p.startTime <= time);
        if (ownerPhase) {
            // 既存フェーズ内クリック → コンテキストメニュー
            setPhasePopover({ phase: ownerPhase, position: { x: e.clientX, y: e.clientY }, clickTime: time });
        } else {
            // フェーズなし → 直接追加モーダル
            setPhaseModalPosition({ x: e.clientX, y: e.clientY });
            setSelectedPhaseTime(time);
            setSelectedPhase(null);
            setIsPhaseModalOpen(true);
        }
    }, [phases]);

    const handlePhaseEdit = (phase: Phase, e: React.MouseEvent) => {
        e.stopPropagation();
        setPhaseModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedPhase({ id: phase.id, name: phase.name, startTime: phase.startTime, endTime: phase.endTime });
        setIsPhaseModalOpen(true);
    };

    const handlePhaseSave = (name: LocalizedString, startTime?: number, endTime?: number) => {
        if (selectedPhase) {
            updatePhase(selectedPhase.id, name);
            if (startTime !== undefined) {
                updatePhaseStartTime(selectedPhase.id, startTime);
            }
            if (endTime !== undefined) {
                updatePhaseEndTime(selectedPhase.id, endTime);
            }
        } else {
            if (selectedPhaseTime !== undefined) {
                addPhase(selectedPhaseTime, name);
            }
        }
    };

    const handlePhaseDelete = () => {
        if (selectedPhase) {
            removePhase(selectedPhase.id);
            setIsPhaseModalOpen(false);
        }
    };

    // ラベル追加・編集・削除
    const handleLabelAdd = useCallback((time: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const sorted = [...labels].sort((a, b) => a.startTime - b.startTime);
        const ownerLabel = sorted.slice().reverse().find(l => l.startTime <= time);
        if (ownerLabel) {
            setLabelPopover({ label: ownerLabel, position: { x: e.clientX, y: e.clientY }, clickTime: time });
        } else {
            setLabelModalPosition({ x: e.clientX, y: e.clientY });
            setSelectedLabelTime(time);
            setSelectedLabel(null);
            setIsLabelModalOpen(true);
        }
    }, [labels]);

    const handleLabelEdit = (label: Label, e: React.MouseEvent) => {
        e.stopPropagation();
        setLabelModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedLabel({ id: label.id, name: label.name, startTime: label.startTime, endTime: label.endTime });
        setIsLabelModalOpen(true);
    };

    const handleLabelSave = (name: LocalizedString, startTime?: number, endTime?: number) => {
        if (selectedLabel) {
            updateLabel(selectedLabel.id, name);
            if (startTime !== undefined) {
                updateLabelStartTime(selectedLabel.id, startTime);
            }
            if (endTime !== undefined) {
                updateLabelEndTime(selectedLabel.id, endTime);
            }
        } else {
            if (selectedLabelTime !== undefined) {
                addLabel(selectedLabelTime, name);
            }
        }
    };

    const handleLabelDelete = () => {
        if (selectedLabel) {
            removeLabel(selectedLabel.id);
            setIsLabelModalOpen(false);
        }
    };

    const handleEventClick = useCallback((event: TimelineEvent, e: React.MouseEvent) => {
        e.stopPropagation();

        if (isAaModeEnabled) {
            setIsAaModeEnabled(false);
        }

        setEventPopover({ event, position: { x: e.clientX, y: e.clientY } });
    }, [isAaModeEnabled]);

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

    const handleCellClick = useCallback((memberId: string, time: number, e: React.MouseEvent) => {
        const member = useMitigationStore.getState().partyMembers.find(m => m.id === memberId);
        const isTutorial = useTutorialStore.getState().isActive;
        if (!member || (!member.jobId && !isTutorial)) return;

        setSelectorPosition({ x: e.clientX, y: e.clientY });
        setSelectedMemberId(memberId);
        setSelectedMitigationTime(time);
        setMitigationSelectorOpen(true);
        // ── Tutorial: セルクリックイベント ──
        useTutorialStore.getState().completeEvent('mitigation:cell-clicked');
    }, []);

    const handleMobileDamageClick = useCallback((time: number, e: React.MouseEvent) => {
        e.stopPropagation();
        // 他のボトムメニューを閉じてから軽減シートを開く
        setMobilePartyOpen(false);
        setMobileToolsOpen(false);
        setMobileMenuOpen(false);
        setMobileMitiFlow({ isOpen: true, time, step: 'job', selectedMemberId: null });
    }, [setMobilePartyOpen, setMobileToolsOpen, setMobileMenuOpen]);

    const handleMobileLongPress = useCallback((event: TimelineEvent | null, time: number) => {
        setMobilePartyOpen(false);
        setMobileToolsOpen(false);
        setMobileMenuOpen(false);
        if (event === null) {
            // 空行の長押し: PC の `+` ボタン相当として直接 EventModal を開く
            setSelectedEvent(null);
            setSelectedTime(time);
            setIsModalOpen(true);
            return;
        }
        setMobileContextMenu({ isOpen: true, event, time });
    }, [setMobilePartyOpen, setMobileToolsOpen, setMobileMenuOpen]);

    const handleContextEdit = useCallback(() => {
        if (!mobileContextMenu?.event) return;
        setSelectedEvent(mobileContextMenu.event);
        setSelectedTime(mobileContextMenu.time);
        setIsModalOpen(true);
        setMobileContextMenu(null);
    }, [mobileContextMenu]);

    const handleContextAdd = useCallback(() => {
        if (!mobileContextMenu) return;
        setSelectedEvent(null);
        setSelectedTime(mobileContextMenu.time);
        setIsModalOpen(true);
        setMobileContextMenu(null);
    }, [mobileContextMenu]);

    const handleContextDelete = useCallback(() => {
        if (!mobileContextMenu?.event) return;
        setConfirmDialog({
            title: t('timeline.event_delete'),
            message: t('timeline.delete_event_confirm'),
            variant: 'danger',
            onConfirm: () => {
                removeEvent(mobileContextMenu.event!.id);
                setConfirmDialog(null);
                setMobileContextMenu(null);
            },
        });
    }, [mobileContextMenu, t, removeEvent]);

    // 他のボトムメニューが開いたら軽減追加シートを閉じる
    useEffect(() => {
        const close = () => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }));
        window.addEventListener('mobile:close-miti-flow', close);
        return () => window.removeEventListener('mobile:close-miti-flow', close);
    }, []);

    const handleMitigationSelect = (mitigation: Mitigation & { _targetId?: string; _linkedMitigationId?: string }) => {
        if (!selectedMemberId) return;

        addMitigation({
            id: genId(),
            mitigationId: mitigation.id,
            time: selectedMitigationTime,
            duration: mitigation.duration,
            ownerId: selectedMemberId,
            targetId: mitigation._targetId,
            linkedMitigationId: mitigation._linkedMitigationId,
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

                // exclusiveWith: 同グループのスキルが同時にアクティブな場合、最後に付与された方のみ軽減適用
                if (def.exclusiveWith && def.value > 0) {
                    const laterExclusive = activeMitigations.some(other => {
                        if (other.id === appMit.id) return false;
                        const otherDef = MITIGATIONS.find(m => m.id === other.mitigationId);
                        return otherDef?.exclusiveWith === def.exclusiveWith && otherDef?.value && otherDef.value > 0 && other.time > appMit.time;
                    });
                    if (laterExclusive) return;
                }

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

                    // copiesShield: リンク先バリアのコピー処理（展開戦術）
                    if (def.copiesShield) {
                        if (!appMit.linkedMitigationId) return; // リンクなし → バリア0、スキップ

                        const linkedMit = timelineMitigations.find(l => l.id === appMit.linkedMitigationId);
                        if (!linkedMit) return; // リンク先が見つからない → スキップ

                        const linkedOwner = partyMembers.find(p => p.id === linkedMit.ownerId);
                        if (!linkedOwner) return;

                        const shieldValue = calculateLinkedShieldValue(
                            linkedMit, timelineMitigations, partyMembers, MITIGATIONS
                        );

                        // copiesShieldはパーティ全体にコピー（元の鼓舞対象は直接のバリアがあるので除外）
                        affectedContexts.forEach(ctx => {
                            if (ctx === linkedMit.targetId) return;
                            let shieldRemaining = getShieldState(ctx, appMit.id, shieldValue);
                            if (shieldRemaining > 0) {
                                const absorbed = Math.min(shieldRemaining, damageForShields);
                                const finalShield = shieldRemaining - absorbed;
                                updateShieldState(ctx, appMit.id, finalShield);
                                if (ctx === displayContext) {
                                    displayShieldTotal += shieldRemaining;
                                    currentDamage = Math.max(0, currentDamage - absorbed);
                                }
                            }
                        });
                        return; // 通常のバリア計算をスキップ
                    }

                    if (def.scope === 'self' && appMit.ownerId !== displayContext && appMit.targetId !== displayContext) return;
                    if (appMit.targetId && appMit.targetId !== displayContext) return;
                    if (def.type === 'physical' && event.damageType === 'magical') return;
                    if (def.type === 'magical' && event.damageType === 'physical') return;

                    const member = partyMembers.find(m => m.id === appMit.ownerId);
                    if (!member) return;

                    let healingMultiplier = 1;
                    let critMultiplier = 1;
                    const buffsAtCast = timelineMitigations.filter(b =>
                        b.time <= appMit.time && appMit.time < b.time + b.duration && b.id !== appMit.id
                    );

                    // 消費型バフチェック: バリアスキルに対して最初の1回のみ適用
                    if (def.isShield) {
                        // 秘策 (SCH): 確定クリティカル ×1.6
                        const activeRecitation = buffsAtCast.find(b =>
                            b.mitigationId === 'recitation' && b.ownerId === appMit.ownerId
                        );
                        if (activeRecitation) {
                            const earlierShieldConsumes = timelineMitigations.some(m =>
                                m.id !== appMit.id &&
                                m.ownerId === appMit.ownerId &&
                                m.time >= activeRecitation.time &&
                                m.time < appMit.time &&
                                MITIGATIONS.find(d => d.id === m.mitigationId)?.isShield
                            );
                            if (!earlierShieldConsumes) {
                                critMultiplier = CRIT_MULTIPLIER;
                            }
                        }

                        // ゾーエ (SGE): 次の回復魔法 ×1.5
                        const activeZoe = buffsAtCast.find(b =>
                            b.mitigationId === 'zoe' && b.ownerId === appMit.ownerId
                        );
                        if (activeZoe) {
                            const earlierShieldConsumesZoe = timelineMitigations.some(m =>
                                m.id !== appMit.id &&
                                m.ownerId === appMit.ownerId &&
                                m.time >= activeZoe.time &&
                                m.time < appMit.time &&
                                MITIGATIONS.find(d => d.id === m.mitigationId)?.isShield
                            );
                            if (!earlierShieldConsumesZoe) {
                                critMultiplier *= 1.5;
                            }
                        }
                    }

                    buffsAtCast.forEach(buff => {
                        const bDef = MITIGATIONS.find(d => d.id === buff.mitigationId);
                        if (bDef && bDef.healingIncrease) {
                            // healingIncreaseDuration: 回復効果アップの持続時間がメイン効果と異なる場合（例: ピュシスII）
                            const hiDuration = bDef.healingIncreaseDuration ?? bDef.duration;
                            if (appMit.time >= buff.time + hiDuration) return;
                            if (bDef.scope === 'self' && buff.ownerId !== displayContext) return;
                            // Self-only healing increase (e.g. Dissipation, Neutral Sect) only applies to the caster's own heals
                            if (bDef.healingIncreaseSelfOnly && buff.ownerId !== appMit.ownerId) return;
                            // 対象指定バフ（クラーシス、生命回生法等）: バフの対象とスキルの対象が一致する場合のみ
                            if (bDef.scope === 'target' && buff.targetId !== appMit.targetId) return;
                            healingMultiplier += (bDef.healingIncrease / 100);
                        }
                    });

                    // Always use Japanese name for computedValues lookup (SKILL_DATA keys are Japanese)
                    const jaName = typeof def.name === 'string' ? def.name : (def.name.ja || '');
                    let maxValBase = member.computedValues[jaName] || 0;

                    if ((def.id === 'helios_conjunction' || def.id === 'aspected_helios') && isConditionalShield) {
                        maxValBase = member.computedValues[`${def.name.ja} (Nセクト)`] || 0;
                    }

                    const maxVal = Math.floor(maxValBase * critMultiplier * healingMultiplier);

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

            const key = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
                e.preventDefault();
                useMitigationStore.getState().undo();
            }
            if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey) {
                e.preventDefault();
                useMitigationStore.getState().redo();
            }
            if ((e.ctrlKey || e.metaKey) && key === 'y') {
                e.preventDefault();
                useMitigationStore.getState().redo();
            }
            // 単独キーショートカット（PCのみ、Shiftは許可）
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (typeof window !== 'undefined' && window.innerWidth < 768) return;
            if (key === 'p' && e.shiftKey) {
                // Shift+P: フェーズ列の表示/非表示
                e.preventDefault();
                if (phaseDropdownOpen) setPhaseDropdownOpen(false);
                handleTogglePhaseCollapse();
            } else if (key === 'p' && !e.shiftKey) {
                // P: フェーズドロップダウン開閉
                e.preventDefault();
                setPhaseDropdownOpen(prev => !prev);
            } else if (key === 't') {
                e.preventDefault();
                setTimeInputOpen(prev => !prev);
            } else if (key === 'l' && e.shiftKey) {
                // Shift+L: ラベル列の表示/非表示
                e.preventDefault();
                if (gimmickDropdownOpen) setGimmickDropdownOpen(false);
                handleToggleLabelCollapse();
            } else if (key === 'l' && !e.shiftKey) {
                // L: ラベルドロップダウン開閉
                e.preventDefault();
                setGimmickDropdownOpen(prev => !prev);
            } else if (key === 'a') {
                e.preventDefault();
                setMechanicSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [phaseDropdownOpen, gimmickDropdownOpen]);

    useEffect(() => {
        const handleReset = () => {
            setIsAaModeEnabled(false);
        };
        window.addEventListener('tutorial:reset-ui', handleReset);
        return () => {
            window.removeEventListener('tutorial:reset-ui', handleReset);
        };
    }, []);

    // イベントポップオーバー: Escapeで閉じる
    useEffect(() => {
        if (!eventPopover) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setEventPopover(null);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [eventPopover]);

    // コピーモード: Escapeでキャンセル
    useEffect(() => {
        if (!clipboardEvent) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setClipboardEvent(null);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [clipboardEvent]);

    // TL選択モード: Escapeでキャンセル
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (timelineSelectMode) {
                    setTimelineSelectMode(null);
                    throttledUpdatePreview(null);
                }
                if (labelSelectMode) {
                    setLabelSelectMode(null);
                    throttledUpdatePreview(null);
                }
            }
        };
        if (timelineSelectMode || labelSelectMode) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [timelineSelectMode, labelSelectMode, throttledUpdatePreview]);

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
        const order: string[] = partySortOrder === 'light_party' ? lightPartyOrder : [...PARTY_MEMBER_IDS];

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
            <div className="flex flex-col h-full w-full bg-transparent overflow-hidden relative z-[1]">
                <div className="absolute inset-0 pointer-events-none"></div>

                <div className={clsx(
                    "relative flex-1 flex flex-col pt-0 glass-panel overflow-hidden transition-all duration-300 ease-out",
                    "h-full z-[1]",
                    isMobileTimeline
                        ? "rounded-none mx-0 mt-0"
                        : "mx-0 mt-0 mb-0 rounded-none"
                )}>
                    {/* プラン未選択時 — Liquid Glass オーバーレイ（CSSクラス .no-plan で表示制御） */}
                    <div className="empty-liquid-glass">
                        <div className="empty-glass-corner empty-glass-corner-tl" />
                        <div className="empty-glass-corner empty-glass-corner-tr" />
                        <div className="empty-glass-corner empty-glass-corner-bl" />
                        <div className="empty-glass-corner empty-glass-corner-br" />
                        <div className="empty-glass-sheen" />
                        {/* PC: 左端の呼吸する光 */}
                        <div className="hidden md:block">
                            <div className="empty-glow-left" />
                            <div className="empty-glow-left-spread" />
                        </div>
                        {/* スマホ: 左下L字の呼吸する光 */}
                        <div className="md:hidden">
                            <div className="empty-glow-bl-h" />
                            <div className="empty-glow-bl-v" />
                            <div className="empty-glow-bl-spread" />
                        </div>
                    </div>
                    <div
                        ref={controlBarRef}
                        className={clsx(
                            "flex-shrink-0 z-[51] h-7 relative border-b select-none overflow-hidden",
                            "bg-app-surface2 border-app-border",
                            "hidden md:block"
                        )}
                    >
                        <div id="timeline-controls-inner" className="flex items-center gap-0 shrink-0 h-full w-full md:w-max md:min-w-max will-change-transform">
                            {/* Area A: PHASE(100) + TIME(70) = 170px — テーブルカラムと幅を揃える */}
                            <div className="w-[30px] min-w-[30px] md:w-[170px] md:min-w-[170px] flex-none flex items-center px-1 md:px-2 h-full">
                                <button
                                    onClick={() => useMitigationStore.getState().setHideEmptyRows(!useMitigationStore.getState().hideEmptyRows)}
                                    className={clsx(
                                        "flex items-center justify-center gap-2 px-1 md:px-3 py-0.5 my-auto rounded-md text-app-base font-black transition-all duration-300 group/btn cursor-pointer relative overflow-hidden h-6 w-full",
                                        !hideEmptyRows
                                            ? "bg-app-toggle text-app-toggle-text"
                                            : "text-app-text"
                                    )}
                                >
                                    <AlignJustify
                                        size={14}
                                        className="transition-all duration-300 group-hover/btn:scale-110 shrink-0"
                                    />
                                    <span className="uppercase tracking-wider hidden md:block">
                                        {t('ui.compact_view')}
                                    </span>
                                </button>
                            </div>

                            {/* 短い区切り線 — テーブルの Time|Event 境界と揃う */}
                            <div className="w-[1px] h-3 dark:bg-app-text/25 bg-app-text shrink-0 hidden md:block rounded-full" />

                            {/* Area B: MECHANIC(200) — 敵の攻撃カラムと揃う */}
                            <div className="flex-1 md:flex-none md:w-[199px] md:min-w-[199px] flex items-center px-1 md:px-2 h-full">
                                <div className={clsx(
                                    "flex items-center gap-0 relative rounded-md transition-all duration-300 overflow-hidden h-6 w-full",
                                    isAaModeEnabled && "bg-app-toggle text-app-toggle-text"
                                )}>
                                    <button
                                        ref={aaSettingsButtonRef}
                                        onClick={() => {
                                            if (isAaModeEnabled) {
                                                setIsAaModeEnabled(false);
                                            } else {
                                                setAaSettingsOpen(!aaSettingsOpen);
                                            }
                                        }}
                                        className={clsx(
                                            "flex-1 flex items-center justify-center gap-2 px-2 md:px-3 h-full transition-all duration-300 group/btn cursor-pointer",
                                            isAaModeEnabled
                                                ? "text-app-bg"
                                                : "text-app-text"
                                        )}
                                    >
                                        <Sword size={14} className="transition-transform duration-300 group-hover/btn:scale-110 shrink-0" />
                                        <span className="font-black text-app-base uppercase tracking-wider hidden md:block">{t('aa_settings.title')}</span>
                                    </button>
                                </div>
                                <AASettingsPopover
                                    isOpen={aaSettingsOpen}
                                    onClose={() => setAaSettingsOpen(false)}
                                    settings={aaSettings}
                                    onSettingsChange={setAaSettings}
                                    triggerRef={aaSettingsButtonRef}
                                    onStartAdding={() => setIsAaModeEnabled(true)}
                                    isAaActive={isAaModeEnabled}
                                />
                            </div>

                            {/* 短い区切り線 — テーブルの Event|U.Dmg 境界と揃う */}
                            <div className="w-[1px] h-3 dark:bg-app-text/25 bg-app-text shrink-0 hidden md:block rounded-full" />

                            {/* Area C: U.Dmg(100) — 罫線トグル + チートシート（準備中） */}
                            <div className="flex-none md:w-[99px] md:min-w-[99px] flex items-center justify-center gap-1 h-full">
                                <Tooltip content={t('timeline.row_borders')}>
                                    <button
                                        onClick={() => useMitigationStore.getState().setShowRowBorders(!showRowBorders)}
                                        className={clsx(
                                            "p-1 rounded transition-all duration-150 cursor-pointer",
                                            showRowBorders
                                                ? "text-app-text hover:bg-app-surface2"
                                                : "text-app-text-muted hover:bg-app-surface2"
                                        )}
                                    >
                                        <Rows3 size={12} />
                                    </button>
                                </Tooltip>
                                {/* PiP カンペビュー — 透過ウィンドウ未実現のため非表示（コードは保持） */}
                                {false && pipSupported && (
                                    <Tooltip content={myMemberId ? t('timeline.pip_open') : t('timeline.pip_open_disabled')}>
                                        <button
                                            onClick={pipWindow ? handleClosePip : handleOpenPip}
                                            disabled={!myMemberId}
                                            className={clsx(
                                                "p-1 rounded transition-all duration-150",
                                                !myMemberId
                                                    ? "text-app-text-muted cursor-default opacity-40"
                                                    : pipWindow
                                                        ? "text-app-blue cursor-pointer hover:bg-app-blue/10"
                                                        : "text-app-text-muted cursor-pointer hover:bg-app-surface2 hover:text-app-text"
                                            )}
                                        >
                                            <PictureInPicture2 size={12} />
                                        </button>
                                    </Tooltip>
                                )}
                            </div>

                            {/* 短い区切り線 — テーブルの U.Dmg|Dmg 境界と揃う */}
                            <div className="w-[1px] h-3 dark:bg-app-text/25 bg-app-text shrink-0 hidden md:block rounded-full" />

                            {/* Area D: Dmg(100) — Undo/Redo/ゴミ箱 */}
                            <div className="flex-none md:w-[99px] md:min-w-[99px] flex items-center justify-center gap-0.5 h-full">
                                <Tooltip content={t('timeline.undo')}>
                                    <button
                                        onClick={() => useMitigationStore.getState().undo()}
                                        disabled={!canUndo}
                                        className={clsx(
                                            "p-1 rounded transition-all duration-150 cursor-pointer",
                                            canUndo
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
                                        disabled={!canRedo}
                                        className={clsx(
                                            "p-1 rounded transition-all duration-150 cursor-pointer",
                                            canRedo
                                                ? "text-app-text hover:bg-app-surface2"
                                                : "text-app-text-muted cursor-default"
                                        )}
                                    >
                                        <Redo2 size={12} />
                                    </button>
                                </Tooltip>
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

                            {/* 短い区切り線 — テーブルの Dmg|Job列 境界と揃う */}
                            <div className="w-[1px] h-3 dark:bg-app-text/25 bg-app-text shrink-0 hidden md:block rounded-full" />
                        </div>
                    </div>

                    <div
                        ref={headerRef}
                        className={clsx(
                            "flex-shrink-0 z-50 bg-app-surface2 border-b border-app-border text-app-md font-barlow font-medium text-app-text uppercase tracking-wider text-center h-10 select-none overflow-hidden",
                            isMobileTimeline && "hidden"
                        )}
                    >
                        <div id="timeline-header-inner" className="flex items-center h-full w-full md:w-max md:min-w-max will-change-transform">
                            {/* モバイル: フェーズなし → ラベルをフェーズ位置に表示 */}
                            {(() => {
                                const hasPhases = phases.length > 0;
                                const mobileLabelInPhaseSlot = !hasPhases;
                                return (
                                    <>
                                        {!phaseColumnCollapsed ? (
                                            <Tooltip content={t('timeline.header_phase_tooltip')}>
                                                <div
                                                    ref={phaseHeaderRef}
                                                    className={`${mobileLabelInPhaseSlot ? 'hidden md:flex' : 'flex'} w-[24px] min-w-[24px] md:w-[60px] md:min-w-[60px] md:max-w-[60px] flex-none border-r border-app-border h-full items-center justify-center text-app-text-muted font-black bg-transparent text-app-xs md:text-app-md md:cursor-pointer md:hover:text-app-text transition-colors`}
                                                    onClick={() => { if (window.innerWidth >= 768) setPhaseDropdownOpen(!phaseDropdownOpen); }}
                                                >
                                                    <span className="md:hidden">{t('timeline.header_phase_short')}</span>
                                                    <span className="hidden md:inline md:items-center md:gap-1">
                                                        {t('timeline.header_phase')}
                                                        <ChevronDown size={12} className="inline ml-0.5" />
                                                    </span>
                                                </div>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip content={`${t('timeline.nav_phase_expand')} (Shift+P)`}>
                                                <div
                                                    ref={phaseHeaderRef}
                                                    className="w-[16px] min-w-[16px] max-w-[16px] flex-none border-r border-app-border h-full hidden md:flex items-center justify-center cursor-pointer hover:bg-app-surface2 transition-colors"
                                                    onClick={() => handleTogglePhaseCollapse()}
                                                >
                                                    <ChevronDown size={12} className="text-app-text-muted -rotate-90" />
                                                </div>
                                            </Tooltip>
                                        )}
                                        {/* モバイル: フェーズなし → ラベルヘッダーをフェーズ位置に */}
                                        {mobileLabelInPhaseSlot && labelColumnVisible && (
                                            <div
                                                ref={gimmickHeaderRef}
                                                className="w-[24px] min-w-[24px] md:hidden flex-none border-r border-app-border h-full flex items-center justify-center text-app-text-muted font-black text-app-xs"
                                                onClick={() => setGimmickDropdownOpen(!gimmickDropdownOpen)}
                                            >
                                                {t('timeline.header_gimmick_short')}
                                            </div>
                                        )}
                                        {/* PC: ラベル列ヘッダー */}
                                        {labelColumnVisible ? (
                                            <Tooltip content={t('timeline.header_gimmick_tooltip')}>
                                                <div
                                                    ref={!mobileLabelInPhaseSlot ? gimmickHeaderRef : undefined}
                                                    className="hidden md:flex w-[50px] min-w-[50px] max-w-[50px] flex-none border-r border-app-border h-full items-center justify-center bg-transparent text-app-text-muted font-black text-app-md cursor-pointer hover:text-app-text transition-colors"
                                                    onClick={() => setGimmickDropdownOpen(!gimmickDropdownOpen)}
                                                >
                                                    <span className="flex items-center gap-0.5">
                                                        {t('timeline.header_gimmick')}
                                                        <ChevronDown size={10} className="inline" />
                                                    </span>
                                                </div>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip content={`${t('timeline.nav_label_expand')} (Shift+L)`}>
                                                <div
                                                    ref={!mobileLabelInPhaseSlot ? gimmickHeaderRef : undefined}
                                                    className="w-[16px] min-w-[16px] max-w-[16px] flex-none border-r border-app-border h-full hidden md:flex items-center justify-center cursor-pointer hover:bg-app-surface2 transition-colors"
                                                    onClick={() => handleToggleLabelCollapse()}
                                                >
                                                    <ChevronDown size={12} className="text-app-text-muted -rotate-90" />
                                                </div>
                                            </Tooltip>
                                        )}
                                    </>
                                );
                            })()}
                            <Tooltip content={t('timeline.header_time_tooltip')}>
                                <div
                                    ref={timeHeaderRef}
                                    className="w-[36px] min-w-[36px] md:w-[60px] md:min-w-[60px] md:max-w-[60px] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text-muted font-black text-app-xs md:text-app-base md:cursor-pointer md:hover:text-app-text transition-colors"
                                    onClick={() => { if (window.innerWidth >= 768) setTimeInputOpen(!timeInputOpen); }}
                                >
                                    <span className="md:hidden">{t('timeline.header_time')}</span>
                                    <span className="hidden md:inline md:items-center md:gap-0.5">
                                        {t('timeline.header_time')}
                                        <ChevronDown size={10} className="inline ml-0.5" />
                                    </span>
                                </div>
                            </Tooltip>
                            <Tooltip content={t('timeline.header_mechanic_tooltip')} wrapperClassName="flex-1 md:flex-none md:w-[200px] md:min-w-[200px] md:max-w-[200px] h-full">
                                <div
                                    ref={mechanicHeaderRef}
                                    className="w-full border-r border-app-border h-full flex items-center bg-transparent text-app-text-muted text-app-sm md:text-app-base pl-2 justify-start font-black cursor-pointer hover:text-app-text transition-colors"
                                    onClick={() => setMechanicSearchOpen(!mechanicSearchOpen)}
                                >
                                    <span className="flex items-center gap-0.5 md:gap-1">
                                        {t('timeline.header_mechanic')}
                                        <ChevronDown size={10} className="inline" />
                                    </span>
                                </div>
                            </Tooltip>
                            <div className="w-[50px] min-w-[50px] md:w-[100px] md:min-w-[100px] md:max-w-[100px] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text-muted text-app-xs md:text-app-base font-black">
                                <span className="md:hidden">{t('timeline.header_raw_short')}</span>
                                <span className="hidden md:inline">{t('timeline.header_raw')}</span>
                            </div>
                            <div className="w-[50px] min-w-[50px] md:w-[100px] md:min-w-[100px] md:max-w-[100px] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text-muted text-app-xs md:text-app-base font-black">
                                <span className="md:hidden">{t('timeline.header_taken_short')}</span>
                                <span className="hidden md:inline">{t('timeline.header_taken')}</span>
                            </div>

                            {sortedPartyMembers.map((member, index) => (
                                <div
                                    key={member.id}
                                    style={{ width: `${getColumnWidth(member.role)}px`, minWidth: `${getColumnWidth(member.role)}px`, maxWidth: `${getColumnWidth(member.role)}px` }}
                                    className={clsx(
                                        "hidden md:flex flex-none border-r border-app-border h-full flex-col items-center justify-center p-0.5 relative group",
                                        index === sortedPartyMembers.length - 1 && "border-r border-app-border",
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
                                    <Tooltip content={member.jobId ? `${member.id} — ${t('ui.change_job_tooltip')}` : `${member.id} (${t('ui.change_job')})`} position="bottom" wrapperClassName="w-full h-full">
                                        <div
                                            className={clsx(
                                                "flex items-center justify-center w-full h-full rounded cursor-pointer transition-all duration-300 relative"
                                            )}
                                            onClick={(e) => handleJobIconClick(member.id, e)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                if (!member.jobId) return;
                                                useMitigationStore.getState().setMemberJob(member.id, null);
                                            }}
                                        >
                                            {member.jobId ? (
                                                <img src={getJobIcon(member.jobId) || ''} alt={member.jobId} className="w-6 h-6 object-contain opacity-90 drop-shadow-sm transition-transform group-hover:scale-125" />
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
                        className={clsx(
                            "timeline-scroll-container flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto relative custom-scrollbar bg-white dark:bg-[var(--color-bg-primary)] duration-200",
                            !currentPlanId && isMobileTimeline && "hidden"
                        )}
                        onScroll={handleScrollSync}
                        style={{ paddingTop: isMobileView ? MOBILE_TOKENS.header.compactHeight : undefined }}
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

                                    // create-plan チュートリアル step6 では time=0 行を常に表示する
                                    const forceShowTime0 = time === 0
                                        && useTutorialStore.getState().isActive
                                        && useTutorialStore.getState().getCurrentStep()?.id === 'create-6-add-event';

                                    if (!hideEmptyRows || hasEvents || hasMitigationStart || isBottomEmptyRow || forceShowTime0) {
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

                                    // create-plan チュートリアル step6 では time=0 行を常に表示する
                                    const forceShowTime0 = time === 0
                                        && useTutorialStore.getState().isActive
                                        && useTutorialStore.getState().getCurrentStep()?.id === 'create-6-add-event';

                                    if (hideEmptyRows && !hasEvents && !hasMitigationStart && !isBottomEmptyRow && !forceShowTime0) {
                                        timeToYMap.set(time, currentY);
                                        return;
                                    }

                                    timeToYMap.set(time, currentY);

                                    if (isMobileTimeline) {
                                        // Mobile: MobileTimelineRow を使用
                                        const mobileSelectHandler = (time: number) => {
                                            if (labelSelectMode) {
                                                if (labelSelectMode.field === 'startTime') {
                                                    updateLabelStartTime(labelSelectMode.labelId, time);
                                                } else {
                                                    updateLabelEndTime(labelSelectMode.labelId, time);
                                                }
                                                setLabelSelectMode(null);
                                                throttledUpdatePreview(null);
                                                return;
                                            }
                                            if (timelineSelectMode) {
                                                if (timelineSelectMode.field === 'startTime') {
                                                    updatePhaseStartTime(timelineSelectMode.phaseId, time);
                                                } else {
                                                    updatePhaseEndTime(timelineSelectMode.phaseId, time);
                                                }
                                                setTimelineSelectMode(null);
                                                throttledUpdatePreview(null);
                                            }
                                        };
                                        const mobileHoverHandler = (time: number) => {
                                            if (timelineSelectMode || labelSelectMode) throttledUpdatePreview(time);
                                        };

                                        if (rowEvents.length >= 2) {
                                            // 2イベント: 別々のカードに分割
                                            renderItems.push(
                                                <MobileTimelineRow
                                                    key={`${time}-0`}
                                                    time={time}
                                                    top={currentY}
                                                    damages={rowDamages}
                                                    events={rowEvents}
                                                    partyMembers={sortedPartyMembers}
                                                    activeMitigations={activeMitigationsForRow}
                                                    onMobileDamageClick={handleMobileDamageClick}
                                                    onLongPress={handleMobileLongPress}
                                                    phaseColumnCollapsed={phaseColumnCollapsed}
                                                    hasPhases={phases.length > 0}
                                                    timelineSelectMode={timelineSelectMode}
                                                    labelSelectMode={labelSelectMode}
                                                    onTimelineSelect={mobileSelectHandler}
                                                    onTimelineSelectHover={mobileHoverHandler}
                                                    eventIndex={0}
                                                    rowHeight={pixelsPerSecond}
                                                />
                                            );
                                            currentY += pixelsPerSecond;
                                            renderItems.push(
                                                <MobileTimelineRow
                                                    key={`${time}-1`}
                                                    time={time}
                                                    top={currentY}
                                                    damages={rowDamages}
                                                    events={rowEvents}
                                                    partyMembers={sortedPartyMembers}
                                                    activeMitigations={activeMitigationsForRow}
                                                    onMobileDamageClick={handleMobileDamageClick}
                                                    onLongPress={handleMobileLongPress}
                                                    phaseColumnCollapsed={phaseColumnCollapsed}
                                                    hasPhases={phases.length > 0}
                                                    timelineSelectMode={timelineSelectMode}
                                                    labelSelectMode={labelSelectMode}
                                                    onTimelineSelect={mobileSelectHandler}
                                                    onTimelineSelectHover={mobileHoverHandler}
                                                    eventIndex={1}
                                                    isSecondEvent
                                                    rowHeight={pixelsPerSecond}
                                                />
                                            );
                                        } else {
                                            renderItems.push(
                                                <MobileTimelineRow
                                                    key={time}
                                                    time={time}
                                                    top={currentY}
                                                    damages={rowDamages}
                                                    events={rowEvents}
                                                    partyMembers={sortedPartyMembers}
                                                    activeMitigations={activeMitigationsForRow}
                                                    onMobileDamageClick={handleMobileDamageClick}
                                                    onLongPress={handleMobileLongPress}
                                                    phaseColumnCollapsed={phaseColumnCollapsed}
                                                    hasPhases={phases.length > 0}
                                                    timelineSelectMode={timelineSelectMode}
                                                    labelSelectMode={labelSelectMode}
                                                    onTimelineSelect={mobileSelectHandler}
                                                    onTimelineSelectHover={mobileHoverHandler}
                                                    rowHeight={pixelsPerSecond}
                                                />
                                            );
                                        }
                                    } else {
                                        // PC: 既存の TimelineRow — 変更禁止
                                        renderItems.push(
                                            <TimelineRow
                                                key={time}
                                                time={time}
                                                top={currentY}
                                                damages={rowDamages}
                                                events={rowEvents}
                                                partyMembers={sortedPartyMembers}
                                                activeMitigations={activeMitigationsForRow}
                                                onPhaseAdd={handlePhaseAdd}
                                                onLabelAdd={handleLabelAdd}
                                                hasPhases={phases.length > 0}
                                                onAddEventClick={handleAddClick}
                                                onEventClick={handleEventClick}
                                                onCellClick={handleCellClick}
                                                onMobileDamageClick={handleMobileDamageClick}
                                                phaseColumnCollapsed={phaseColumnCollapsed}
                                                labelColumnVisible={labelColumnVisible}
                                                timelineSelectMode={timelineSelectMode}
                                                labelSelectMode={labelSelectMode}
                                                onTimelineSelect={(time) => {
                                                    if (labelSelectMode) {
                                                        if (labelSelectMode.field === 'startTime') {
                                                            updateLabelStartTime(labelSelectMode.labelId, time);
                                                        } else {
                                                            updateLabelEndTime(labelSelectMode.labelId, time);
                                                        }
                                                        setLabelSelectMode(null);
                                                        throttledUpdatePreview(null);
                                                        return;
                                                    }
                                                    if (timelineSelectMode) {
                                                        if (timelineSelectMode.field === 'startTime') {
                                                            updatePhaseStartTime(timelineSelectMode.phaseId, time);
                                                        } else {
                                                            updatePhaseEndTime(timelineSelectMode.phaseId, time);
                                                        }
                                                        setTimelineSelectMode(null);
                                                        throttledUpdatePreview(null);
                                                    }
                                                }}
                                                onTimelineSelectHover={(time) => {
                                                    if (timelineSelectMode || labelSelectMode) {
                                                        throttledUpdatePreview(time);
                                                    }
                                                }}
                                                showRowBorders={showRowBorders}
                                            />
                                        );
                                    }

                                    currentY += pixelsPerSecond;
                                });

                                timeToYMapRef.current = timeToYMap;

                                return (
                                    <>
                                        {renderItems}


                                        {/* フェーズオーバーレイ */}
                                        {!phaseColumnCollapsed && (() => {
                                            const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
                                            return sorted.map((phase, index) => {
                                            const offsetTime = showPreStart ? -10 : 0;
                                            const startTime = phase.startTime;
                                            // endTimeは「その行を含む」（inclusive）→ 描画時は+1して次行の先頭まで伸ばす
                                            const endTime = phase.endTime + 1;

                                            if (!showPreStart && endTime <= 0) return null;
                                            // フェーズ名が空ならオーバーレイ全体を描画しない
                                            if (!getPhaseName(phase.name, contentLanguage)) return null;

                                            const effectiveStartTime = Math.max(startTime, offsetTime);
                                            const effectiveEndTime = Math.max(endTime, offsetTime);

                                            const startY = timeToYMap.get(effectiveStartTime) ?? (Math.max(0, effectiveStartTime - offsetTime) * pixelsPerSecond);
                                            const top = startY;
                                            const height = Math.max(0, (timeToYMap.get(effectiveEndTime) ?? (Math.max(0, effectiveEndTime - offsetTime) * pixelsPerSecond)) - startY);

                                            return (
                                                <div
                                                    key={phase.id}
                                                    className="absolute left-0 w-[24px] md:w-[60px] border-r border-b border-app-border bg-app-surface2 pointer-events-none z-10"
                                                    style={{ top: `${top}px`, height: `${height}px` }}
                                                >
                                                    <Tooltip content={t('timeline.click_rename', 'クリックして名前を変更')} position="right" wrapperClassName={clsx("sticky w-full", isMobileView ? "top-[52px]" : "top-0")}>
                                                        <div className="w-full h-[100px] md:h-[150px] flex items-center justify-center pt-6 md:pt-6">
                                                            <div className="transform -rotate-90 overflow-visible px-2 drop-shadow-md origin-center flex flex-col items-center gap-0.5">
                                                                <span className="hidden md:block whitespace-nowrap text-app-xl font-bold text-app-text leading-none">
                                                                    {t('timeline.phase_prefix', { index: index + 1 })}
                                                                </span>
                                                                {getPhaseName(phase.name, contentLanguage) !== t('timeline.phase_prefix', { index: index + 1 }) && (
                                                                    <span className="hidden md:block whitespace-nowrap text-app-sm font-medium text-app-text/70 leading-none">
                                                                        {getPhaseName(phase.name, contentLanguage)}
                                                                    </span>
                                                                )}
                                                                <span className="md:hidden whitespace-nowrap text-app-base font-bold text-app-text leading-none">
                                                                    {getPhaseName(phase.name, contentLanguage)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </Tooltip>
                                                </div>
                                            );
                                        });
                                        })()}

                                        {/* ラベル区間オーバーレイ（PC only） */}
                                        {labelColumnVisible && labels.length > 0 && (() => {
                                            const offsetTime = showPreStart ? -10 : 0;
                                            const sortedLabels = [...labels].sort((a, b) => a.startTime - b.startTime);

                                            return sortedLabels.map((label) => {
                                                // endTimeは inclusive → 描画時は+1
                                                const effectiveEndTime = label.endTime + 1;

                                                const effectiveStart = Math.max(label.startTime, offsetTime);
                                                const effectiveEnd = Math.max(effectiveEndTime, offsetTime);
                                                if (!showPreStart && effectiveEnd <= 0) return null;

                                                const startY = timeToYMap.get(effectiveStart) ?? (Math.max(0, effectiveStart - offsetTime) * pixelsPerSecond);
                                                const endY = timeToYMap.get(effectiveEnd) ?? (Math.max(0, effectiveEnd - offsetTime) * pixelsPerSecond);
                                                const top = startY;
                                                const height = Math.max(0, endY - startY);
                                                if (height <= 0) return null;

                                                const displayName = getPhaseName(label.name, contentLanguage);
                                                const hasPhases = phases.length > 0;

                                                return (
                                                    <div
                                                        key={`label-${label.id}`}
                                                        className={clsx(
                                                            "absolute border-r border-b border-app-border/50 bg-app-surface2 pointer-events-none z-10",
                                                            hasPhases
                                                                ? `hidden md:block ${phaseColumnCollapsed ? 'left-[16px]' : 'left-[60px]'} w-[50px]`
                                                                : `left-0 w-[24px] ${phaseColumnCollapsed ? 'md:left-[16px]' : 'md:left-[60px]'} md:w-[50px]`
                                                        )}
                                                        style={{ top: `${top}px`, height: `${height}px` }}
                                                    >
                                                        <div className="sticky top-0 w-full h-[100px] flex items-center justify-center pt-4">
                                                            <div className="transform -rotate-90 overflow-visible drop-shadow-sm origin-center">
                                                                <span className={clsx(
                                                                    "whitespace-nowrap font-medium text-app-text leading-none",
                                                                    hasPhases ? "text-app-base" : "text-app-xs md:text-app-base"
                                                                )}>
                                                                    {displayName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}

                                        {/* TL選択モード ハイライトオーバーレイ */}
                                        <div
                                            ref={overlayRef}
                                            className={clsx(
                                                "absolute pointer-events-none z-20 border-2 border-app-blue bg-app-blue/10 rounded-sm",
                                                labelSelectMode
                                                    ? (phases.length > 0
                                                        ? `hidden md:block ${phaseColumnCollapsed ? 'left-[16px]' : 'left-[60px]'} w-[50px]`
                                                        : `left-0 w-[24px] ${phaseColumnCollapsed ? 'md:left-[16px]' : 'md:left-[60px]'} md:w-[50px]`)
                                                    : `left-0 w-[24px] ${phaseColumnCollapsed ? 'md:w-[16px]' : 'md:w-[60px]'}`
                                            )}
                                            style={{ display: 'none' }}
                                        />

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

                                                    // コンパクトモード: 終了時間が空行なら、その前の可視行に切り詰める
                                                    let effectiveEndTime = durationEndTime;
                                                    if (hideEmptyRows) {
                                                        const isEndVisible = eventsByTime.has(durationEndTime) || mitStartsByTime.has(durationEndTime);
                                                        if (!isEndVisible) {
                                                            // durationEndTime以下の最大の可視行を探す
                                                            let prevVisible = mitigation.time;
                                                            for (let t = durationEndTime; t >= mitigation.time; t--) {
                                                                if (eventsByTime.has(t) || mitStartsByTime.has(t)) {
                                                                    prevVisible = t;
                                                                    break;
                                                                }
                                                            }
                                                            effectiveEndTime = prevVisible;
                                                        }
                                                    }

                                                    const startY = getMappedY(mitigation.time);
                                                    const endY = getMappedY(effectiveEndTime) + 24;
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
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5 bg-app-bg border border-app-text/15 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,.6)] transition-all duration-300 pointer-events-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-app-4xl drop-shadow-md">📋</span>
                        <div className="flex flex-col">
                            <span className="font-bold text-app-2xl leading-tight drop-shadow-md text-app-text">
                                {t('timeline.copying', { name: clipboardEvent.name ? getPhaseName(clipboardEvent.name, contentLanguage) : t('timeline.event') })}
                            </span>
                            <span className="text-app-base text-app-text-muted leading-tight">
                                {t('timeline.paste_hint')}
                            </span>
                        </div>
                    </div>
                    <Tooltip content={t('timeline.cancel_copy')}>
                        <button
                            onClick={() => setClipboardEvent(null)}
                            className="ml-3 bg-app-text/10 hover:bg-app-text/20 p-1.5 rounded-full cursor-pointer text-app-text"
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

            {mobileContextMenu?.event && (
                <MobileContextMenu
                    isOpen={mobileContextMenu.isOpen}
                    onClose={() => setMobileContextMenu(null)}
                    event={mobileContextMenu.event}
                    time={mobileContextMenu.time}
                    onEdit={handleContextEdit}
                    onAdd={handleContextAdd}
                    onDelete={handleContextDelete}
                    contentLanguage={contentLanguage}
                />
            )}

            <BoundaryEditModal
                isOpen={isPhaseModalOpen}
                isEdit={!!selectedPhase}
                initial={selectedPhase ? { name: selectedPhase.name, startTime: selectedPhase.startTime, endTime: selectedPhase.endTime } : undefined}
                onClose={() => setIsPhaseModalOpen(false)}
                onSave={handlePhaseSave}
                onDelete={selectedPhase ? handlePhaseDelete : undefined}
                onTimelineSelectStart={selectedPhase ? () => {
                    const anchorTime = selectedPhase.endTime ?? selectedPhase.startTime;
                    setTimelineSelectMode({ phaseId: selectedPhase.id, startTime: anchorTime, field: 'startTime' });
                    setIsPhaseModalOpen(false);
                } : undefined}
                onTimelineSelectEnd={selectedPhase ? () => {
                    const phase = phases.find(p => p.id === selectedPhase.id);
                    setTimelineSelectMode({ phaseId: selectedPhase.id, startTime: phase?.startTime ?? 0, field: 'endTime' });
                    setIsPhaseModalOpen(false);
                } : undefined}
                mode="phase"
                position={phaseModalPosition}
            />
            <BoundaryEditModal
                isOpen={isLabelModalOpen}
                isEdit={!!selectedLabel}
                initial={selectedLabel ? { name: selectedLabel.name, startTime: selectedLabel.startTime, endTime: selectedLabel.endTime } : undefined}
                onClose={() => setIsLabelModalOpen(false)}
                onSave={handleLabelSave}
                onDelete={selectedLabel ? handleLabelDelete : undefined}
                onTimelineSelectStart={selectedLabel ? () => {
                    const anchorTime = selectedLabel.endTime ?? selectedLabel.startTime;
                    setLabelSelectMode({ labelId: selectedLabel.id, startTime: anchorTime, field: 'startTime' });
                    setIsLabelModalOpen(false);
                } : undefined}
                onTimelineSelectEnd={selectedLabel ? () => {
                    const label = labels.find(l => l.id === selectedLabel.id);
                    setLabelSelectMode({ labelId: selectedLabel.id, startTime: label?.startTime ?? 0, field: 'endTime' });
                    setIsLabelModalOpen(false);
                } : undefined}
                mode="label"
                position={labelModalPosition}
            />
            <HeaderPhaseDropdown
                isOpen={phaseDropdownOpen}
                onClose={() => setPhaseDropdownOpen(false)}
                phases={phases}
                onJump={handleNavJump}
                isCollapsed={phaseColumnCollapsed}
                onToggleCollapse={handleTogglePhaseCollapse}
                triggerRef={phaseHeaderRef}
            />
            <HeaderGimmickDropdown
                isOpen={gimmickDropdownOpen}
                onClose={() => setGimmickDropdownOpen(false)}
                labels={labels}
                onJump={handleNavJump}
                triggerRef={gimmickHeaderRef}
                isCollapsed={labelColumnCollapsed}
                onToggleCollapse={handleToggleLabelCollapse}
            />
            <HeaderTimeInput
                isOpen={timeInputOpen}
                onClose={() => setTimeInputOpen(false)}
                onJump={handleNavJump}
                triggerRef={timeHeaderRef}
                maxTime={maxTime}
            />
            <HeaderMechanicSearch
                isOpen={mechanicSearchOpen}
                onClose={() => setMechanicSearchOpen(false)}
                events={timelineEvents}
                phases={phases}
                onJump={handleNavJump}
                triggerRef={mechanicHeaderRef}
            />

            {/* ── モバイル軽減一覧シート: 全メンバーの軽減を一画面で表示 ── */}
            {mobileMitiFlow.isOpen && (
                <div className="fixed inset-0 z-[11000]" onClick={() => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }))}>
                    {/* 半透明背景 */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
                    {/* ボトムシート — ボトムナビの上に配置（safe-area含む） */}
                    <div
                        className={clsx(
                            "absolute left-0 right-0 max-h-[50vh] rounded-t-2xl flex flex-col overflow-hidden",
                            "bg-app-bg border-t border-app-border shadow-lg"
                        )}
                        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ドラッグハンドル */}
                        <div className="flex justify-center pt-2 pb-1">
                            <div className="w-10 h-1 rounded-full bg-app-border" />
                        </div>
                        {/* ヘッダー: 時間 + イベント名 */}
                        <div className="px-4 pb-2 flex items-center justify-between">
                            <div>
                                <span className="text-app-base font-black text-app-text-muted uppercase tracking-widest">{t('timeline.add_mitigation_here')}</span>
                                <div className="text-app-md text-app-text font-mono">
                                    {(() => {
                                        const flowTime = mobileMitiFlow.time;
                                        const eventsAtTime = timelineEvents.filter(e => e.time === flowTime);
                                        const timeStr = Math.floor(Math.abs(flowTime) / 60) + ':' + (Math.abs(flowTime) % 60).toString().padStart(2, '0');
                                        const eventName = eventsAtTime.length > 0
                                            ? (eventsAtTime[0].name ? getPhaseName(eventsAtTime[0].name, contentLanguage) : null)
                                            : null;
                                        return <>{timeStr}{eventName ? ` — ${eventName}` : ''}</>;
                                    })()}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* この時間に配置済みの軽減アイコン（多い場合は小さく2段に） */}
                                {(() => {
                                    const placed = timelineMitigations.filter(am => am.time === mobileMitiFlow.time);
                                    const isCompact = placed.length >= 6;
                                    const iconSize = isCompact ? "w-3.5 h-3.5" : "w-5 h-5";
                                    return (
                                        <div className={clsx("flex items-center gap-px", isCompact && "flex-wrap max-w-[120px] justify-end")}>
                                            {placed.map(am => {
                                                const def = MITIGATIONS.find(m => m.id === am.mitigationId);
                                                if (!def) return null;
                                                return <img key={am.id} src={def.icon} className={clsx(iconSize, "rounded-sm object-contain opacity-80")} />;
                                            })}
                                        </div>
                                    );
                                })()}
                                <button onClick={() => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }))} className="p-1.5 rounded-lg bg-app-surface2 text-app-text cursor-pointer ml-1 shrink-0">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        {/* 全メンバーの軽減を5列でフラット表示（MT→D4の順） */}
                        <div className="flex-1 overflow-y-auto px-2 pb-4">
                            <div className="grid grid-cols-5 gap-1.5">
                                {(() => {
                                    // 全メンバーの軽減スキルを収集
                                    const allItems: { member: typeof partyMembers[0]; job: typeof JOBS[0]; mit: typeof MITIGATIONS[0] }[] = [];
                                    for (const member of sortedPartyMembers) {
                                        const job = JOBS.find(j => j.id === member.jobId);
                                        if (!job) continue;
                                        const mitis = MITIGATIONS.filter(m =>
                                            m.jobId === job.id
                                            && !m.hidden
                                            && (!m.minLevel || m.minLevel <= currentLevel)
                                            && (!m.maxLevel || m.maxLevel >= currentLevel)
                                        );
                                        for (const mit of mitis) {
                                            allItems.push({ member, job, mit });
                                        }
                                    }

                                    // ── 並び順ルール ──
                                    // 1. 全体軽減（scope:party）をリキャスト短い順、同名スキルはグループ化
                                    // 2. ロール順: タンク→ヒーラー→DPS(1234)
                                    // 3. 最後にヒーラー単体ケア → タンク個別軽減
                                    const roleOrder: Record<string, number> = { tank: 0, healer: 1, dps: 2 };

                                    // カテゴリ分類: 0=全体軽減, 1=ヒーラー単体, 2=タンク個別, 3=DPSその他
                                    // ※ 大半のスキルにscopeが未設定のため、明示的にself/targetのもの以外は全体扱い
                                    const getCategory = (item: typeof allItems[0]) => {
                                        const scope = item.mit.scope;
                                        const role = item.job.role;
                                        // ヒーラー単体ケア（scope: target が明示されたヒーラースキル）
                                        if (role === 'healer' && scope === 'target') return 1;
                                        // タンク個別軽減（scope: self/target が明示されたタンクスキル）
                                        if (role === 'tank' && (scope === 'self' || scope === 'target')) return 2;
                                        // DPS自己防衛（scope: self が明示されたDPSスキル）
                                        if (role === 'dps' && scope === 'self') return 3;
                                        // それ以外は全て全体軽減（scope:party、scope未設定の大半のスキル含む）
                                        return 0;
                                    };

                                    // 全体軽減のグループキー（同名スキルをまとめるためスキル名を使用）
                                    const getGroupKey = (mit: typeof MITIGATIONS[0]) => mit.name?.ja || mit.id;

                                    allItems.sort((a, b) => {
                                        const catA = getCategory(a);
                                        const catB = getCategory(b);
                                        if (catA !== catB) return catA - catB;

                                        if (catA === 0) {
                                            // 全体軽減: ロール順（タンク→ヒーラー→DPS）が最優先
                                            const rA = roleOrder[a.job.role] ?? 9;
                                            const rB = roleOrder[b.job.role] ?? 9;
                                            if (rA !== rB) return rA - rB;
                                            // 同ロール内: スキル名でグループ化
                                            const gA = getGroupKey(a.mit);
                                            const gB = getGroupKey(b.mit);
                                            if (gA !== gB) {
                                                // 異なるスキル: リキャスト短い順
                                                if (a.mit.recast !== b.mit.recast) return a.mit.recast - b.mit.recast;
                                                return gA.localeCompare(gB);
                                            }
                                            // 同スキル名: メンバー順（MT→ST等）
                                            return (PARTY_MEMBER_ORDER[a.member.id] ?? 9) - (PARTY_MEMBER_ORDER[b.member.id] ?? 9);
                                        }

                                        // ヒーラー単体 / タンク個別 / その他: 同名グループ化 → リキャスト短い順 → メンバー順
                                        const gA = getGroupKey(a.mit);
                                        const gB = getGroupKey(b.mit);
                                        if (gA !== gB) {
                                            if (a.mit.recast !== b.mit.recast) return a.mit.recast - b.mit.recast;
                                            return gA.localeCompare(gB);
                                        }
                                        return (PARTY_MEMBER_ORDER[a.member.id] ?? 9) - (PARTY_MEMBER_ORDER[b.member.id] ?? 9);
                                    });

                                    // 同名スキルが複数メンバーに存在するか事前計算
                                    const skillNameCount = new Map<string, number>();
                                    for (const item of allItems) {
                                        const name = item.mit.name?.ja || '';
                                        skillNameCount.set(name, (skillNameCount.get(name) || 0) + 1);
                                    }

                                    return allItems.map(({ member, job, mit }) => {
                                        const memberMitis = timelineMitigations.filter(m => m.ownerId === member.id);
                                        const isAlreadyPlaced = memberMitis.some(am => am.mitigationId === mit.id && am.time === mobileMitiFlow.time);
                                        const status = validateMitigationPlacement(
                                            mit, mobileMitiFlow.time, memberMitis, t
                                        );
                                        // スマホ: 競合警告時も配置不可にする（PCではwarningでも配置可能）
                                        const isClickable = (status.available && !status.warning) || isAlreadyPlaced;
                                        // 同名スキルが複数メンバーにある場合のみジョブバッジ表示
                                        const isDuplicate = (skillNameCount.get(mit.name?.ja || '') || 0) > 1;

                                        return (
                                            <button
                                                key={`${member.id}-${mit.id}`}
                                                disabled={!isClickable}
                                                onClick={() => {
                                                    if (isAlreadyPlaced) {
                                                        const amToRemove = memberMitis.find(am => am.mitigationId === mit.id && am.time === mobileMitiFlow.time);
                                                        if (amToRemove) removeMitigation(amToRemove.id);
                                                        return;
                                                    }
                                                    if (!status.available) return;
                                                    addMitigation({
                                                        id: genId(),
                                                        mitigationId: mit.id,
                                                        time: mobileMitiFlow.time,
                                                        duration: mit.duration,
                                                        ownerId: member.id,
                                                    });
                                                }}
                                                className={clsx(
                                                    "aspect-square rounded-xl border flex items-center justify-center relative transition-all active:scale-90",
                                                    isAlreadyPlaced
                                                        ? "bg-app-text/20 border-app-text"
                                                        : status.warning
                                                            ? "bg-amber-400/10 border-amber-400 opacity-60"
                                                            : status.available
                                                                ? "bg-app-surface2 border-app-border"
                                                                : "bg-black/20 border-red-500/60 opacity-60"
                                                )}
                                            >
                                                <img src={mit.icon} className="w-9 h-9 object-contain rounded" />
                                                {/* リキャスト/使用不可メッセージ — アイコン中央にオーバーレイ */}
                                                {!status.available && !isAlreadyPlaced && status.message && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                                                        <span className="text-[10px] leading-tight font-bold text-red-400 text-center px-0.5">
                                                            {status.message}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* リキャスト競合警告 — 配置可能だが将来の配置と被る */}
                                                {status.warning && (status.shortMessage || status.message) && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                                                        <span className="text-[10px] leading-tight font-bold text-amber-400 text-center px-0.5">
                                                            {status.shortMessage || status.message}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* 同名スキルが複数メンバーにある場合のみジョブバッジ */}
                                                {isDuplicate && (
                                                    <img
                                                        src={job.icon}
                                                        className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full object-contain"
                                                    />
                                                )}
                                                {isAlreadyPlaced && (
                                                    <div className="absolute top-1 right-1">
                                                        <X size={12} className="text-app-text drop-shadow-sm" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
            />

            <JobPicker
                isOpen={jobPickerOpen}
                onClose={() => setJobPickerOpen(false)}
                onSelect={handleJobSelect}
                position={jobPickerPosition}
                currentJobId={jobPickerMemberId ? partyMembers.find(m => m.id === jobPickerMemberId)?.jobId || null : null}
            />

            {/* PC版のみ: PartySettingsModal（モバイルはLayout.tsxのMobileBottomSheetで表示） */}
            {!isMobileView && (
                <PartySettingsModal
                    isOpen={partySettingsOpen}
                    onClose={() => setPartySettingsOpen(false)}
                />
            )}

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
                confirmLabel={t('ui.ok', 'OK')}
                cancelLabel={t('common.cancel', 'キャンセル')}
            />
            <MobileBottomSheet
                isOpen={mobileToolsSheetOpen}
                onClose={() => setMobileToolsSheetOpen(false)}
                title={t('mobile.tools_title')}
                height="55vh"
            >
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <button
                            onClick={() => useMitigationStore.getState().undo()}
                            disabled={!canUndo}
                            className={clsx(
                                "px-3 py-2.5 rounded-xl border  cursor-pointer",
                                "bg-app-surface2 border-app-border text-app-text"
                            )}
                        >
                            <Undo2 size={16} />
                        </button>
                        <button
                            onClick={() => useMitigationStore.getState().redo()}
                            disabled={!canRedo}
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
                            <div className="text-app-2xl font-bold">FFLogs Import</div>
                            <div className="text-app-base text-app-text-muted">{t('mobile.fflogs_desc')}</div>
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
                            <div className="text-app-2xl font-bold">Auto Plan</div>
                            <div className="text-app-base text-app-text-muted">{t('mobile.autoplan_desc')}</div>
                        </div>
                    </button>
                    {/* Popular Plans — みんなの軽減表ボトムシートを開く */}
                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            setIsMitiSheetOpen(true);
                        }}
                        className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border border-app-border hover:bg-app-surface2 transition-colors"
                    >
                        <div>
                            <p className="text-app-2xl font-bold text-app-text">{t('popular.open_popular')}</p>
                            <p className="text-app-lg text-app-text-muted">{t('popular.subtitle')}</p>
                        </div>
                    </button>
                </div>
            </MobileBottomSheet>
            <MitigationSheet
                isOpen={isMitiSheetOpen}
                onClose={() => setIsMitiSheetOpen(false)}
                currentContentId={currentContentId}
            />
            {phasePopover && createPortal(
                <div
                    className="fixed inset-0 z-[9998] md:bg-transparent bg-black/50 md:backdrop-blur-none backdrop-blur-[2px]"
                    onClick={() => setPhasePopover(null)}
                >
                    <div
                        className={clsx(
                            "min-w-[200px] rounded-xl py-1.5 glass-tier3 glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
                            "md:static md:absolute md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:w-auto"
                        )}
                        style={{
                            ...(window.innerWidth >= 768 ? {
                                left: Math.min(phasePopover.position.x, window.innerWidth - 220),
                                top: Math.min(phasePopover.position.y, window.innerHeight - 200),
                                transform: 'none',
                                position: 'absolute',
                            } : {})
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => {
                                handlePhaseEdit(phasePopover.phase, { stopPropagation: () => {}, clientX: phasePopover.position.x, clientY: phasePopover.position.y } as React.MouseEvent);
                                setPhasePopover(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer text-app-text hover:bg-app-surface2"
                        >
                            <Pencil size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.phase_edit')}</span>
                        </button>
                        <button
                            onClick={() => {
                                const clickTime = phasePopover.clickTime;
                                setPhasePopover(null);
                                setPhaseModalPosition(phasePopover.position);
                                setSelectedPhaseTime(clickTime);
                                setSelectedPhase(null);
                                setIsPhaseModalOpen(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer text-app-text hover:bg-app-surface2"
                        >
                            <Plus size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.phase_add_here')}</span>
                        </button>
                        <div className="h-px mx-3 my-1 bg-app-border" />
                        <button
                            onClick={() => {
                                removePhase(phasePopover.phase.id);
                                setPhasePopover(null);
                            }}
                            className="flex items-center gap-3 mx-1.5 px-3 py-2 text-app-2xl font-medium transition-colors cursor-pointer rounded-lg text-red-500 hover:bg-red-500/10"
                        >
                            <Trash2 size={15} className="shrink-0" />
                            <span>{t('timeline.phase_delete')}</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}
            {labelPopover && createPortal(
                <div
                    className="fixed inset-0 z-[9998] md:bg-transparent bg-black/50 md:backdrop-blur-none backdrop-blur-[2px]"
                    onClick={() => setLabelPopover(null)}
                >
                    <div
                        className={clsx(
                            "min-w-[200px] rounded-xl py-1.5 glass-tier3 glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
                            "md:static md:absolute md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:w-auto"
                        )}
                        style={{
                            ...(window.innerWidth >= 768 ? {
                                left: Math.min(labelPopover.position.x, window.innerWidth - 220),
                                top: Math.min(labelPopover.position.y, window.innerHeight - 200),
                                transform: 'none',
                                position: 'absolute',
                            } : {})
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => {
                                handleLabelEdit(labelPopover.label, { stopPropagation: () => {}, clientX: labelPopover.position.x, clientY: labelPopover.position.y } as React.MouseEvent);
                                setLabelPopover(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer text-app-text hover:bg-app-surface2"
                        >
                            <Pencil size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.label_edit')}</span>
                        </button>
                        <button
                            onClick={() => {
                                const clickTime = labelPopover.clickTime;
                                setLabelPopover(null);
                                setLabelModalPosition(labelPopover.position);
                                setSelectedLabelTime(clickTime);
                                setSelectedLabel(null);
                                setIsLabelModalOpen(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer text-app-text hover:bg-app-surface2"
                        >
                            <Plus size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.label_add_here')}</span>
                        </button>
                        <div className="h-px mx-3 my-1 bg-app-border" />
                        <button
                            onClick={() => {
                                removeLabel(labelPopover.label.id);
                                setLabelPopover(null);
                            }}
                            className="flex items-center gap-3 mx-1.5 px-3 py-2 text-app-2xl font-medium transition-colors cursor-pointer rounded-lg text-red-500 hover:bg-red-500/10"
                        >
                            <Trash2 size={15} className="shrink-0" />
                            <span>{t('timeline.label_delete')}</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}
            {eventPopover && createPortal(
                <div
                    className="fixed inset-0 z-[9998] md:bg-transparent bg-black/50 md:backdrop-blur-none backdrop-blur-[2px]"
                    onClick={() => setEventPopover(null)}
                >
                    <div
                        className={clsx(
                            "min-w-[200px] rounded-xl py-1.5 glass-tier3 glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                            // モバイル: 画面中央、PC: クリック位置
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
                            "md:static md:absolute md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:w-auto"
                        )}
                        style={{
                            // PCのみ位置を適用
                            ...(window.innerWidth >= 768 ? {
                                left: Math.min(eventPopover.position.x, window.innerWidth - 220),
                                top: Math.min(eventPopover.position.y, window.innerHeight - 160),
                                transform: 'none',
                                position: 'absolute',
                            } : {})
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={handlePopoverEdit}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer",
                                "text-app-text hover:bg-app-surface2"
                            )}
                        >
                            <Pencil size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.event_edit')}</span>
                        </button>
                        <button
                            onClick={handlePopoverAdd}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer",
                                "text-app-text hover:bg-app-surface2"
                            )}
                        >
                            <Plus size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.event_add_here')}</span>
                        </button>
                        {/* モバイルのみ: 軽減追加ショートカット */}
                        {typeof window !== 'undefined' && window.innerWidth < 768 && (
                            <button
                                onClick={() => {
                                    const time = eventPopover.event.time;
                                    setEventPopover(null);
                                    setMobilePartyOpen(false);
                                    setMobileToolsOpen(false);
                                    setMobileMenuOpen(false);
                                    setMobileMitiFlow({ isOpen: true, time, step: 'job', selectedMemberId: null });
                                }}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer",
                                    "text-app-text hover:bg-app-surface2"
                                )}
                            >
                                <Plus size={15} className="text-app-text shrink-0" />
                                <span>{t('timeline.add_mitigation_here')}</span>
                            </button>
                        )}
                        <div className={clsx("h-px mx-3 my-1", "bg-app-border")} />
                        <button
                            onClick={handlePopoverDelete}
                            className={clsx(
                                "flex items-center gap-3 mx-1.5 px-3 py-2 text-app-2xl font-medium transition-colors cursor-pointer rounded-lg",
                                "text-red-500 hover:bg-red-500/10"
                            )}
                        >
                            <Trash2 size={15} className="shrink-0" />
                            <span>{t('timeline.event_delete')}</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* AA 配置モード フローティングバー */}
            {createPortal(
                <div className={clsx(
                    "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
                    "bg-app-bg border border-app-text/15 rounded-2xl",
                    "shadow-[0_8px_32px_rgba(0,0,0,.6)]",
                    "transition-all duration-300",
                    isAaModeEnabled
                        ? "opacity-100 -translate-x-1/2 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-x-1/2 translate-y-10 pointer-events-none"
                )}>
                    {/* 現在の設定ラベル */}
                    <span className="text-app-md font-black text-app-text whitespace-nowrap">
                        <Sword size={12} className="inline mr-1.5 -mt-0.5" />
                        {t('aa_settings.floating_label', {
                            damage: aaSettings.damage.toLocaleString(),
                            target: aaSettings.target,
                            type: t(`aa_settings.${aaSettings.type === 'magical' ? 'magic' : aaSettings.type === 'physical' ? 'phys' : 'dark'}`)
                        })}
                    </span>
                    <div className="w-px h-5 bg-app-text/10 shrink-0" />
                    {/* 設定変更ボタン */}
                    <button
                        onClick={() => setAaSettingsOpen(true)}
                        className="py-1.5 px-3 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                        <Settings size={12} className="inline mr-1 -mt-0.5" />
                        {t('aa_settings.change_settings')}
                    </button>
                    <div className="w-px h-5 bg-app-text/10 shrink-0" />
                    {/* 終了ボタン */}
                    <button
                        onClick={() => setIsAaModeEnabled(false)}
                        className="py-1.5 px-3 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                        <X size={12} className="inline mr-1 -mt-0.5" />
                        {t('aa_settings.end_mode')}
                    </button>
                </div>,
                document.body
            )}

            {/* TL選択モード フローティングバー */}
            {createPortal(
                <div className={clsx(
                    "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
                    "bg-app-bg border border-app-blue/30 rounded-2xl",
                    "shadow-[0_8px_32px_rgba(0,0,0,.6)]",
                    "transition-all duration-300",
                    (timelineSelectMode || labelSelectMode)
                        ? "opacity-100 -translate-x-1/2 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-x-1/2 translate-y-10 pointer-events-none"
                )}>
                    <Crosshair size={14} className="text-app-blue shrink-0" />
                    <span className="text-app-md font-black text-app-text whitespace-nowrap">
                        {(timelineSelectMode?.field === 'startTime' || labelSelectMode?.field === 'startTime')
                            ? t('boundary_modal.select_banner_start')
                            : t('boundary_modal.select_banner')}
                    </span>
                    <div className="w-px h-5 bg-app-text/10 shrink-0" />
                    <button
                        onClick={() => {
                            if (timelineSelectMode) {
                                setTimelineSelectMode(null);
                                throttledUpdatePreview(null);
                            }
                            if (labelSelectMode) {
                                setLabelSelectMode(null);
                                throttledUpdatePreview(null);
                            }
                        }}
                        className="py-1.5 px-3 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                        <X size={12} className="inline mr-1 -mt-0.5" />
                        {t('modal.cancel')}
                    </button>
                </div>,
                document.body
            )}

            {/* PiP カンペビュー — 別窓にReactPortalでレンダリング */}
            {pipContainer && createPortal(
                <React.Suspense fallback={null}>
                    <PipView mode="pip" onClose={handleClosePip} />
                </React.Suspense>,
                pipContainer
            )}
        </>
    );
};

export default Timeline;