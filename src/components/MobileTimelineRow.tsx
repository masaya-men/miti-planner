import React, { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { PartyMember, TimelineEvent, AppliedMitigation, Mitigation } from '../types';
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
    /** 軽減アイコン専用行に横並びで入りきる最大アイコン数(画面幅から算出、呼び出し側が渡す)。
     * あふれた分は折り返さず「+N」バッジにする(2026-08-13ユーザー要望=行の高さが固定コマの
     * ため2段折り返しは絶対にしない)。 */
    maxMitiIcons?: number;
    /** 競合(同スキルCDかぶり)中の軽減インスタンスID集合。Timeline.tsx で PC と共通の
     * findSameSkillCdConflicts から算出(直前配置分のパルス除外込み)。渡された分だけ
     * アイコンを黄色パルスで光らせる(2026-08-14ユーザー要望=PC版と同じ競合表示)。 */
    conflictingIds?: Set<string>;
}

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

/** 軽減アイコンを「1行に入りきる分」と「あふれた分」に分ける(グルーピング込み)。
 * MitiIcons(2行目に表示)とMobileTimelineRow(あふれた分を1行目のダメージ表記エリアに表示)の
 * 両方が同じ分け方を使う必要があるため共通関数化(バラバラに計算すると数がズレるバグの元に
 * なる。2026-08-13実機検証で実際に1件ズレるバグを踏んだ)。 */
function groupAndCapMitigations(mitigations: AppliedMitigation[], maxIcons: number | undefined) {
    // 表示順は常に MT→ST→H1→H2→D1〜D4 固定(PARTY_MEMBER_IDS)。PC の並び替え設定
    // (partySortOrder='light_party' 等)の影響を受けない — スマホは常に同じ並びにする。
    const groups: { key: string; items: AppliedMitigation[] }[] = PARTY_MEMBER_IDS
        .map(id => ({ key: id, items: mitigations.filter(m => m.ownerId === id) }))
        .filter(g => g.items.length > 0);
    const knownIds = new Set<string>(PARTY_MEMBER_IDS);
    const orphan = mitigations.filter(m => !knownIds.has(m.ownerId));
    if (orphan.length > 0) groups.push({ key: 'orphan', items: orphan });

    // 「+N」バッジ自体も1枠分の幅を使うため、あふれる場合はバッジの分を1枠減らして確保する
    // (2026-08-13実機検証: バッジの分を引かずに満タンまで表示すると行の見積り幅を超える)。
    const cap = maxIcons ?? Infinity;
    const overflowCount = Math.max(0, mitigations.length - cap);
    let visibleBudget = overflowCount > 0 ? Math.max(0, cap - 1) : cap;
    const visibleGroups: { key: string; items: AppliedMitigation[] }[] = [];
    for (const g of groups) {
        if (visibleBudget <= 0) break;
        const take = g.items.slice(0, visibleBudget);
        if (take.length > 0) visibleGroups.push({ key: g.key, items: take });
        visibleBudget -= take.length;
    }
    const visibleIds = new Set(visibleGroups.flatMap(g => g.items.map(i => i.id)));
    const hiddenMitigations = mitigations.filter(m => !visibleIds.has(m.id));
    return { visibleGroups, hiddenMitigations };
}

/** 軽減アイコン(1個)。MitiIcons(2行目)と、あふれた分を表示する1行目ダメージエリアの
 * 両方から同じ見た目で使う。 */
const MitiIconImg: React.FC<{
    mit: AppliedMitigation;
    def: Mitigation;
    contentLanguage: string;
    isNotMine: boolean;
    isStartRow: boolean;
    /** 競合(同スキルCDかぶり)中: PC版のring-2より枠を細くして22pxアイコンでも潰れないようにする。 */
    isConflicting?: boolean;
}> = ({ mit, def, contentLanguage, isNotMine, isStartRow, isConflicting }) => (
    <img
        key={mit.id}
        src={def.icon}
        alt={def.name ? getPhaseName(def.name, contentLanguage) : ''}
        data-myjob-dim={isNotMine ? 'gray' : undefined}
        className={clsx(
            'w-[22px] h-[22px] object-cover rounded-md',
            isStartRow ? 'opacity-90' : 'opacity-[0.55]',
            isConflicting && 'animate-conflict-pulse ring-1 ring-amber-400',
        )}
    />
);

