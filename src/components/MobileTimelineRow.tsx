import React, { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { PartyMember, TimelineEvent, AppliedMitigation } from '../types';
import { getPhaseName } from '../types';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import { useMitigationStore } from '../store/useMitigationStore';
import { SCALE, SPRING } from '../tokens/motionTokens';
import { AnimatedDamage } from './AnimatedDamage';
import { DamageTypeIcon } from './DamageTypeIcon';
import { getEffectiveTarget } from '../utils/effectiveTarget';
import { PARTY_MEMBER_IDS } from '../constants/party';

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
    onLongPress?: (event: TimelineEvent | null, time: number) => void;
    phaseColumnCollapsed?: boolean;
    hasPhases?: boolean;
    timelineSelectMode?: { phaseId: string; startTime: number } | null;
    labelSelectMode?: { labelId: string; startTime: number } | null;
    onTimelineSelect?: (time: number) => void;
    onTimelineSelectHover?: (time: number) => void;
    /** 表示するイベントのインデックス（複数イベント時に1つだけ表示） */
    eventIndex?: number;
    /** true の場合、背景を少し変える(同時刻2件目) */
    isSecondEvent?: boolean;
    /** true の場合、下部区切り線を出さない(同時刻2件の1件目・2件目との間の罫線を消すため) */
    hideBottomDivider?: boolean;
    /** 行の高さ (pixelsPerSecond) */
    rowHeight?: number;
}

/** ダメージ値を短縮表示 */
const formatDmg = (val: number): string => {
    if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return String(val);
};

/** 対象バッジ（AoE以外）。effTarget = 挑発考慮済みの実効ターゲット */
const TargetBadge: React.FC<{ effTarget: TimelineEvent['target']; partyMembers: PartyMember[] }> = ({ effTarget, partyMembers }) => {
    const JOBS = useJobs();
    if (effTarget === 'AoE') return null;
    const member = partyMembers.find(m => m.id === effTarget);
    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
    if (job) {
        return (
            <span className="inline-flex items-center gap-0.5 px-1 py-px rounded-md bg-app-text/5 flex-shrink-0">
                <img src={job.icon} className="w-3.5 h-3.5 rounded flex-shrink-0" alt={effTarget ?? ''} />
            </span>
        );
    }
    return (
        <span className={clsx(
            "text-[9px] font-black px-1 py-px rounded-md flex-shrink-0",
            effTarget === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10"
        )}>
            {effTarget}
        </span>
    );
};

