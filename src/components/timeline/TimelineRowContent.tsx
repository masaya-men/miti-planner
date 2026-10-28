import React, { memo } from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import type { TimelineEvent } from '../../types';
import { formatEventName } from '../../utils/eventName';
import { getColumnCssVar } from '../../utils/calculator';
import { getEffectiveTarget } from '../../utils/effectiveTarget';
import { useThemeStore, useEffectiveThemeStyle } from '../../store/useThemeStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { Tooltip } from '../ui/Tooltip';
import { DamageTypeIcon } from '../DamageTypeIcon';
import { EventNameSpan } from '../EventNameSpan';
import { rowPropsEqual } from './rowPropsEqual';
import { sheetMemberStyle } from './sheet/sheetStyle';
import type { TimelineRowContentProps } from './timelineRowTypes';
import { MobileTargetBadge, MobileMitiIcons } from './TimelineRowMobileParts';
import { PcTypeToggle, PcTargetToggle, PcCopyButton, PcAddEventButton } from './TimelineRowPcControls';
import { DamageTakenCell } from './TimelineRowDamageTaken';
import { isEventLethal } from './isEventLethal';
import { matchesMobile } from '../../hooks/useIsMobile';

// TimelineRowContent(中身): 列のセル群。top/height は受け取らない(使わない)。
export const TimelineRowContent = memo(({
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
    sheetCols,
    swapMarkers,
    phases,
    labels,
}: TimelineRowContentProps) => {
    const contentLanguage = useThemeStore(state => state.contentLanguage);
    const isMilspec = useEffectiveThemeStyle() === 'military';
    const myMemberId = useMitigationStore(state => state.myMemberId);
    const orConnector = labels.orConnector;
    const getEventName = (ev: TimelineEvent) => formatEventName(ev, contentLanguage, orConnector);

    const isMobileRow = matchesMobile(window);
    const formatDmg = (val: number) => {
        if (!isMobileRow) return val.toLocaleString();
        if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
        return String(val);
    };

    // スマホ: どこをタップしても軽減追加を開く
    const handleMobileTap = (e: React.MouseEvent) => {
        if (matchesMobile(window) && onMobileDamageClick && events.length > 0) {
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
                        if (matchesMobile(window)) {
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
                        <Tooltip content={labels.endPhase} position="right">
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
                        if (matchesMobile(window)) {
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
                        <Tooltip content={labels.addLabel} position="top">
                            <div className="hidden md:flex items-center justify-center w-full h-full text-app-text-muted opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                                <Plus size={14} />
                            </div>
                        </Tooltip>
                    )}
                </div>
            ) : (
                <div className="w-[16px] min-w-[16px] max-w-[16px] border-r border-app-border h-full hidden md:block" />
            )}

            {/* Time Column — スマホ: 軽減追加(data-stack = 同時刻の攻撃数。軍事の表の括弧と ×N 用・標準の見た目には効かない) */}
            <div
                data-stack={isMilspec && events.length > 1 ? events.length : undefined}
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
                        <Tooltip content={labels.addEvent} position="top">
                            <Plus size={16} className={clsx(
                                "text-app-text-muted",
                                "[.tutorial-target-highlight_&]:text-app-text"
                            )} />
                        </Tooltip>
                    </div>
                ) : (
                    /* 1 件以上: 攻撃 1 つ = 1 段。段を攻撃の数だけ縦に並べる(行の高さ = 1 段 × 攻撃数・各段は flex-1 で等分) */
                    events.map((event, idx) => (
                        <div key={event.id} data-event-slot={isMilspec ? '' : undefined} data-lethal={isMilspec && isEventLethal(event, damages[idx], partyMembers, swapMarkers, phases) ? '' : undefined} className={clsx("flex-1 min-h-0 w-full relative group/slot", idx < events.length - 1 && showRowBorders && "border-b border-app-border")}>
                            <div
                                className="w-full h-full flex items-center px-2 gap-1 md:gap-2 cursor-pointer hover:bg-app-surface2"
                                onClick={(e) => {
                                    if (matchesMobile(window)) {
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
                    if (matchesMobile(window) && onMobileDamageClick) {
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
                    "border-app-border text-app-text"
                )}
                onClick={(e) => {
                    if (matchesMobile(window) && onMobileDamageClick) {
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
                visiblePartyMembers.map((member) => {
                    // スプシ表示: 列数 × --sheet-col-w の幅(縦罫線は sheet.css が [data-sheet-cols] に引く)。1 人 1 要素のまま
                    const sheetN = sheetCols ? (sheetCols.get(member.id) ?? 0) : null;
                    return (
                    <div
                        key={member.id}
                        data-job-col=""
                        data-sheet-cols={sheetN ?? undefined}
                        data-tutorial={
                            member.id === 'MT' && time === 4 ? 'miti-cell-mt-4' :
                                member.id === 'ST' && time === 4 ? 'miti-cell-st-4' :
                                    member.id === 'ST' && time === 10 ? 'miti-cell-st-10' : undefined
                        }
                        className={clsx(
                            "hidden md:flex h-full items-center justify-center relative group/cell cursor-pointer  border-r",
                            sheetN === null ? "border-app-border" : "border-app-text/20"
                        )}
                        style={sheetN === null
                            ? { width: getColumnCssVar(member.role), minWidth: getColumnCssVar(member.role), maxWidth: getColumnCssVar(member.role) }
                            : sheetMemberStyle(sheetN)}
                        onClick={(e) => onCellClick(member.id, time, e)}
                    >
                        <Tooltip content={labels.mitigationSelect} position="top">
                            <div className="w-full h-full" />
                        </Tooltip>
                    </div>
                    );
                })
            }
        </>
    );
}, (prevProps, nextProps) => rowPropsEqual(prevProps, nextProps, ['events', 'damages', 'activeMitigations']));
