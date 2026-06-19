import React, { memo, useMemo } from 'react';
import { Plus, Copy } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { PartyMember, TimelineEvent, AppliedMitigation } from '../types';
import { getPhaseName } from '../types';
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

/** 攻撃名スパン — 省略時にスタイル付きツールチップ表示
 *  perf #59 C: onMouseEnter 毎の scrollWidth 比較は forced reflow を引き起こすため、
 *  ResizeObserver で要素サイズ変化時にだけ判定するよう変更。 hover 時はステート参照のみ。 */
const EventNameSpan: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
    const ref = React.useRef<HTMLSpanElement>(null);
    const [truncated, setTruncated] = React.useState(false);
    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const check = () => setTruncated(el.scrollWidth > el.clientWidth);
        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => ro.disconnect();
    }, [name]);
    return (
        <Tooltip content={truncated ? name : ''} wrapperClassName="!w-auto min-w-0">
            <span
                ref={ref}
                className={clsx(className, "font-black text-app-text truncate leading-none pt-0.5 min-w-0 block")}
            >
                {name}
            </span>
        </Tooltip>
    );
};

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
    damages: (DamageInfo | null)[];
    events: TimelineEvent[];
    partyMembers: PartyMember[];
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

// PC用: コピーボタン — 対象トグルの右隣に同サイズ(w-6 h-6)で並べる。
// ホバー時のみ可視だが場所は常に確保(opacity 切替のみ)＝攻撃名のガタつきなし。
// 対象アイコンが無い(AoE)行では親の ml-auto により右端へ寄る。
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