/** 軽減スキルアイコン列（専用行・フル幅・18px・使用者ごとにグルーピング表示） */
const MitiIcons: React.FC<{
    visibleGroups: { key: string; items: AppliedMitigation[] }[];
    hiddenCount: number;
    contentLanguage: string;
    myMemberId: string | null;
    /** この行の時刻。mit.timeと一致する行(=設置した瞬間)だけ通常の濃さにし、それ以外
     * (効果継続中の行)はエフェクト棒と同じ濃さ(0.55)まで薄くして「どこで使ったか」を
     * 目立たせる(2026-08-13ユーザー提案)。 */
    time: number;
    /** 「+N」タップ時のコールバック(1行目ダメージ表記エリアへのあふれ表示ON/OFFを親が管理)。
     * 2026-08-13ユーザー確認=「+Nを押した時だけそうなる」= 常時表示ではなくタップ式に確定。 */
    onOverflowTap: () => void;
    conflictingIds?: Set<string>;
    /** 隠れている(あふれた)分の中に競合中インスタンスが含まれるか。含まれる場合は
     * 「+N」バッジ自体も光らせ、開かないと気づけない競合を示唆する(2026-08-14ユーザー確認)。 */
    hiddenHasConflict?: boolean;
}> = ({ visibleGroups, hiddenCount, contentLanguage, myMemberId, time, onOverflowTap, conflictingIds, hiddenHasConflict }) => {
    const MITIGATIONS = useMitigations();
    if (visibleGroups.length === 0 && hiddenCount === 0) return null;

    return (
        // 同じ人のアイコン同士はほぼ密着(gap-px=1px)、人が変わるところだけ gap-1.5(6px)空ける。
        // 「ぴったりくっつく」ためには同グループ内の隙間をほぼ0にする必要があった。
        // mix-blend-plus-lighter: エフェクト棒(奥に描画済み)とのクロスフェード時、不透明度の
        // 単純な上げ下げだと切り替わりの中間で両方が重なって濁って見える問題があるため、
        // 加算合成にして常に綺麗に混ざるようにする(静止時は背景がほぼ黒なので見た目は変わらない)。
        // flex-wrap は使わない(2026-08-13ユーザー要望=行の高さが固定コマのため2段折り返しは
        // 絶対にしない。あふれた分は「+N」タップで1行目のダメージ表記エリアに表示する。
        // overflow-hidden は maxIcons 見積もりのズレに対する保険)。
        <div className="mobile-miti-icons flex items-center justify-end gap-1.5 flex-nowrap overflow-hidden mix-blend-plus-lighter">
            {visibleGroups.map(group => (
                <div key={group.key} className="flex items-center gap-px">
                    {group.items.map(mit => {
                        const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
                        if (!def) return null;
                        // 薄暗くは親 .timeline-scroll-container[data-myjob-highlight] + CSS が担当（myJobHighlight 非購読）。
                        const isNotMine = !!myMemberId && mit.ownerId !== myMemberId;
                        // 0.55 = エフェクト棒(MOBILE_EFFECT_BAR_MAX_OPACITY)と同じ濃さ。
                        const isStartRow = mit.time === time;
                        return (
                            <MitiIconImg key={mit.id} mit={mit} def={def} contentLanguage={contentLanguage} isNotMine={isNotMine} isStartRow={isStartRow} isConflicting={conflictingIds?.has(mit.id)} />
                        );
                    })}
                </div>
            ))}
            {hiddenCount > 0 && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOverflowTap(); }}
                    className={clsx(
                        "flex-shrink-0 w-[22px] h-[22px] rounded-md bg-app-text/15 text-app-text text-[10px] font-black flex items-center justify-center",
                        hiddenHasConflict && "animate-conflict-pulse ring-1 ring-amber-400",
                    )}
                >
                    +{hiddenCount}
                </button>
            )}
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
    maxMitiIcons,
    conflictingIds,
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

    // 軽減アイコンの「入りきる分」と「あふれた分」。あふれた分は「+N」タップで1行目の
    // ダメージ表記エリアに切り替え表示する(2026-08-13ユーザー確認=常時表示ではなくタップ式)。
    const { visibleGroups: mitiVisibleGroups, hiddenMitigations: mitiHiddenMitigations } = useMemo(
        () => groupAndCapMitigations(activeMitigations, maxMitiIcons),
        [activeMitigations, maxMitiIcons]
    );
    const [mitiOverflowOpen, setMitiOverflowOpen] = useState(false);
    // 隠れている(あふれた)分に競合中インスタンスが含まれるか(「+N」バッジを光らせる判定)。
    const mitiHiddenHasConflict = useMemo(
        () => !!conflictingIds && mitiHiddenMitigations.some(m => conflictingIds.has(m.id)),
        [mitiHiddenMitigations, conflictingIds]
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
                // 長押し判定(300ms)とiOS標準の「範囲選択」ジェスチャーが競合し、長押し編集を
                // 開くたびに選択ハイライトも一緒に出てしまう不具合の対策(2026-08-13実機FB)。
                // .touch-none は使わない(Tailwindのtouch-action:noneも付与されてしまい、縦スクロール
                // ごと殺してしまうため)。select-none(user-select)のみ+callout抑制を個別指定。
                "select-none [-webkit-touch-callout:none]",
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
                {/* pt/pb: 元はpt-[7px]のみ(下端の余白ゼロ→2行目アイコンが罫線にぴったり付いて見える
                    実機FB・2026-08-14)。合計7pxの枠内でtop/bottomへ再配分し、行の高さ(60px)は
                    不変のままコンテンツを縦方向にやや中央寄せする。 */}
                <div className="flex-1 min-w-0 flex flex-col justify-start pt-[4px] pb-[3px] px-3 gap-1 relative">
                    {/* 下部区切り線 (同時刻2件の1件目は2件目との間の罫線を出さない) */}
                    {!hideBottomDivider && (
                        <div className="absolute bottom-0 left-3 right-0 h-px bg-app-text/[0.06]" />
                    )}
                {/* 1行目: 時間 + 種別アイコン + 攻撃名 + 対象バッジ + ダメージ */}
                <div className="flex items-center gap-1.5 min-w-0">
                    {/* 時間 — 同時刻2件目も実際の時刻をそのまま表示(固定幅で後続要素の開始位置を揃える)。
                        mobile-row-dim-text: エフェクト表示中に濃さを一段上げる対象
                        (2026-08-13ユーザー要望=薄い文字が読みにくい。影は不採用、地の濃さで対応)。 */}
                    <span className={clsx(
                        "mobile-row-dim-text font-mono text-[15px] leading-none flex-shrink-0 w-[38px]",
                        isSecondEvent ? "text-app-text-muted opacity-85" : "text-app-text opacity-85"
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

                    {/* ダメージ表記 — 行は増やさず、1行目の右端に「元ダメ→(極小)」を上段・
                        「軽減率+軽減後ダメージ(通常サイズ)」を下段にした2段スタックとして詰め込む
                        (2026-08-13ユーザー指定=行の高さを変えずに、フル桁表示化で潰れた攻撃名の
                        表示幅を確保する)。gap-0で上下を密着させ、行の高さ増を最小限にする。
                        wrapper自体は常時描画してmin-h-[27px]で高さを確保する(ダメージ無し行だと
                        中身ごと消えて1行目の高さが縮み、2行目の軽減アイコンの位置がズレる不具合を
                        Playwright実測で発見・対策)。
                        軽減アイコンがあふれている行は、2行目の「+N」タップでここ(ダメージ表記の
                        場所)にあふれた分のアイコンを切り替え表示する(2026-08-13ユーザー確認=
                        「+Nを押した時だけ」。旧・2段折り返しと同じ見た目(ポップアップ等のカード
                        装飾は無し)だが、下の行ではなく上の数字エリアへ、タップで切り替え)。 */}
                    <div className="flex flex-col items-end justify-center gap-0 flex-shrink-0 ml-auto min-h-[27px]">
                        {mitiOverflowOpen && mitiHiddenMitigations.length > 0 ? (
                            <div className="flex items-center flex-nowrap overflow-hidden justify-end gap-px mix-blend-plus-lighter">
                                {mitiHiddenMitigations.map(mit => {
                                    const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
                                    if (!def) return null;
                                    const isNotMine = !!myMemberId && mit.ownerId !== myMemberId;
                                    const isStartRow = mit.time === time;
                                    return (
                                        <MitiIconImg key={mit.id} mit={mit} def={def} contentLanguage={contentLanguage} isNotMine={isNotMine} isStartRow={isStartRow} isConflicting={conflictingIds?.has(mit.id)} />
                                    );
                                })}
                            </div>
                        ) : damage && damage.unmitigated > 0 && (
                            <>
                                <div className="flex items-baseline gap-1">
                                    <span className="mobile-row-dim-text font-mono text-[9px] text-app-text opacity-60 leading-none flex-shrink-0">
                                        {damage.unmitigated.toLocaleString()}
                                    </span>
                                    <span className="mobile-row-dim-text text-app-text-muted opacity-50 text-[9px] flex-shrink-0">→</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    {/* 軽減% */}
                                    {damage.mitigationPercent > 0 && !isLethal && (
                                        <span className="mobile-row-dim-text font-mono text-[11px] text-app-text opacity-60 leading-none flex-shrink-0">
                                            {damage.mitigationPercent}%
                                        </span>
                                    )}

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

                                    {/* 無敵 */}
                                    {damage.isInvincible && (
                                        <span className="text-[9px] font-black text-app-text-sec px-1 py-px rounded-md bg-app-text/5 flex-shrink-0">
                                            {t('timeline.invuln', 'Invuln')}
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 2行目: 軽減スキルアイコン (専用行・フル幅) */}
                <MitiIcons
                    visibleGroups={mitiVisibleGroups}
                    hiddenCount={mitiHiddenMitigations.length}
                    contentLanguage={contentLanguage}
                    myMemberId={myMemberId}
                    time={time}
                    onOverflowTap={() => setMitiOverflowOpen(v => !v)}
                    conflictingIds={conflictingIds}
                    hiddenHasConflict={mitiHiddenHasConflict}
                />

                {/* 「+N」バッジの当たり判定拡張(2026-08-13実機FB=見た目の22pxのままだと押しにくい)。
                    .mobile-miti-icons は overflow-hidden(あふれ見積りのズレ対策)で22px高固定のため、
                    その内側に当たり判定を拡張すると自身のoverflow-hiddenでクリップされてしまう。
                    ここ(row1の relative コンテナ、overflow指定なし)に外側から重ねることで回避。
                    バッジは常に右詰め最後尾(px-3の右端)に来るため、座標計算(ref測定)無しで
                    right-3/bottom-0基準の絶対配置だけで実用上十分揃う。 */}
                {mitiHiddenMitigations.length > 0 && (
                    <button
                        type="button"
                        aria-hidden="true"
                        tabIndex={-1}
                        onClick={(e) => { e.stopPropagation(); setMitiOverflowOpen(v => !v); }}
                        className="absolute bottom-0 right-2 w-10 h-9"
                    />
                )}
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
