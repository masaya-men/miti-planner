import React, { memo, useMemo } from 'react';
import { Plus, Copy } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { PartyMember, TimelineEvent, AppliedMitigation, Phase } from '../types';
import { getPhaseName } from '../types';
import { formatEventName } from '../utils/eventName';
import { getColumnCssVar } from '../utils/calculator';
import { getEffectiveTarget } from '../utils/effectiveTarget';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import { useMitigationStore } from '../store/useMitigationStore';
import { useProgressRecording } from './progress/useProgressRecording';
import { Tooltip } from './ui/Tooltip';
import { AnimatedDamage } from './AnimatedDamage';
import { DamageTypeIcon } from './DamageTypeIcon';
import { nextDamageType } from '../utils/damageTypeLogic';
import { EventNameSpan } from './EventNameSpan';
import { rowPropsEqual } from './timeline/rowPropsEqual';

interface DamageInfo {
    unmitigated: number;
    mitigated: number;
    mitigationPercent: number;
    shieldTotal: number;
    isInvincible?: boolean;
    mitigationStates?: Record<string, { stacks?: number }>;
}

interface TimelineRowProps {
    time: number;
    top: number;
    /** 行の高さ(px)= 1 段 × max(1, 攻撃数)。Timeline の rowLayout が決める */
    height: number;
    damages: (DamageInfo | null)[];
    events: TimelineEvent[];
    partyMembers: PartyMember[];
    /** 表示/非表示スイッチで隠したメンバーを除いた列描画専用リスト(2026-08-19)。「Job Columns
     * Cells」(1人1列の当たり判定セル)にのみ使う。partyMembers 自体は maxHp 参照等の計算に
     * 使われているため絞り込まない(全員分を維持)。 */
    visiblePartyMembers: PartyMember[];
    activeMitigations: AppliedMitigation[];
    onPhaseAdd: (time: number, e: React.MouseEvent) => void;
    onAddEventClick: (time: number, e: React.MouseEvent) => void;
    onEventClick: (event: TimelineEvent, e: React.MouseEvent) => void;
    onCellClick: (memberId: string, time: number, e: React.MouseEvent) => void;
    onMobileDamageClick?: (time: number, e: React.MouseEvent) => void;
    onLabelAdd?: (time: number, e: React.MouseEvent) => void;
    phaseColumnCollapsed?: boolean;
    labelColumnVisible?: boolean;
    hasPhases?: boolean;
    timelineSelectMode?: { phaseId: string; startTime: number } | null;
    labelSelectMode?: { labelId: string; startTime: number } | null;
    onTimelineSelect?: (time: number) => void;
    onTimelineSelectHover?: (time: number) => void;
    showRowBorders?: boolean;
}

// 外枠(TimelineRow)が持つ位置情報。中身(TimelineRowContent)は高さ・位置を使わないため
// 受け取らない(行の高さ変化で位置だけズレた行は、外枠だけ描き直し中身は描き直さないため)。
type TimelineRowContentProps = Omit<TimelineRowProps, 'top' | 'height'>;

// スマホ用: 対象バッジ（AoE以外の場合に表示）
// effTarget: 挑発によるタンクスイッチを反映した実効ターゲット（表示用）
const MobileTargetBadge: React.FC<{ partyMembers: PartyMember[]; effTarget: TimelineEvent['target'] }> = ({ partyMembers, effTarget }) => {
    const JOBS = useJobs();
    if (effTarget === 'AoE') return null;
    const member = partyMembers.find(m => m.id === effTarget);
    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
    if (job) {
        return <img src={job.icon} className="w-3.5 h-3.5 rounded-sm flex-shrink-0" alt={effTarget} />;
    }
    return (
        <span className={clsx(
            "text-app-2xs font-black px-0.5 rounded flex-shrink-0",
            effTarget === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10"
        )}>
            {effTarget}
        </span>
    );
};