/** 軽減スキルアイコン列（専用行・フル幅・18px・使用者ごとにグルーピング表示） */
const MitiIcons: React.FC<{
    mitigations: AppliedMitigation[];
    contentLanguage: string;
    myMemberId: string | null;
}> = ({ mitigations, contentLanguage, myMemberId }) => {
    const MITIGATIONS = useMitigations();
    if (mitigations.length === 0) return null;

    // 表示順は常に MT→ST→H1→H2→D1〜D4 固定(PARTY_MEMBER_IDS)。PC の並び替え設定
    // (partySortOrder='light_party' 等)の影響を受けない — スマホは常に同じ並びにする。
    const groups: { key: string; items: AppliedMitigation[] }[] = PARTY_MEMBER_IDS
        .map(id => ({ key: id, items: mitigations.filter(m => m.ownerId === id) }))
        .filter(g => g.items.length > 0);
    const knownIds = new Set<string>(PARTY_MEMBER_IDS);
    const orphan = mitigations.filter(m => !knownIds.has(m.ownerId));
    if (orphan.length > 0) groups.push({ key: 'orphan', items: orphan });

    return (
        // 同じ人のアイコン同士はほぼ密着(gap-px=1px)、人が変わるところだけ gap-1.5(6px)空ける。
        // 「ぴったりくっつく」ためには同グループ内の隙間をほぼ0にする必要があった。
        <div className="flex items-center gap-1.5 flex-wrap">
            {groups.map(group => (
                <div key={group.key} className="flex items-center gap-px">
                    {group.items.map(mit => {
                        const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
                        if (!def) return null;
                        // 薄暗くは親 .timeline-scroll-container[data-myjob-highlight] + CSS が担当（myJobHighlight 非購読）。
                        const isNotMine = !!myMemberId && mit.ownerId !== myMemberId;
                        return (
                            <img
                                key={mit.id}
                                src={def.icon}
                                alt={def.name ? getPhaseName(def.name, contentLanguage) : ''}
                                data-myjob-dim={isNotMine ? 'gray' : undefined}
                                className="w-[22px] h-[22px] object-cover rounded-md opacity-90"
                            />
                        );
                    })}
                </div>
            ))}
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
    phaseColumnCollapsed: _phaseColumnCollapsed,
    timelineSelectMode,
    labelSelectMode,
    onTimelineSelect,
    onTimelineSelectHover,
    eventIndex,
    isSecondEvent,
    hideBottomDivider,
    rowHeight = 80,
}: MobileTimelineRowProps) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const myMemberId = useMitigationStore(state => state.myMemberId);
    const timelineMitigations = useMitigationStore(state => state.timelineMitigations);
    const phases = useMitigationStore(state => state.phases);
    const MITIGATIONS = useMitigations();

    // 挑発（isTankSwap）マーカーのみ抽出。空なら既存挙動と完全一致。毎レンダーの再計算を避けるためメモ化
    const swapMarkers = useMemo(
        () => timelineMitigations.filter(m => {
            const d = MITIGATIONS.find(def => def.id === m.mitigationId);
            return d?.isTankSwap === true;
        }),
        [timelineMitigations, MITIGATIONS]
    );

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

    // 致死判定（実効ターゲットで判定）
    const isLethal = (() => {
        if (!event || !damage || damage.unmitigated <= 0) return false;
        const evtEff = getEffectiveTarget(event, swapMarkers, phases);
        let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
        if (evtEff === 'MT' || evtEff === 'ST') {
            maxHp = partyMembers.find(m => m.id === evtEff)?.stats.hp || 1;
        }
        return damage.mitigated >= maxHp;
    })();

    const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);
    const isLongPressRef = React.useRef(false);
    const [isPressed, setIsPressed] = useState(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        isLongPressRef.current = false;
        setIsPressed(true);

        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            setIsPressed(false);
            if (onLongPress) {
                try { navigator.vibrate(10); } catch {}
                onLongPress(events[0] ?? null, time);
            }
        }, 300);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartPosRef.current) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
        if (dx > 5 || dy > 5) {
            setIsPressed(false);
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }
    };

    const handleTouchEnd = () => {
        setIsPressed(false);
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
        if (onMobileDamageClick) {
            onMobileDamageClick(time, e);
        }
    };

    return (
        <motion.div
            data-time-row={time}
            className={clsx(
                "absolute left-0 w-full",
                "active:bg-app-text/[0.03] transition-colors duration-100",
                (timelineSelectMode || labelSelectMode) && "cursor-pointer"
            )}
            style={{ top: `${top}px`, height: `${rowHeight}px` }}
            animate={{ scale: isPressed ? SCALE.press : 1 }}
            transition={SPRING.default}
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
                {/* コンテンツエリア + 区切り線 (フェーズ名はヘッダー直下の固定ラベルへ移動済みのため全幅使用)。
                    justify-start 固定: justify-center だと軽減アイコン行の有無で1行/2行の合計高さが
                    変わり、時間・攻撃名の位置が行ごとに上下してしまうため、常に上基準に揃える。 */}
                <div className="flex-1 min-w-0 flex flex-col justify-start pt-2 px-3 gap-1 relative">
                    {/* 下部区切り線 (同時刻2件の1件目は2件目との間の罫線を出さない) */}
                    {!hideBottomDivider && (
                        <div className="absolute bottom-0 left-3 right-0 h-px bg-app-text/[0.06]" />
                    )}
                {/* 1行目: 時間 + 種別アイコン + 攻撃名 + 対象バッジ + ダメージ */}
                <div className="flex items-center gap-1.5 min-w-0">
                    {/* 時間 — 同時刻2件目も実際の時刻をそのまま表示(固定幅で後続要素の開始位置を揃える) */}
                    <span className={clsx(
                        "font-mono text-[15px] leading-none flex-shrink-0 w-[38px]",
                        isSecondEvent ? "text-app-text-muted opacity-50" : "text-app-text opacity-50"
                    )}>
                        {formattedTime}
                    </span>

                    {/* 種別アイコン (角丸四角)。デバフ軽減不可フラグで赤箱印が付く */}
                    <DamageTypeIcon damageType={event?.damageType} ignoresDebuffMitigation={event?.ignoresDebuffMitigation} size="w-4 h-4" className="rounded" />

                    {/* 攻撃名 */}
                    {event && (
                        <span className="text-[15px] font-black text-app-text truncate leading-none min-w-0">
                            {getEventName(event)}
                        </span>
                    )}

                    {/* 対象バッジ（実効ターゲットで表示） */}
                    {event && (
                        <TargetBadge effTarget={getEffectiveTarget(event, swapMarkers, phases)} partyMembers={partyMembers} />
                    )}

                    {/* 軽減前ダメージ → 軽減後ダメージ + 軽減% (右寄せ)。
                        items-baseline: 13px(ダメージ数字)と11px(矢印・%)が混在するため、
                        items-center だと箱の高さの違いで下端がズレる。文字のベースラインで揃える。 */}
                    {damage && damage.unmitigated > 0 && (
                        <div className="flex items-baseline gap-1.5 flex-shrink-0 ml-auto">
                            {/* 軽減前ダメージ */}
                            <span className="font-mono text-[13px] text-app-text opacity-30 leading-none flex-shrink-0">
                                {formatDmg(damage.unmitigated)}
                            </span>

                            <span className="text-app-text-muted opacity-30 text-[11px] flex-shrink-0">→</span>

                            {/* 軽減後ダメージ — AnimatedDamage は内部で高さ22px固定(.dmg-slot)なので、
                                周囲の13pxテキストと下端を揃えるため !h-[13px] で上書き(TimelineRow.tsx の
                                !h-[16px] 上書きと同じ仕組み)。 */}
                            <AnimatedDamage
                                value={damage.mitigated}
                                isLethal={isLethal}
                                className={clsx(
                                    "font-mono text-[13px] font-black leading-none flex-shrink-0 !h-[13px]",
                                    isLethal ? "text-red-500" : "text-green-500"
                                )}
                            />

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
                        </div>
                    )}
                </div>

                {/* 2行目: 軽減スキルアイコン (専用行・フル幅) */}
                <MitiIcons
                    mitigations={activeMitigations}
                    contentLanguage={contentLanguage}
                    myMemberId={myMemberId}
                />
            </div>
            </div>{/* カード本体 end */}
        </motion.div>
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
