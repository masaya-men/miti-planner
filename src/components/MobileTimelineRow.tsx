import React, { memo } from 'react';
import clsx from 'clsx';
import type { PartyMember, TimelineEvent, AppliedMitigation } from '../types';
import { getPhaseName } from '../types';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import { useMitigationStore } from '../store/useMitigationStore';

interface DamageInfo {
    unmitigated: number;
    mitigated: number;
    mitigationPercent: number;
    shieldTotal: number;
    isInvincible?: boolean;
    mitigationStates?: Record<string, { stacks?: number }>;
}

interface MobileTimelineRowProps {
    time: number;
    top: number;
    damages: (DamageInfo | null)[];
    events: TimelineEvent[];
    partyMembers: PartyMember[];
    activeMitigations: AppliedMitigation[];
    onMobileDamageClick?: (time: number, e: React.MouseEvent) => void;
    onLongPress?: (event: TimelineEvent, time: number) => void;
    phaseColumnCollapsed?: boolean;
    hasPhases?: boolean;
    timelineSelectMode?: { phaseId: string; startTime: number } | null;
    labelSelectMode?: { labelId: string; startTime: number } | null;
    previewEndTime?: number | null;
    onTimelineSelect?: (time: number) => void;
    onTimelineSelectHover?: (time: number) => void;
    /** 表示するイベントのインデックス（複数イベント時に1つだけ表示） */
    eventIndex?: number;
    /** true の場合、時間の代わりに「〃」を表示し背景を少し変える */
    isSecondEvent?: boolean;
}

/** ダメージ値を短縮表示 */
const formatDmg = (val: number): string => {
    if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return String(val);
};

/** 対象バッジ（AoE以外） */
const TargetBadge: React.FC<{ event: TimelineEvent; partyMembers: PartyMember[] }> = ({ event, partyMembers }) => {
    const JOBS = useJobs();
    if (event.target === 'AoE') return null;
    const member = partyMembers.find(m => m.id === event.target);
    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
    if (job) {
        return (
            <span className="inline-flex items-center gap-0.5 px-1 py-px rounded-md bg-app-text/5 flex-shrink-0">
                <img src={job.icon} className="w-3.5 h-3.5 rounded flex-shrink-0" alt={event.target ?? ''} />
            </span>
        );
    }
    return (
        <span className={clsx(
            "text-[9px] font-black px-1 py-px rounded-md flex-shrink-0",
            event.target === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10"
        )}>
            {event.target}
        </span>
    );
};

/** 軽減スキルアイコン列（22px） */
const MitiIcons: React.FC<{
    mitigations: AppliedMitigation[];
    contentLanguage: string;
    myJobHighlight: boolean;
    myMemberId: string | null;
}> = ({ mitigations, contentLanguage, myJobHighlight, myMemberId }) => {
    const MITIGATIONS = useMitigations();
    if (mitigations.length === 0) return null;
    return (
        <div className="flex items-center gap-px flex-shrink-0 ml-auto">
            {mitigations.map(mit => {
                const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
                if (!def) return null;
                const isDimmed = myJobHighlight && myMemberId && mit.ownerId !== myMemberId;
                return (
                    <img
                        key={mit.id}
                        src={def.icon}
                        alt={def.name ? getPhaseName(def.name, contentLanguage) : ''}
                        className={clsx(
                            "w-[22px] h-[22px] object-cover rounded-md",
                            isDimmed ? "opacity-40 grayscale" : "opacity-90"
                        )}
                    />
                );
            })}
        </div>
    );
};