// スマホ用: 軽減アイコンリスト
const MobileMitiIcons: React.FC<{
    mitigations: AppliedMitigation[];
    contentLanguage: string;
    myMemberId: string | null;
    size?: string;
}> = ({ mitigations, contentLanguage, myMemberId, size = 'w-3 h-3' }) => {
    const MITIGATIONS = useMitigations();
    return (
    <div className="flex md:hidden items-center gap-px flex-shrink-0 ml-auto">
        {mitigations.map(mit => {
            const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
            if (!def) return null;
            // 薄暗くの ON/OFF は親 .timeline-scroll-container[data-myjob-highlight] + CSS が担当。
            // ここでは「自分以外」の印(data-myjob-dim)だけ付ける（myJobHighlight は購読しない）。
            const isNotMine = !!myMemberId && mit.ownerId !== myMemberId;
            return (
                <img
                    key={mit.id}
                    src={def.icon}
                    alt={def.name ? getPhaseName(def.name, contentLanguage) : ''}
                    data-myjob-dim={isNotMine ? 'gray' : undefined}
                    className={clsx(size, "object-cover rounded-sm opacity-90")}
                />
            );
        })}
    </div>
); };

// PC用: 種別アイコン — 左クリックで physical→magical→unavoidable を循環 / 右クリックでデバフ軽減不可をトグル。
// いずれも updateEvent 経由なので collab 同期・Undo・ダメージ再計算・赤枠反映はモーダル変更と完全に同一経路。
// 純粋な閲覧者は store 側ガードで no-op。md: のみ表示(モバイルは別途 DamageTypeIcon を表示)。
export const PcTypeToggle: React.FC<{ event: TimelineEvent }> = ({ event }) => {
    const { t } = useTranslation();
    const updateEvent = useMitigationStore(state => state.updateEvent);
    // enrage(時間切れ)はアイコンを持たない種別なので、空のクリック領域を作らないよう非表示。
    if (!event.damageType || event.damageType === 'enrage') return null;
    const stateLabel = event.ignoresDebuffMitigation ? 'ON' : 'OFF';
    return (
        <Tooltip
            content={
                <div className="leading-snug">
                    <div>{t('timeline.type_action_left')}</div>
                    <div>{t('timeline.type_action_right', { state: stateLabel })}</div>
                </div>
            }
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation(); // 行クリック(編集モーダル)を抑止して即トグル
                    updateEvent(event.id, { damageType: nextDamageType(event.damageType) });
                }}
                onContextMenu={(e) => {
                    e.preventDefault();  // ブラウザ標準の右クリックメニューを抑止
                    e.stopPropagation(); // 行クリック(編集モーダル)を抑止
                    updateEvent(event.id, { ignoresDebuffMitigation: !event.ignoresDebuffMitigation });
                }}
                className="hidden md:inline-flex items-center cursor-pointer rounded-sm hover:bg-app-surface2 active:scale-95 transition-all"
            >
                <DamageTypeIcon damageType={event.damageType} ignoresDebuffMitigation={event.ignoresDebuffMitigation} size="w-3 h-3" withTooltip={false} />
            </button>
        </Tooltip>
    );
};

// PC用: 対象(MT/ST)表示 — クリックで MT⇄ST をトグル(イベント編集モーダルを開かず即切替)。
// updateEvent 経由なので collab 同期・Undo・ダメージ再計算はモーダルでの変更と完全に同一経路。
// 純粋な閲覧者は store 側ガードで no-op。対象が MT/ST 以外(AoE 等)のときは何も出さない。
// effTarget: 挑発によるタンクスイッチを反映した実効ターゲット（表示用）。クリックは元 target を編集。
const PcTargetToggle: React.FC<{ event: TimelineEvent; partyMembers: PartyMember[]; effTarget: TimelineEvent['target']; badgeTextClass?: string }> = ({ event, partyMembers, effTarget, badgeTextClass = 'text-app-base' }) => {
    const JOBS = useJobs();
    const { t } = useTranslation();
    const updateEvent = useMitigationStore(state => state.updateEvent);
    // reduced-motion ユーザーはアニメーションを省略する
    const reduce = useReducedMotion();
    // 実効ターゲットが MT/ST 以外なら表示しない
    if (effTarget !== 'MT' && effTarget !== 'ST') return null;
    const member = partyMembers.find(m => m.id === effTarget);
    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
    return (
        <Tooltip content={t('timeline.toggle_target_hint')}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation(); // 行クリック(編集モーダル)を抑止して即トグル
                    // クリックは元 target（raw）を編集する。表示 effTarget ではない。
                    updateEvent(event.id, { target: event.target === 'MT' ? 'ST' : 'MT' });
                }}
                className="flex items-center gap-1.5 cursor-pointer rounded px-1 -mx-1 hover:bg-app-surface2 active:scale-95 transition-all"
            >
                {/* "on" ラベルはアニメーション対象外 */}
                <span className="text-app-base text-app-text-muted font-mono">on</span>
                {/* effTarget が切り替わったときにアイコン/バッジをフリップアニメーション */}
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={String(effTarget)}
                        initial={reduce ? false : { opacity: 0, scale: 0.6, rotateY: -90 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotateY: 90 }}
                        transition={{ duration: 0.18 }}
                        className="inline-flex"
                    >
                        {job ? (
                            <img src={job.icon} className="w-6 h-6 rounded-sm" alt={effTarget} />
                        ) : (
                            <span className={clsx(
                                "font-bold px-1 rounded",
                                badgeTextClass,
                                effTarget === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10"
                            )}>
                                {effTarget}
                            </span>
                        )}
                    </motion.span>
                </AnimatePresence>
            </button>
        </Tooltip>
    );
};

