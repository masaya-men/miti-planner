import React, { memo } from 'react';
import { Plus, Copy } from 'lucide-react';
import clsx from 'clsx';
import type { PartyMember, TimelineEvent, AppliedMitigation } from '../types';
import { getColumnWidth } from '../utils/calculator';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import { useMitigationStore } from '../store/useMitigationStore';
import { Tooltip } from './ui/Tooltip';

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
    onDamageClick?: (time: number, e: React.MouseEvent) => void;
    onMobileDamageClick?: (time: number, e: React.MouseEvent) => void;
    phaseColumnCollapsed?: boolean;
}

// スマホ用: 対象バッジ（AoE以外の場合に表示）
const MobileTargetBadge: React.FC<{ event: TimelineEvent; partyMembers: PartyMember[] }> = ({ event, partyMembers }) => {
    const JOBS = useJobs();
    if (event.target === 'AoE') return null;
    const member = partyMembers.find(m => m.id === event.target);
    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
    if (job) {
        return <img src={job.icon} className="w-3 h-3 rounded-sm flex-shrink-0" alt={event.target} />;
    }
    return (
        <span className={clsx(
            "text-[7px] font-black px-0.5 rounded flex-shrink-0",
            event.target === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10"
        )}>
            {event.target}
        </span>
    );
};