export const MobileTimelineRow = memo(({
    time,
    top,
    damages,
    events,
    partyMembers,
    activeMitigations,
    onMobileDamageClick,
    onLongPress,
    hasPhases: _hasPhases = true,
    phaseColumnCollapsed,
    timelineSelectMode,
    labelSelectMode,
    previewEndTime,
    onTimelineSelect,
    onTimelineSelectHover,
    eventIndex,
    isSecondEvent,
}: MobileTimelineRowProps) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const myJobHighlight = useMitigationStore(state => state.myJobHighlight);
    const myMemberId = useMitigationStore(state => state.myMemberId);

    // 表示するイベントとダメージを決定
    const idx = eventIndex ?? 0;
    const event = events[idx] as TimelineEvent | undefined;
    const damage = damages[idx] as DamageInfo | null | undefined;

    const getEventName = (ev: TimelineEvent) =>
        ev.name ? getPhaseName(ev.name, contentLanguage) : '';

    // 時間フォーマット
    const displayTimeStr = Math.floor(Math.abs(time) / 60) + ':' + (Math.abs(time) % 60).toString().padStart(2, '0');
    const formattedTime = time < 0 && time > -60
        ? `-0:${(Math.abs(time) % 60).toString().padStart(2, '0')}`
        : time < 0 ? `-${displayTimeStr}` : displayTimeStr;

    // 致死判定
    const isLethal = (() => {
        if (!event || !damage || damage.unmitigated <= 0) return false;
        let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
        if (event.target === 'MT' || event.target === 'ST') {
            maxHp = partyMembers.find(m => m.id === event.target)?.stats.hp || 1;
        }
        return damage.mitigated >= maxHp;
    })();

    // TL選択ハイライト
    const isHighlighted = timelineSelectMode
        && previewEndTime !== null
        && time >= timelineSelectMode.startTime
        && time <= (previewEndTime ?? 0);

    const isLabelHighlighted = labelSelectMode
        && previewEndTime !== null
        && time >= labelSelectMode.startTime
        && time <= (previewEndTime ?? 0);

    const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);
    const isLongPressRef = React.useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        isLongPressRef.current = false;

        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            if (onLongPress && events.length > 0) {
                try { navigator.vibrate(10); } catch {}
                onLongPress(events[0], time);
            }
        }, 300);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartPosRef.current) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
        if (dx > 5 || dy > 5) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        touchStartPosRef.current = null;
    };

    const handleTap = (e: React.MouseEvent) => {
        if (isLongPressRef.current) {
            isLongPressRef.current = false;
            return;
        }
        if (timelineSelectMode || labelSelectMode) {
            onTimelineSelect?.(time);
            e.stopPropagation();
            return;
        }
        if (onMobileDamageClick && events.length > 0) {
            onMobileDamageClick(time, e);
        }
    };

    return (
        <div
            data-time-row={time}
            className={clsx(
                "absolute left-0 w-full h-[80px]",
                "active:bg-app-text/[0.03] transition-colors duration-100",
                (isHighlighted || isLabelHighlighted) && "bg-app-blue/10",
                (timelineSelectMode || labelSelectMode) && "cursor-pointer"
            )}
            style={{ top: `${top}px` }}
            onClick={handleTap}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseEnter={() => {
                if (timelineSelectMode || labelSelectMode) {
                    onTimelineSelectHover?.(time);
                }
            }}
        >
            <div className="h-full flex">
                {/* 左: フェーズ/ラベル列 (24px) — 常に表示 */}
                {!phaseColumnCollapsed && (
                    <div className="w-[24px] min-w-[24px] h-full flex items-center justify-center opacity-40" />
                )}

                {/* 右: コンテンツエリア + Apple風インセット区切り線 */}
                <div className="flex-1 min-w-0 flex flex-col justify-center px-3 gap-0.5 relative">
                    {/* インセット区切り線 — 2つ目のイベント行は表示しない（連続感） */}
                    {!isSecondEvent && (
                        <div className="absolute bottom-0 left-3 right-0 h-px bg-app-text/[0.06]" />
                    )}
                {/* 上段: 時間 + 種別アイコン + 攻撃名 + 対象バッジ */}
                <div className="flex items-center gap-1.5 min-w-0">
                    {/* 時間 or 〃 */}
                    <span className={clsx(
                        "font-mono text-[15px] leading-none flex-shrink-0",
                        isSecondEvent ? "text-app-text-muted opacity-50" : "text-app-text opacity-50"
                    )}>
                        {isSecondEvent ? t('app.mobile_same_time') : formattedTime}
                    </span>

                    {/* 種別アイコン (角丸四角) */}
                    {event?.damageType === 'magical' && (
                        <img src="/icons/type_magic.png" className="w-4 h-4 rounded opacity-90 flex-shrink-0" alt={t('modal.magical')} />
                    )}
                    {event?.damageType === 'physical' && (
                        <img src="/icons/type_phys.png" className="w-4 h-4 rounded opacity-90 flex-shrink-0" alt={t('modal.physical')} />
                    )}
                    {event?.damageType === 'unavoidable' && (
                        <img src="/icons/type_dark.png" className="w-4 h-4 rounded opacity-90 flex-shrink-0" alt={t('modal.unique')} />
                    )}

                    {/* 攻撃名 */}
                    {event && (
                        <span className="text-[15px] font-black text-app-text truncate leading-none min-w-0">
                            {getEventName(event)}
                        </span>
                    )}

                    {/* 対象バッジ */}
                    {event && (
                        <TargetBadge event={event} partyMembers={partyMembers} />
                    )}
                </div>

                {/* 下段: 軽減前ダメージ → 軽減後ダメージ + 軽減% + スキルアイコン */}
                <div className="flex items-center gap-1.5 min-w-0">
                    {damage && damage.unmitigated > 0 ? (
                        <>
                            {/* 軽減前ダメージ */}
                            <span className="font-mono text-[13px] text-app-text opacity-30 leading-none flex-shrink-0">
                                {formatDmg(damage.unmitigated)}
                            </span>

                            <span className="text-app-text-muted opacity-30 text-[11px] flex-shrink-0">→</span>

                            {/* 軽減後ダメージ */}
                            <span className={clsx(
                                "font-mono text-[13px] font-black leading-none flex-shrink-0",
                                isLethal
                                    ? "text-red-500"
                                    : "text-green-500"
                            )}>
                                {formatDmg(damage.mitigated)}
                            </span>

                            {/* 致死バッジ */}
                            {/* 軽減% */}
                            {damage.mitigationPercent > 0 && !isLethal && (
                                <span className="font-mono text-[11px] text-app-text opacity-25 leading-none flex-shrink-0">
                                    {damage.mitigationPercent}%
                                </span>
                            )}

                            {/* 無敵 */}
                            {damage.isInvincible && (
                                <span className="text-[9px] font-black text-app-text-sec px-1 py-px rounded-md bg-app-text/5 flex-shrink-0">
                                    {t('timeline.invuln', 'Invuln')}
                                </span>
                            )}
                        </>
                    ) : (
                        /* ダメージなし時のスペーサー */
                        <span className="text-[13px] leading-none">&nbsp;</span>
                    )}

                    {/* 軽減スキルアイコン (22px, 右寄せ) */}
                    <MitiIcons
                        mitigations={activeMitigations}
                        contentLanguage={contentLanguage}
                        myJobHighlight={myJobHighlight}
                        myMemberId={myMemberId}
                    />
                </div>
            </div>
            </div>{/* カード本体 end */}
        </div>
    );
}, (prevProps, nextProps) => {
    if (prevProps.time !== nextProps.time) return false;
    if (prevProps.top !== nextProps.top) return false;
    if (prevProps.events !== nextProps.events) return false;
    if (prevProps.damages !== nextProps.damages) return false;
    if (prevProps.partyMembers !== nextProps.partyMembers) return false;
    if (prevProps.eventIndex !== nextProps.eventIndex) return false;
    if (prevProps.isSecondEvent !== nextProps.isSecondEvent) return false;
    if (prevProps.onLongPress !== nextProps.onLongPress) return false;
    if (prevProps.activeMitigations !== nextProps.activeMitigations) {
        if (prevProps.activeMitigations.length !== nextProps.activeMitigations.length) return false;
        for (let i = 0; i < prevProps.activeMitigations.length; i++) {
            if (prevProps.activeMitigations[i] !== nextProps.activeMitigations[i]) return false;
        }
    }
    return true;
});