// PC用: コピーボタン — 「+」の右隣、対象トグルの左に同サイズ(w-6 h-6)で並べる。
// ホバー時だけ幅を開いて可視化(攻撃名はその分だけ縮む)。対象アイコンが無い(AoE)行では親の ml-auto により右端へ寄る。
const PcCopyButton: React.FC<{ event: TimelineEvent }> = ({ event }) => {
    const { t } = useTranslation();
    const setClipboardEvent = useMitigationStore(state => state.setClipboardEvent);
    return (
        <Tooltip content={t('timeline.copy_event_hint')} position="top">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setClipboardEvent(event);
                }}
                className="flex items-center justify-center w-6 h-6 rounded-sm text-app-text-muted hover:text-app-accent cursor-pointer opacity-0 pointer-events-none group-hover/slot:opacity-100 group-hover/slot:pointer-events-auto transition-opacity active:scale-95"
            >
                <Copy size={14} />
            </button>
        </Tooltip>
    );
};

// PC用: イベント追加ボタン — コピーの左隣。ホバー時だけ出る(コピーと同じ動き)。
// 動きは空の行の「+」と同じ onAddEventClick(コピー中は貼り付け / AA モード中は AA 追加 / それ以外は追加モーダル)。
const PcAddEventButton: React.FC<{ time: number; onAddEventClick: (time: number, e: React.MouseEvent) => void }> = ({ time, onAddEventClick }) => {
    const { t } = useTranslation();
    return (
        <Tooltip content={t('timeline.event_add_here')} position="top">
            <button
                type="button"
                aria-label={t('timeline.event_add_here')}
                onClick={(e) => {
                    e.stopPropagation();
                    onAddEventClick(time, e);
                }}
                className="flex items-center justify-center w-6 h-6 rounded-sm text-app-text-muted hover:text-app-accent cursor-pointer opacity-0 pointer-events-none group-hover/slot:opacity-100 group-hover/slot:pointer-events-auto transition-opacity active:scale-95"
            >
                <Plus size={14} />
            </button>
        </Tooltip>
    );
};

// PC用: 1 段ぶんの TAKEN(軽減後ダメージ)。致死判定は挑発によるタンクスイッチ後の実効ターゲットで行う
const DamageTakenCell: React.FC<{
    event: TimelineEvent;
    damage: DamageInfo | null | undefined;
    partyMembers: PartyMember[];
    swapMarkers: AppliedMitigation[];
    phases: Phase[];
}> = ({ event, damage, partyMembers, swapMarkers, phases }) => {
    const { t } = useTranslation();
    if (!damage || !(damage.unmitigated > 0 || damage.isInvincible)) return null;
    const evtEff = getEffectiveTarget(event, swapMarkers, phases);
    let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
    if (evtEff === 'MT' || evtEff === 'ST') {
        maxHp = partyMembers.find(m => m.id === evtEff)?.stats.hp || 1;
    }
    const isLethal = damage.mitigated >= maxHp;
    const colorClass = isLethal ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
    return (
        <>
            <AnimatedDamage value={damage.mitigated} isLethal={isLethal} className={`${colorClass} !h-[16px]`} />
            {damage.isInvincible ? (
                <div className="text-app-sm text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap">
                    {t('timeline.invuln', 'Invuln')}
                </div>
            ) : (damage.mitigationPercent > 0 || damage.shieldTotal > 0) ? (
                <div className="text-app-sm text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap hidden md:flex flex-row items-center justify-center gap-1 w-full px-1 truncate leading-none">
                    {damage.mitigationPercent > 0 && <span>▼ {damage.mitigationPercent}%</span>}
                    {damage.mitigationPercent > 0 && damage.shieldTotal > 0 && <span className="opacity-50">|</span>}
                    {damage.shieldTotal > 0 && (
                        <span className="flex items-center gap-0.5">
                            🛡️ {damage.shieldTotal.toLocaleString()}
                        </span>
                    )}
                </div>
            ) : null}
        </>
    );
};