// スマホ用: 軽減アイコンリスト
const MobileMitiIcons: React.FC<{
    mitigations: AppliedMitigation[];
    contentLanguage: string;
    myJobHighlight: boolean;
    myMemberId: string | null;
    size?: string;
}> = ({ mitigations, contentLanguage, myJobHighlight, myMemberId, size = 'w-3 h-3' }) => {
    const MITIGATIONS = useMitigations();
    return (
    <div className="flex md:hidden items-center gap-px flex-shrink-0">
        {mitigations.map(mit => {
            const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
            if (!def) return null;
            const isDimmed = myJobHighlight && myMemberId && mit.ownerId !== myMemberId;
            return (
                <img
                    key={mit.id}
                    src={def.icon}
                    alt={contentLanguage === 'en' ? def.name?.en : def.name?.ja}
                    className={clsx(
                        size, "object-cover rounded-sm",
                        isDimmed ? "opacity-40 grayscale" : "opacity-90"
                    )}
                />
            );
        })}
    </div>
); };

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
    onDamageClick,
    onMobileDamageClick,
    phaseColumnCollapsed,
}: TimelineRowProps) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const JOBS = useJobs();
    const setClipboardEvent = useMitigationStore(state => state.setClipboardEvent);
    const myJobHighlight = useMitigationStore(state => state.myJobHighlight);
    const myMemberId = useMitigationStore(state => state.myMemberId);

    const getEventName = (ev: TimelineEvent) =>
        contentLanguage === 'en' && ev.name?.en ? ev.name?.en : ev.name?.ja;

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
                useMitigationStore.getState().showRowBorders && "border-b border-app-border"
            )}
            style={{ top: `${top}px` }}
        >
            {/* Phase Column — スマホ: 軽減追加 / PC: フェーズ追加 */}
            {!phaseColumnCollapsed ? (
                <div
                    className={clsx(
                        "w-[24px] md:w-[100px] border-r h-full relative flex items-center justify-center group-hover:text-app-text",
                        "border-app-border",
                        "md:cursor-pointer md:hover:bg-app-surface2"
                    )}
                    onClick={(e) => {
                        if (window.innerWidth < 768) {
                            handleMobileTap(e);
                        } else {
                            onPhaseAdd(time, e);
                        }
                    }}
                >
                    <Tooltip content={t('timeline.end_phase')} position="right">
                        <div className="hidden md:flex items-center justify-center w-full h-full text-app-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus size={16} />
                        </div>
                    </Tooltip>
                </div>
            ) : (
                <div className="w-[16px] min-w-[16px] max-w-[16px] border-r border-app-border h-full hidden md:block" />
            )}

            {/* Time Column — スマホ: 軽減追加 */}
            <div
                className={clsx(
                    "w-[36px] md:w-[70px] border-r h-full flex items-center justify-center relative font-mono text-[9px] md:text-sm group-hover:text-app-text group-hover:font-black",
                    "border-app-border text-app-text-sec hover:bg-app-surface2"
                )}
                onClick={handleMobileTap}
            >
                {formattedTime}
            </div >

            {/* Event Column */}
            <div className={clsx(
                "flex-1 md:flex-none md:w-[200px] border-r h-full relative flex flex-col",
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
                            "w-full h-full items-center justify-center cursor-pointer transition-all",
                            "hidden md:flex",
                            "opacity-0 group-hover:opacity-100 hover:bg-app-surface2",
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
                            {/* 種別アイコン */}
                            {events[0].damageType === 'magical' && <img src="/icons/type_magic.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt={t('modal.magical')} />}
                            {events[0].damageType === 'physical' && <img src="/icons/type_phys.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt={t('modal.physical')} />}
                            {events[0].damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt={t('modal.unique')} />}

                            {/* 攻撃名（スマホ: truncate + 長押しで全文、PC: 通常表示） */}
                            <span
                                className="text-[11px] md:text-xs font-black text-app-text truncate leading-none pt-0.5 min-w-0"
                                title={getEventName(events[0])}
                            >
                                {getEventName(events[0])}
                            </span>

                            {/* PC専用: コピーボタン */}
                            <Tooltip content={t('timeline.copy_event_hint')} position="top">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setClipboardEvent(events[0]);
                                    }}
                                    className="ml-1 text-app-text-sec hover:text-app-accent opacity-0 group-hover/slot:opacity-100 transition-all cursor-pointer flex-shrink-0 hidden md:block"
                                >
                                    <Copy size={14} />
                                </button>
                            </Tooltip>

                            {/* スマホ専用: 対象バッジ */}
                            <div className="md:hidden flex-shrink-0">
                                <MobileTargetBadge event={events[0]} partyMembers={partyMembers} />
                            </div>

                            {/* スマホ専用: 軽減アイコン */}
                            <MobileMitiIcons
                                mitigations={activeMitigations}
                                contentLanguage={contentLanguage}
                                myJobHighlight={myJobHighlight}
                                myMemberId={myMemberId}
                            />

                            {/* PC専用: Target */}
                            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0 ml-auto">
                                {(events[0].target === 'MT' || events[0].target === 'ST') && (
                                    <>
                                        <span className="text-[10px] text-app-text-muted font-mono">on</span>
                                        {(() => {
                                            const member = partyMembers.find(m => m.id === events[0].target);
                                            const job = member ? JOBS.find(j => j.id === member.jobId) : null;
                                            return job ? (
                                                <img src={job.icon} className="w-5 h-5 rounded-sm" alt={events[0].target} />
                                            ) : (
                                                <span className={clsx(
                                                    "text-[10px] font-bold px-1 rounded",
                                                    events[0].target === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10"
                                                )}>
                                                    {events[0].target}
                                                </span>
                                            );
                                        })()}
                                    </>
                                )}
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
                            <div key={idx} className={clsx("flex-1 w-full relative group/slot", idx === 0 && useMitigationStore.getState().showRowBorders && "border-b border-app-border")}>
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
                                    {events[idx].damageType === 'magical' && <img src="/icons/type_magic.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt={t('modal.magical')} />}
                                    {events[idx].damageType === 'physical' && <img src="/icons/type_phys.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt={t('modal.physical')} />}
                                    {events[idx].damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt={t('modal.unique')} />}

                                    {/* 攻撃名 */}
                                    <span
                                        className="text-[10px] md:text-xs font-black text-app-text truncate leading-none pt-0.5 min-w-0"
                                        title={getEventName(events[idx])}
                                    >
                                        {getEventName(events[idx])}
                                    </span>

                                    {/* PC専用: コピーボタン */}
                                    <Tooltip content={t('timeline.copy_event_hint')} position="top">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setClipboardEvent(events[idx]);
                                            }}
                                            className="ml-1 text-app-text-sec hover:text-app-accent opacity-0 group-hover/slot:opacity-100 transition-all cursor-pointer flex-shrink-0 hidden md:block"
                                        >
                                            <Copy size={14} />
                                        </button>
                                    </Tooltip>

                                    {/* スマホ専用: 対象バッジ */}
                                    <div className="md:hidden flex-shrink-0">
                                        <MobileTargetBadge event={events[idx]} partyMembers={partyMembers} />
                                    </div>

                                    {/* スマホ専用: 軽減アイコン（2イベント時は小さめ） */}
                                    <MobileMitiIcons
                                        mitigations={activeMitigations}
                                        contentLanguage={contentLanguage}
                                        myJobHighlight={myJobHighlight}
                                        myMemberId={myMemberId}
                                        size="w-2.5 h-2.5"
                                    />

                                    {/* PC専用: Target */}
                                    <div className="hidden md:flex items-center gap-1.5 flex-shrink-0 ml-auto">
                                        {(events[idx].target === 'MT' || events[idx].target === 'ST') && (
                                            <>
                                                <span className="text-[10px] text-app-text-muted font-mono">on</span>
                                                {(() => {
                                                    const member = partyMembers.find(m => m.id === events[idx].target);
                                                    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
                                                    return job ? (
                                                        <img src={job.icon} className="w-4 h-4 rounded-sm" alt={events[idx].target} />
                                                    ) : (
                                                        <span className={clsx(
                                                            "text-[9px] font-bold px-1 rounded",
                                                            events[idx].target === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10"
                                                        )}>
                                                            {events[idx].target}
                                                        </span>
                                                    );
                                                })()}
                                            </>
                                        )}
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
                    "w-[50px] md:w-[100px] border-r h-full flex flex-col items-center justify-center text-[10px] md:text-sm font-mono font-black group-hover:text-app-text cursor-pointer md:cursor-default",
                    "border-app-border text-app-text-sec"
                )}
                onClick={(e) => {
                    if (window.innerWidth < 768 && onMobileDamageClick) {
                        onMobileDamageClick(time, e);
                    } else if (onDamageClick) {
                        onDamageClick(time, e);
                    }
                }}
            >
                {events.length === 1 ? (
                    <div className="w-full h-full flex items-center justify-center">
                        {damages[0] && damages[0].unmitigated > 0 ? formatDmg(damages[0].unmitigated) : ''}
                    </div>
                ) : (
                    <>
                        <div className={clsx("flex-1 w-full flex items-center justify-center", useMitigationStore.getState().showRowBorders && "border-b border-app-border")}>
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
                    "w-[50px] md:w-[100px] border-r h-full flex flex-col items-center justify-center text-[10px] md:text-sm font-mono font-black  group-hover:text-app-text cursor-pointer md:cursor-default",
                    "border-app-border text-app-text-primary"
                )}
                onClick={(e) => {
                    if (window.innerWidth < 768 && onMobileDamageClick) {
                        onMobileDamageClick(time, e);
                    } else if (onDamageClick) {
                        onDamageClick(time, e);
                    }
                }}
            >
                {events.length === 1 ? (
                    <div className={clsx("w-full h-full flex flex-col items-center justify-center gap-0.5 leading-none", (() => {
                        const evt = events[0];
                        const dmg = damages[0];
                        if (!evt || !dmg) return "";
                        if (dmg.unmitigated <= 0) return "";
                        let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                        if (evt.target === 'MT' || evt.target === 'ST') {
                            maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                        }
                        const isLethal = dmg.mitigated >= maxHp;
                        return isLethal ? "bg-red-500/10" : "";
                    })())}>
                        {damages[0] && (damages[0].unmitigated > 0 || damages[0].isInvincible) ? (
                            <>
                                <span className={clsx(
                                    (() => {
                                        const evt = events[0];
                                        const dmg = damages[0];
                                        let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                        if (evt.target === 'MT' || evt.target === 'ST') {
                                            maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                                        }
                                        const isLethal = dmg.mitigated >= maxHp;
                                        return isLethal ? "text-red-600 dark:text-red-400 font-black shadow-sm" : "text-green-600 dark:text-green-400";
                                    })()
                                )}>
                                    {formatDmg(damages[0].mitigated)}
                                </span>
                                {damages[0].isInvincible ? (
                                    <div className="text-[9px] text-app-text-sec font-black tracking-tighter scale-90 whitespace-nowrap">
                                        {t('timeline.invuln', 'Invuln')}
                                    </div>
                                ) : (damages[0].mitigationPercent > 0 || damages[0].shieldTotal > 0) ? (
                                    <div className="text-[9px] text-app-text-sec font-black tracking-tighter scale-90 whitespace-nowrap hidden md:flex flex-row items-center justify-center gap-1 w-full px-1 truncate leading-none">
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
                            <div key={idx} className={clsx("flex-1 w-full flex flex-col items-center justify-center gap-0.5 leading-none",
                                idx === 0 && useMitigationStore.getState().showRowBorders && "border-b border-app-border",
                                (() => {
                                    const evt = events[idx];
                                    const dmg = damages[idx];
                                    if (!evt || !dmg) return "";
                                    if (dmg.unmitigated <= 0) return "";
                                    let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                    if (evt.target === 'MT' || evt.target === 'ST') {
                                        maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                                    }
                                    const isLethal = dmg.mitigated >= maxHp;
                                    return isLethal ? "bg-red-500/10" : "";
                                })()
                            )}>
                                {damages[idx] && (damages[idx].unmitigated > 0 || damages[idx].isInvincible) ? (
                                    <>
                                        <span className={clsx(
                                            (() => {
                                                const evt = events[idx];
                                                const dmg = damages[idx];
                                                let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                                if (evt.target === 'MT' || evt.target === 'ST') {
                                                    maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                                                }
                                                const isLethal = dmg.mitigated >= maxHp;
                                                return isLethal ? "text-red-600 dark:text-red-400 font-black shadow-sm" : "text-green-600 dark:text-green-400";
                                            })()
                                        )}>
                                            {formatDmg(damages[idx].mitigated)}
                                        </span>
                                        {damages[idx].isInvincible ? (
                                            <div className="text-[9px] text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap">
                                                {t('timeline.invuln', 'Invuln')}
                                            </div>
                                        ) : (damages[idx].mitigationPercent > 0 || damages[idx].shieldTotal > 0) ? (
                                            <div className="text-[9px] text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap hidden md:flex flex-row items-center justify-center gap-1 w-full px-1 truncate leading-none">
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
                        style={{ width: `${getColumnWidth(member.role)}px`, minWidth: `${getColumnWidth(member.role)}px`, maxWidth: `${getColumnWidth(member.role)}px` }}
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
    return true;
});