export const TimelineRow = memo(({
    time,
    top,
    damages,
    events,
    partyMembers,
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
}: TimelineRowProps) => {
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

    const getEventName = (ev: TimelineEvent) =>
        ev.name ? getPhaseName(ev.name, contentLanguage) : ev.name;

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
        <div
            data-time-row={time}
            className={clsx(
                "absolute left-0 w-full md:w-fit flex h-[50px] group  duration-75",
                "hover:bg-app-surface2",
                // perf #59: ビューポート外行を style/layout/paint からスキップ。 行 height は h-[50px] と一致
                "[content-visibility:auto] [contain-intrinsic-size:auto_50px]",
                showRowBorders && "border-b border-app-border",
                (timelineSelectMode || labelSelectMode) && "cursor-pointer"
            )}
            style={{
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
                ) : events.length === 1 ? (
                    /* 1イベント */
                    <div className="w-full h-full relative group/slot">
                        <div
                            className="w-full h-full flex items-center px-2 gap-1 md:gap-2 cursor-pointer hover:bg-app-surface2"
                            onClick={(e) => {
                                if (window.innerWidth < 768) {
                                    handleMobileTap(e);
                                } else {
                                    onEventClick(events[0], e);
                                }
                            }}
                        >
                            {/* 種別: PC=クリックで循環 / モバイル=表示のみ(両方とも赤箱印あり) */}
                            <PcTypeToggle event={events[0]} />
                            <DamageTypeIcon damageType={events[0].damageType} ignoresDebuffMitigation={events[0].ignoresDebuffMitigation} size="w-3 h-3" className="md:hidden" />

                            {/* 攻撃名（省略時にネイティブツールチップ表示） */}
                            <EventNameSpan name={getEventName(events[0])} className="text-app-md md:text-app-lg" />

                            {/* スマホ専用: 対象バッジ */}
                            <div className="md:hidden flex-shrink-0">
                                <MobileTargetBadge partyMembers={partyMembers} effTarget={getEffectiveTarget(events[0], swapMarkers, phases)} />
                            </div>

                            {/* スマホ専用: 軽減アイコン */}
                            <MobileMitiIcons
                                mitigations={activeMitigations}
                                contentLanguage={contentLanguage}
                                myMemberId={myMemberId}
                            />

                            {/* PC専用: Target(右端固定・クリックで MT⇄ST トグル)。コピーはホバー時だけ幅を開く
                                (非ホバー=w-0で攻撃名フル幅 / ホバー=w-8で名前が縮みコピーが重ならず収まる)。対象が無い(AoE)行は右端に出る */}
                            <div className="hidden md:flex items-center flex-shrink-0 ml-auto">
                                <div className="w-0 overflow-hidden flex justify-start group-hover/slot:w-8 transition-[width] duration-150">
                                    <PcCopyButton event={events[0]} />
                                </div>
                                <PcTargetToggle event={events[0]} partyMembers={partyMembers} effTarget={getEffectiveTarget(events[0], swapMarkers, phases)} />
                            </div>
                        </div>

                        {/* PC専用: イベント追加ボタン */}
                        <div
                            className="absolute bottom-0 inset-x-0 h-[12px] items-center justify-center cursor-pointer hover:bg-app-surface2 transition-all opacity-0 group-hover/slot:opacity-100 z-10 hidden md:flex"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddEventClick(time, e);
                            }}
                        >
                            <Plus size={10} className="text-app-text-muted scale-75" />
                        </div>
                    </div>
                ) : (
                    /* 2イベント */
                    <>
                        {[0, 1].map((idx) => (
                            <div key={idx} className={clsx("flex-1 w-full relative group/slot", idx === 0 && showRowBorders && "border-b border-app-border")}>
                                <div
                                    className="w-full h-full flex items-center px-2 gap-1 md:gap-2 cursor-pointer hover:bg-app-surface2"
                                    onClick={(e) => {
                                        if (window.innerWidth < 768) {
                                            handleMobileTap(e);
                                        } else {
                                            onEventClick(events[idx], e);
                                        }
                                    }}
                                >
                                    {/* 種別アイコン */}
                                    {/* 種別: PC=クリックで循環 / モバイル=表示のみ(両方とも赤箱印あり) */}
                                    <PcTypeToggle event={events[idx]} />
                                    <DamageTypeIcon damageType={events[idx].damageType} ignoresDebuffMitigation={events[idx].ignoresDebuffMitigation} size="w-3 h-3" className="md:hidden" />

                                    {/* 攻撃名（省略時にネイティブツールチップ表示） */}
                                    <EventNameSpan name={getEventName(events[idx])} className="text-app-base md:text-app-lg" />

                                    {/* スマホ専用: 対象バッジ */}
                                    <div className="md:hidden flex-shrink-0">
                                        <MobileTargetBadge partyMembers={partyMembers} effTarget={getEffectiveTarget(events[idx], swapMarkers, phases)} />
                                    </div>

                                    {/* スマホ専用: 軽減アイコン（2イベント時は小さめ） */}
                                    <MobileMitiIcons
                                        mitigations={activeMitigations}
                                        contentLanguage={contentLanguage}
                                        myMemberId={myMemberId}
                                        size="w-2.5 h-2.5"
                                    />

                                    {/* PC専用: Target(右端固定・クリックで MT⇄ST トグル)。コピーはホバー時だけ幅を開く
                                        (非ホバー=w-0で攻撃名フル幅 / ホバー=w-8で名前が縮みコピーが重ならず収まる)。対象が無い(AoE)行は右端に出る */}
                                    <div className="hidden md:flex items-center flex-shrink-0 ml-auto">
                                        <div className="w-0 overflow-hidden flex justify-start group-hover/slot:w-8 transition-[width] duration-150">
                                            <PcCopyButton event={events[idx]} />
                                        </div>
                                        <PcTargetToggle event={events[idx]} partyMembers={partyMembers} effTarget={getEffectiveTarget(events[idx], swapMarkers, phases)} badgeTextClass="text-app-sm" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
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
                {events.length === 1 ? (
                    <div className="w-full h-full flex items-center justify-center">
                        {damages[0] && damages[0].unmitigated > 0 ? formatDmg(damages[0].unmitigated) : ''}
                    </div>
                ) : (
                    <>
                        <div className={clsx("flex-1 w-full flex items-center justify-center", showRowBorders && "border-b border-app-border")}>
                            {damages[0] && damages[0].unmitigated > 0 ? formatDmg(damages[0].unmitigated) : ''}
                        </div>
                        <div className="flex-1 w-full flex items-center justify-center">
                            {damages[1] && damages[1].unmitigated > 0 ? formatDmg(damages[1].unmitigated) : ''}
                        </div>
                    </>
                )}
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
                {events.length === 1 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 leading-none">
                        {damages[0] && (damages[0].unmitigated > 0 || damages[0].isInvincible) ? (
                            <>
                                {(() => {
                                    const evt = events[0];
                                    const dmg = damages[0];
                                    // 致死判定は挑発によるタンクスイッチ後の実効ターゲットで行う
                                    const evtEff = getEffectiveTarget(evt, swapMarkers, phases);
                                    let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                    if (evtEff === 'MT' || evtEff === 'ST') {
                                        maxHp = partyMembers.find(m => m.id === evtEff)?.stats.hp || 1;
                                    }
                                    const isLethal = dmg.mitigated >= maxHp;
                                    const colorClass = isLethal
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-green-600 dark:text-green-400";
                                    return <AnimatedDamage value={dmg.mitigated} isLethal={isLethal} className={colorClass} />;
                                })()}
                                {damages[0].isInvincible ? (
                                    <div className="text-app-sm text-app-text-sec font-black tracking-tighter scale-90 whitespace-nowrap">
                                        {t('timeline.invuln', 'Invuln')}
                                    </div>
                                ) : (damages[0].mitigationPercent > 0 || damages[0].shieldTotal > 0) ? (
                                    <div className="text-app-sm text-app-text-sec font-black tracking-tighter scale-90 whitespace-nowrap hidden md:flex flex-row items-center justify-center gap-1 w-full px-1 truncate leading-none">
                                        {damages[0].mitigationPercent > 0 && <span>▼ {damages[0].mitigationPercent}%</span>}
                                        {damages[0].mitigationPercent > 0 && damages[0].shieldTotal > 0 && <span className="opacity-50">|</span>}
                                        {damages[0].shieldTotal > 0 && (
                                            <span className="flex items-center gap-0.5">
                                                🛡️ {damages[0].shieldTotal.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                ) : null}
                            </>
                        ) : ''}
                    </div>
                ) : (
                    <>
                        {[0, 1].map((idx) => (
                            <div key={idx} className={clsx("flex-1 w-full flex flex-col items-center justify-center gap-0 leading-none",
                                idx === 0 && showRowBorders && "border-b border-app-border"
                            )}>
                                {damages[idx] && (damages[idx].unmitigated > 0 || damages[idx].isInvincible) ? (
                                    <>
                                        {(() => {
                                            const evt = events[idx];
                                            const dmg = damages[idx];
                                            // 致死判定は挑発によるタンクスイッチ後の実効ターゲットで行う
                                            const evtEff = getEffectiveTarget(evt, swapMarkers, phases);
                                            let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                            if (evtEff === 'MT' || evtEff === 'ST') {
                                                maxHp = partyMembers.find(m => m.id === evtEff)?.stats.hp || 1;
                                            }
                                            const isLethal = dmg.mitigated >= maxHp;
                                            const colorClass = isLethal
                                                ? "text-red-600 dark:text-red-400"
                                                : "text-green-600 dark:text-green-400";
                                            return <AnimatedDamage value={dmg.mitigated} isLethal={isLethal} className={`${colorClass} !h-[16px]`} />;
                                        })()}
                                        {damages[idx].isInvincible ? (
                                            <div className="text-app-sm text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap">
                                                {t('timeline.invuln', 'Invuln')}
                                            </div>
                                        ) : (damages[idx].mitigationPercent > 0 || damages[idx].shieldTotal > 0) ? (
                                            <div className="text-app-sm text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap hidden md:flex flex-row items-center justify-center gap-1 w-full px-1 truncate leading-none">
                                                {damages[idx].mitigationPercent > 0 && <span>▼ {damages[idx].mitigationPercent}%</span>}
                                                {damages[idx].mitigationPercent > 0 && damages[idx].shieldTotal > 0 && <span className="opacity-50">|</span>}
                                                {damages[idx].shieldTotal > 0 && (
                                                    <span className="flex items-center gap-0.5">
                                                        🛡️ {damages[idx].shieldTotal.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        ) : null}
                                    </>
                                ) : ''}
                            </div>
                        ))}
                    </>
                )}
            </div >

            {/* Job Columns Cells — PC専用 */}
            {
                partyMembers.map((member) => (
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
        </div>
    );
}, (prevProps, nextProps) => {
    if (prevProps.time !== nextProps.time) return false;
    if (prevProps.top !== nextProps.top) return false;
    if (prevProps.events !== nextProps.events) return false;
    if (prevProps.damages !== nextProps.damages) return false;
    if (prevProps.partyMembers !== nextProps.partyMembers) return false;
    if (prevProps.activeMitigations !== nextProps.activeMitigations) {
        if (prevProps.activeMitigations.length !== nextProps.activeMitigations.length) return false;
        for (let i = 0; i < prevProps.activeMitigations.length; i++) {
            if (prevProps.activeMitigations[i] !== nextProps.activeMitigations[i]) return false;
        }
    }
    if (prevProps.phaseColumnCollapsed !== nextProps.phaseColumnCollapsed) return false;
    if (prevProps.labelColumnVisible !== nextProps.labelColumnVisible) return false;
    return true;
});