// TimelineRow(外枠): 位置(top/height)だけを持つ一番外側の div。中身(TimelineRowContent)は
// 別コンポーネントに分けてあるので、他の行の高さが変わって top だけがズレた行は、この外枠だけが
// 描き直され、中身(列のセル群)は描き直されない(memo 比較で弾かれる)。
export const TimelineRow = memo(({
    top,
    height,
    ...contentProps
}: TimelineRowProps) => {
    const {
        time,
        showRowBorders = false,
        timelineSelectMode,
        labelSelectMode,
        phaseColumnCollapsed,
        labelColumnVisible,
        onTimelineSelect,
        onTimelineSelectHover,
    } = contentProps;

    return (
        <div
            data-time-row={time}
            className={clsx(
                "absolute left-0 w-full md:w-fit flex group duration-75",
                "hover:bg-app-surface2",
                // perf #59: ビューポート外行を style/layout/paint からスキップ。仮の高さ(contain-intrinsic-size)は style の height と一致させる
                "[content-visibility:auto]",
                showRowBorders && "border-b border-app-border",
                (timelineSelectMode || labelSelectMode) && "cursor-pointer"
            )}
            style={{
                height: `${height}px`,
                containIntrinsicSize: `auto ${height}px`,
                top: `${top}px`,
                // hover line の left/width は CSS 変数 (viewport 連動 clamp) ベースで計算する。
                // 旧実装は開発者画面 (1489) の max 値をハードコード (60+200+100+100=460px) して
                // いたため、 1489 未満の viewport では実セル幅 < 460px となり罫線が右にはみ出していた。
                // left = phase 列 + label 列 (collapsed/visible で切替)。 width = time + mechanic + counter ×2。
                '--hover-line-left': `calc(${phaseColumnCollapsed ? 'var(--col-phase-collapsed-w)' : 'var(--col-phase-w)'} + ${labelColumnVisible ? 'var(--col-label-w)' : 'var(--col-label-collapsed-w)'})`,
                '--hover-line-width': 'calc(var(--col-time-w) + var(--col-mechanic-w) + var(--col-counter-w) * 2)',
            } as React.CSSProperties}
            onMouseEnter={() => {
                if (timelineSelectMode || labelSelectMode) {
                    onTimelineSelectHover?.(time);
                }
            }}
            onClickCapture={(e) => {
                // 進捗記録モード中は「キャプチャ段階」で全クリックを横取りし、その行の time を打点。
                // これで列(イベント/フェーズ/ラベル/メンバー)の個別 onClick が発火する前に止まり、
                // モーダル等が開かず、行のどこをクリックしても確実に記録される（表全体が時間ピッカー）。
                if (useProgressRecording.getState().recordMode) {
                    useProgressRecording.getState().commitReachedPos(time);
                    e.stopPropagation();
                    e.preventDefault();
                }
            }}
            onClick={(e) => {
                if (timelineSelectMode || labelSelectMode) {
                    onTimelineSelect?.(time);
                    e.stopPropagation();
                }
            }}
        >
            <TimelineRowContent {...contentProps} />
        </div>
    );
}, (prevProps, nextProps) => rowPropsEqual(prevProps, nextProps, ['events', 'damages', 'activeMitigations']));

// TimelineRowContent(中身): 列のセル群。top/height は受け取らない(使わない)。
const TimelineRowContent = memo(({
    time,
    damages,
    events,
    partyMembers,
    visiblePartyMembers,
    activeMitigations,
    onPhaseAdd,
    onAddEventClick,
    onEventClick,
    onCellClick,
    onMobileDamageClick,
    onLabelAdd,
    phaseColumnCollapsed,
    labelColumnVisible,
    hasPhases = true,
    timelineSelectMode,
    labelSelectMode,
    onTimelineSelect,
    onTimelineSelectHover,
    showRowBorders = false,
}: TimelineRowContentProps) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const myMemberId = useMitigationStore(state => state.myMemberId);
    // 挑発スキル（isTankSwap）による実効ターゲット計算に必要なデータ
    const timelineMitigations = useMitigationStore(state => state.timelineMitigations);
    const phases = useMitigationStore(state => state.phases);
    const MITIGATIONS = useMitigations();
    // isTankSwap なスキルのみ抽出（挑発マーカー）。毎レンダーの再計算を避けるためメモ化
    const swapMarkers = useMemo(
        () => timelineMitigations.filter(m => {
            const def = MITIGATIONS.find(def => def.id === m.mitigationId);
            return def?.isTankSwap === true;
        }),
        [timelineMitigations, MITIGATIONS]
    );

    const orConnector = t('event.or_connector');
    const getEventName = (ev: TimelineEvent) => formatEventName(ev, contentLanguage, orConnector);

    const isMobileRow = typeof window !== 'undefined' && window.innerWidth < 768;
    const formatDmg = (val: number) => {
        if (!isMobileRow) return val.toLocaleString();
        if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
        return String(val);
    };

    // スマホ: どこをタップしても軽減追加を開く
    const handleMobileTap = (e: React.MouseEvent) => {
        if (window.innerWidth < 768 && onMobileDamageClick && events.length > 0) {
            onMobileDamageClick(time, e);
        }
    };

    const displayTimeStr = Math.floor(Math.abs(time) / 60) + ':' + (Math.abs(time) % 60).toString().padStart(2, '0');
    const formattedTime = time < 0 && time > -60 ? `-0:${(Math.abs(time) % 60).toString().padStart(2, '0')}` :
        time < 0 ? `-${displayTimeStr}` :
            displayTimeStr;

    return (
        <>
            {/* Phase Column — スマホ: フェーズなし→非表示 / PC: フェーズ追加 */}
            {!phaseColumnCollapsed ? (
                <div
                    data-phase-col
                    className={clsx(
                        "md:w-[var(--col-phase-w)] md:min-w-[var(--col-phase-w)] md:max-w-[var(--col-phase-w)] border-r h-full relative items-center justify-center group-hover:text-app-text",
                        "border-app-border",
                        "md:cursor-pointer md:hover:bg-app-surface2",
                        hasPhases ? "w-[24px] flex" : "w-[24px] hidden md:flex",
                    )}
                    onClick={(e) => {
                        if (timelineSelectMode) {
                            onTimelineSelect?.(time);
                            return;
                        }
                        if (window.innerWidth < 768) {
                            handleMobileTap(e);
                        } else {
                            onPhaseAdd(time, e);
                        }
                    }}
                    onMouseEnter={() => {
                        if (timelineSelectMode) {
                            onTimelineSelectHover?.(time);
                        }
                    }}
                >
                    {!(timelineSelectMode || labelSelectMode) && (
                        <Tooltip content={t('timeline.end_phase')} position="right">
                            <div className="hidden md:flex items-center justify-center w-full h-full text-app-text-muted opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                                <Plus size={16} />
                            </div>
                        </Tooltip>
                    )}
                </div>
            ) : (
                <div className="w-[16px] min-w-[16px] max-w-[16px] border-r border-app-border h-full hidden md:block" />
            )}

            {/* Label Column — スマホ: フェーズなし→フェーズ位置に表示 / PC: 展開or折り畳み */}
            {labelColumnVisible ? (
                <div
                    data-label-col
                    className={clsx(
                        "md:flex md:w-[var(--col-label-w)] md:min-w-[var(--col-label-w)] md:max-w-[var(--col-label-w)] border-r border-app-border h-full items-center justify-center cursor-pointer hover:bg-app-surface2",
                        hasPhases ? "hidden" : "w-[24px] flex md:w-[var(--col-label-w)]",
                    )}
                    onClick={(e) => {
                        if (labelSelectMode) {
                            onTimelineSelect?.(time);
                            return;
                        }
                        if (window.innerWidth < 768) {
                            handleMobileTap(e);
                        } else {
                            onLabelAdd?.(time, e);
                        }
                    }}
                    onMouseEnter={() => {
                        if (labelSelectMode) {
                            onTimelineSelectHover?.(time);
                        }
                    }}
                >
                    {!(timelineSelectMode || labelSelectMode) && (
                        <Tooltip content={t('timeline.add_label')} position="top">
                            <div className="hidden md:flex items-center justify-center w-full h-full text-app-text-muted opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                                <Plus size={14} />
                            </div>
                        </Tooltip>
                    )}
                </div>
            ) : (
                <div className="w-[16px] min-w-[16px] max-w-[16px] border-r border-app-border h-full hidden md:block" />
            )}

            {/* Time Column — スマホ: 軽減追加 */}
            <div
                className={clsx(
                    "w-[36px] min-w-[36px] md:w-[var(--col-time-w)] md:min-w-[var(--col-time-w)] md:max-w-[var(--col-time-w)] border-r h-full flex items-center justify-center relative font-mono text-app-sm md:text-app-2xl group-hover:text-app-text group-hover:font-black",
                    "border-app-border text-app-text-sec hover:bg-app-surface2"
                )}
                onClick={handleMobileTap}
            >
                {formattedTime}
            </div>

            {/* Event Column */}
            <div className={clsx(
                "flex-1 md:flex-none md:w-[var(--col-mechanic-w)] md:min-w-[var(--col-mechanic-w)] md:max-w-[var(--col-mechanic-w)] border-r h-full relative flex flex-col",
                "border-app-border hover:bg-app-surface2"
            )}>
                {events.length === 0 ? (
                    /* 0イベント: PC専用の追加ボタン */
                    <div
                        data-tutorial={
                          time === 11 ? 'add-event-btn-11' :
                          time === 0 ? 'add-event-btn' :
                          undefined
                        }
                        className={clsx(
                            "w-full h-full items-center justify-center cursor-pointer transition-all duration-150",
                            "hidden md:flex",
                            "opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 hover:bg-app-surface2",
                            "[&.tutorial-target-highlight]:opacity-100 [&.tutorial-target-highlight]:bg-white/10"
                        )}
                        onClick={(e) => onAddEventClick(time, e)}
                    >
                        <Tooltip content={t('timeline.add_event')} position="top">
                            <Plus size={16} className={clsx(
                                "text-app-text-muted",
                                "[.tutorial-target-highlight_&]:text-app-text"
                            )} />
                        </Tooltip>
                    </div>
                ) : (
                    /* 1 件以上: 攻撃 1 つ = 1 段。段を攻撃の数だけ縦に並べる(行の高さ = 1 段 × 攻撃数・各段は flex-1 で等分) */
                    events.map((event, idx) => (
                        <div key={event.id} className={clsx("flex-1 min-h-0 w-full relative group/slot", idx < events.length - 1 && showRowBorders && "border-b border-app-border")}>
                            <div
                                className="w-full h-full flex items-center px-2 gap-1 md:gap-2 cursor-pointer hover:bg-app-surface2"
                                onClick={(e) => {
                                    if (window.innerWidth < 768) {
                                        handleMobileTap(e);
                                    } else {
                                        onEventClick(event, e);
                                    }
                                }}
                            >
                                {/* 種別: PC=クリックで循環 / モバイル=表示のみ(両方とも赤箱印あり) */}
                                <PcTypeToggle event={event} />
                                <DamageTypeIcon damageType={event.damageType} ignoresDebuffMitigation={event.ignoresDebuffMitigation} size="w-3 h-3" className="md:hidden" />

                                {/* 攻撃名（省略時にネイティブツールチップ表示） */}
                                <EventNameSpan name={getEventName(event)} className="text-app-base md:text-app-lg" />

                                {/* スマホ専用: 対象バッジ */}
                                <div className="md:hidden flex-shrink-0">
                                    <MobileTargetBadge partyMembers={partyMembers} effTarget={getEffectiveTarget(event, swapMarkers, phases)} />
                                </div>

                                {/* スマホ専用: 軽減アイコン */}
                                <MobileMitiIcons
                                    mitigations={activeMitigations}
                                    contentLanguage={contentLanguage}
                                    myMemberId={myMemberId}
                                    size="w-2.5 h-2.5"
                                />

                                {/* PC専用: Target(右端固定・クリックで MT⇄ST トグル)。「+」とコピーはホバー時だけ幅を開く
                                    (非ホバー=w-0で攻撃名フル幅 / ホバー=w-16で名前が縮み「+」とコピーが重ならず収まる)。対象が無い(AoE)行は右端に出る */}
                                <div className="hidden md:flex items-center flex-shrink-0 ml-auto">
                                    <div className="w-0 overflow-hidden flex justify-start group-hover/slot:w-16 transition-[width] duration-150">
                                        <PcAddEventButton time={time} onAddEventClick={onAddEventClick} />
                                        <PcCopyButton event={event} />
                                    </div>
                                    <PcTargetToggle event={event} partyMembers={partyMembers} effTarget={getEffectiveTarget(event, swapMarkers, phases)} badgeTextClass="text-app-sm" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* U.Dmg Column */}
            <div
                className={clsx(
                    "w-[var(--col-counter-w)] min-w-[var(--col-counter-w)] md:max-w-[var(--col-counter-w)] border-r h-full flex flex-col items-center justify-center text-app-base md:text-app-2xl font-mono font-black group-hover:text-app-text cursor-pointer md:cursor-default",
                    "border-app-border text-app-text-sec"
                )}
                onClick={(e) => {
                    if (window.innerWidth < 768 && onMobileDamageClick) {
                        onMobileDamageClick(time, e);
                    }
                }}
            >
                {events.map((event, idx) => (
                    <div key={event.id} className={clsx("flex-1 min-h-0 w-full flex items-center justify-center", idx < events.length - 1 && showRowBorders && "border-b border-app-border")}>
                        {damages[idx] && damages[idx]!.unmitigated > 0 ? formatDmg(damages[idx]!.unmitigated) : ''}
                    </div>
                ))}
            </div >

            {/* Dmg Column - With Mitigation Details */}
            <div
                data-tutorial={
                    time === 4 && events.length > 0 && events[0].target === 'AoE' ? 'tutorial-damage-cell-4-aoe' :
                        time === 10 && events.length > 0 && events[0].target === 'MT' ? 'tutorial-damage-cell-10-tb' :
                            undefined
                }
                className={clsx(
                    "w-[var(--col-counter-w)] min-w-[var(--col-counter-w)] md:max-w-[var(--col-counter-w)] border-r h-full flex flex-col items-center justify-center text-app-base md:text-app-2xl font-mono font-black group-hover:text-app-text cursor-pointer md:cursor-default",
                    "border-app-border text-app-text-primary"
                )}
                onClick={(e) => {
                    if (window.innerWidth < 768 && onMobileDamageClick) {
                        onMobileDamageClick(time, e);
                    }
                }}
            >
                {events.map((event, idx) => (
                    <div key={event.id} className={clsx("flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-0 leading-none",
                        idx < events.length - 1 && showRowBorders && "border-b border-app-border"
                    )}>
                        <DamageTakenCell event={event} damage={damages[idx]} partyMembers={partyMembers} swapMarkers={swapMarkers} phases={phases} />
                    </div>
                ))}
            </div >

            {/* Job Columns Cells — PC専用(表示/非表示スイッチで隠したメンバーの列は描画しない) */}
            {
                visiblePartyMembers.map((member) => (
                    <div
                        key={member.id}
                        data-tutorial={
                            member.id === 'MT' && time === 4 ? 'miti-cell-mt-4' :
                                member.id === 'ST' && time === 4 ? 'miti-cell-st-4' :
                                    member.id === 'ST' && time === 10 ? 'miti-cell-st-10' : undefined
                        }
                        className={clsx(
                            "hidden md:flex h-full items-center justify-center relative group/cell cursor-pointer  border-r",
                            "border-app-border hover:bg-app-surface2"
                        )}
                        style={{ width: getColumnCssVar(member.role), minWidth: getColumnCssVar(member.role), maxWidth: getColumnCssVar(member.role) }}
                        onClick={(e) => onCellClick(member.id, time, e)}
                    >
                        <Tooltip content={t('mitigation.select')} position="top">
                            <div className="w-full h-full" />
                        </Tooltip>
                    </div>
                ))
            }
        </>
    );
}, (prevProps, nextProps) => rowPropsEqual(prevProps, nextProps, ['events', 'damages', 'activeMitigations']));
