import React, { memo } from 'react';
import { Plus, Copy } from 'lucide-react';
import clsx from 'clsx';
import type { PartyMember, TimelineEvent } from '../types';
import { getColumnWidth } from './Timeline';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { JOBS, MITIGATIONS } from '../data/mockData';
import { useMitigationStore } from '../store/useMitigationStore';

interface DamageInfo {
    unmitigated: number;
    mitigated: number;
    mitigationPercent: number;
    shieldTotal: number;
    isInvincible?: boolean;
}

interface TimelineRowProps {
    time: number;
    top: number;
    damages: (DamageInfo | null)[];
    events: TimelineEvent[];
    partyMembers: PartyMember[];
    onPhaseAdd: (time: number, e: React.MouseEvent) => void;
    onAddEventClick: (time: number, e: React.MouseEvent) => void;
    onEventClick: (event: TimelineEvent, e: React.MouseEvent) => void;
    onCellClick: (memberId: string, time: number, e: React.MouseEvent) => void;
    onDamageClick?: (time: number, e: React.MouseEvent) => void;
    // 👇 追加：スマホ専用の中央ポップアップを開くための関数
    onMobileDamageClick?: (time: number, e: React.MouseEvent) => void;
    partySortOrder: 'light_party' | 'role';
}

export const TimelineRow = memo(({
    time,
    top,
    damages,
    events,
    partyMembers,
    onPhaseAdd,
    onAddEventClick,
    onEventClick,
    onCellClick,
    onDamageClick,
    onMobileDamageClick, // 👈 追加
    partySortOrder
}: TimelineRowProps) => {
    const { t } = useTranslation();
    const { theme, contentLanguage } = useThemeStore();
    const setClipboardEvent = useMitigationStore(state => state.setClipboardEvent);
    // 👇 追加：スマホ版でアイコンを表示するために、現在のアクティブな軽減を取得
    const timelineMitigations = useMitigationStore(state => state.timelineMitigations);
    const myJobHighlight = useMitigationStore(state => state.myJobHighlight);
    const myMemberId = useMitigationStore(state => state.myMemberId);

    // Bilingual event name helper
    const getEventName = (ev: TimelineEvent) =>
        contentLanguage === 'en' && ev.nameEn ? ev.nameEn : ev.name;

    const displayTimeStr = Math.floor(Math.abs(time) / 60) + ':' + (Math.abs(time) % 60).toString().padStart(2, '0');
    const formattedTime = time < 0 && time > -60 ? `-0:${(Math.abs(time) % 60).toString().padStart(2, '0')}` :
        time < 0 ? `-${displayTimeStr}` :
            displayTimeStr;

    // 👇 追加：この時間にアクティブな軽減をリストアップする関数（スマホ表示用）
    const getActiveMitigationsForTime = (currentTime: number) => {
        return timelineMitigations.filter(m => m.time <= currentTime && currentTime < m.time + m.duration);
    };

    return (
        <div
            className={clsx(
                "absolute left-0 w-full md:w-fit border-b flex h-[50px] group transition-colors duration-75",
                theme === 'dark'
                    ? "border-white/[0.03] hover:bg-white/[0.04]"
                    : "border-slate-200 hover:bg-slate-100"
            )}
            style={{ top: `${top}px` }}
        >
            {/* Phase Column */}
            <div
                className={
                    clsx(
                        "w-[30px] md:w-[100px] border-r h-full relative cursor-pointer flex items-center justify-center transition-colors group-hover:text-slate-900 dark:group-hover:text-slate-100",
                        theme === 'dark' ? "border-white/[0.02]" : "border-slate-200"
                    )}
                onClick={(e) => onPhaseAdd(time, e)}
                title={t('timeline.end_phase')}
            >
                <div className="flex items-center justify-center w-full h-full text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={16} />
                </div>
            </div >

            {/* Time Column */}
            <div className={clsx(
                "w-[40px] md:w-[70px] border-r h-full flex items-center justify-center relative font-mono text-[10px] md:text-sm transition-colors group-hover:text-slate-900 dark:group-hover:text-slate-100 group-hover:font-bold",
                theme === 'dark' ? "border-white/[0.02] text-slate-400" : "border-slate-200 text-slate-600"
            )}>
                {formattedTime}
            </div >

            {/* Event Column (Vertical Stack, Max 2) */}
            <div className={clsx(
                "flex-1 md:flex-none md:w-[200px] border-r h-full relative flex flex-col transition-colors",
                theme === 'dark' ? "border-white/[0.02] group-hover:bg-white/[0.02]" : "border-slate-200 group-hover:bg-slate-50"
            )}>
                {events.length === 0 ? (
                    <div
                        className={clsx(
                            "w-full h-full flex items-center justify-center cursor-pointer hover:bg-white/[0.05] transition-all opacity-0 group-hover:opacity-100"
                        )}
                        onClick={(e) => onAddEventClick(time, e)}
                    >
                        <Plus size={16} className="text-slate-600 hover:text-slate-600 dark:text-slate-400 transition-colors" />
                    </div>
                ) : events.length === 1 ? (
                    <div className="w-full h-full relative group/slot">
                        <div
                            // 👇 スマホ表示用に少し padding や flex-col を調整
                            className="w-full h-full flex flex-col md:flex-row md:items-center justify-center md:justify-between px-2 cursor-pointer hover:bg-white/[0.05] transition-colors gap-0.5 md:gap-2"
                            onClick={(e) => onEventClick(events[0], e)}
                            title={`${getEventName(events[0])} (${events[0].damageAmount?.toLocaleString()})`}
                        >
                            {/* Left Side: Icon + Name */}
                            <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
                                {events[0].damageType === 'magical' && <img src="/icons/type_magic.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Magical" />}
                                {events[0].damageType === 'physical' && <img src="/icons/type_phys.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Physical" />}
                                {events[0].damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Dark" />}

                                <span className="text-[11px] md:text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-none pt-0.5">{getEventName(events[0])}</span>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setClipboardEvent(events[0]);
                                    }}
                                    className="ml-2 text-slate-500 hover:text-blue-400 opacity-0 group-hover/slot:opacity-100 transition-all cursor-pointer flex-shrink-0"
                                    title="このイベントをコピーしてスタンプする"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>

                            {/* 👇 スマホ専用：軽減アイコンのリスト（PCでは md:hidden で隠す） */}
                            <div className="flex md:hidden items-center gap-0.5 flex-wrap pl-4">
                                {getActiveMitigationsForTime(time).map(mit => {
                                    const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
                                    if (!def) return null;
                                    const isDimmed = myJobHighlight && myMemberId && mit.ownerId !== myMemberId;
                                    return (
                                        <img
                                            key={mit.id}
                                            src={def.icon}
                                            alt={def.name}
                                            className={clsx(
                                                "w-3.5 h-3.5 object-cover rounded transition-all",
                                                isDimmed ? "opacity-40 grayscale" : "opacity-90"
                                            )}
                                        />
                                    );
                                })}
                            </div>

                            {/* Right Side: Target (PC & Mobile) */}
                            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                                {(events[0].target === 'MT' || events[0].target === 'ST') && (
                                    <>
                                        <span className="text-[10px] text-slate-500 font-mono">on</span>
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

                        <div
                            className={clsx(
                                "absolute bottom-0 inset-x-0 h-[12px] flex items-center justify-center cursor-pointer hover:bg-slate-900/ dark:hover:bg-white/ transition-all opacity-0 group-hover/slot:opacity-100 z-10"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddEventClick(time, e);
                            }}
                            title="Add event"
                        >
                            <Plus size={10} className="text-slate-600 dark:text-slate-400 scale-75" />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 w-full border-b border-white/[0.02] relative group/slot">
                            <div
                                className="w-full h-full flex items-center justify-between px-2 cursor-pointer hover:bg-white/[0.05] transition-colors gap-2"
                                onClick={(e) => onEventClick(events[0], e)}
                                title={`${getEventName(events[0])} (${events[0].damageAmount?.toLocaleString()})`}
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {events[0].damageType === 'magical' && <img src="/icons/type_magic.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Magical" />}
                                    {events[0].damageType === 'physical' && <img src="/icons/type_phys.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Physical" />}
                                    {events[0].damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Dark" />}
                                    <span className="text-[11px] md:text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-none pt-0.5">{getEventName(events[0])}</span>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setClipboardEvent(events[0]);
                                        }}
                                        className="ml-2 text-slate-500 hover:text-blue-400 opacity-0 group-hover/slot:opacity-100 transition-all cursor-pointer flex-shrink-0"
                                        title="このイベントをコピーしてスタンプする"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>

                                <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                                    {(events[0].target === 'MT' || events[0].target === 'ST') && (
                                        <>
                                            <span className="text-[10px] text-slate-500 font-mono">on</span>
                                            {(() => {
                                                const member = partyMembers.find(m => m.id === events[0].target);
                                                const job = member ? JOBS.find(j => j.id === member.jobId) : null;
                                                return job ? (
                                                    <img src={job.icon} className="w-4 h-4 rounded-sm" alt={events[0].target} />
                                                ) : (
                                                    <span className={clsx(
                                                        "text-[9px] font-bold px-1 rounded",
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
                        </div>

                        <div className="flex-1 w-full relative group/slot">
                            <div
                                className="w-full h-full flex items-center justify-between px-2 cursor-pointer hover:bg-white/[0.05] transition-colors gap-2"
                                onClick={(e) => onEventClick(events[1], e)}
                                title={`${getEventName(events[1])} (${events[1].damageAmount?.toLocaleString()})`}
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {events[1].damageType === 'magical' && <img src="/icons/type_magic.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Magical" />}
                                    {events[1].damageType === 'physical' && <img src="/icons/type_phys.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Physical" />}
                                    {events[1].damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Dark" />}
                                    <span className="text-[10px] md:text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-none pt-0.5">{getEventName(events[1])}</span>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setClipboardEvent(events[1]);
                                        }}
                                        className="ml-2 text-slate-500 hover:text-blue-400 opacity-0 group-hover/slot:opacity-100 transition-all cursor-pointer flex-shrink-0"
                                        title="このイベントをコピーしてスタンプする"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>

                                <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                                    {(events[1].target === 'MT' || events[1].target === 'ST') && (
                                        <>
                                            <span className="text-[10px] text-slate-500 font-mono">on</span>
                                            {(() => {
                                                const member = partyMembers.find(m => m.id === events[1].target);
                                                const job = member ? JOBS.find(j => j.id === member.jobId) : null;
                                                return job ? (
                                                    <img src={job.icon} className="w-4 h-4 rounded-sm" alt={events[1].target} />
                                                ) : (
                                                    <span className={clsx(
                                                        "text-[9px] font-bold px-1 rounded",
                                                        events[1].target === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10"
                                                    )}>
                                                        {events[1].target}
                                                    </span>
                                                );
                                            })()}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* U.Dmg Column (Vertical Stack) */}
            <div
                className={clsx(
                    "w-[45px] md:w-[100px] border-r h-full flex flex-col items-center justify-center text-[10px] md:text-sm font-mono font-bold transition-colors group-hover:text-slate-900 dark:group-hover:text-slate-100 cursor-pointer md:cursor-default",
                    theme === 'dark' ? "border-white/[0.02] text-slate-300" : "border-slate-200 text-slate-500"
                )}
                // 👇 変更：PC版は onDamageClick(nullの場合は何もしない)、スマホ版は onMobileDamageClick を発火させる
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
                        {damages[0] && damages[0].unmitigated > 0 ? damages[0].unmitigated.toLocaleString() : ''}
                    </div>
                ) : (
                    <>
                        <div className="flex-1 w-full flex items-center justify-center border-b border-white/[0.02]">
                            {damages[0] && damages[0].unmitigated > 0 ? damages[0].unmitigated.toLocaleString() : ''}
                        </div>
                        <div className="flex-1 w-full flex items-center justify-center">
                            {damages[1] && damages[1].unmitigated > 0 ? damages[1].unmitigated.toLocaleString() : ''}
                        </div>
                    </>
                )}
            </div >

            {/* Dmg Column (Vertical Stack) - With Mitigation Details */}
            <div
                className={clsx(
                    "w-[45px] md:w-[100px] border-r h-full flex flex-col items-center justify-center text-[10px] md:text-sm font-mono font-bold transition-colors group-hover:text-black dark:group-hover:text-white cursor-pointer md:cursor-default",
                    theme === 'dark' ? "border-white/[0.02] text-slate-200" : "border-slate-200 text-slate-800"
                )}
                // 👇 同上：PC版とスマホ版でクリックの挙動を分ける
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
                                    {damages[0].mitigated.toLocaleString()}
                                </span>
                                {damages[0].isInvincible ? (
                                    <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap">
                                        Invuln
                                    </span>
                                ) : (damages[0].mitigationPercent > 0 || damages[0].shieldTotal > 0) && (
                                    <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap hidden md:inline">
                                        {[
                                            damages[0].mitigationPercent > 0 ? `▼ ${damages[0].mitigationPercent}%` : null,
                                            damages[0].shieldTotal > 0 ? `🛡️ ${damages[0].shieldTotal.toLocaleString()}` : null
                                        ].filter(Boolean).join(' | ')}
                                    </span>
                                )}
                            </>
                        ) : ''}
                    </div>
                ) : (
                    <>
                        <div className={clsx("flex-1 w-full flex flex-col items-center justify-center border-b border-white/[0.02] gap-0.5 leading-none",
                            (() => {
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
                            })()
                        )}>
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
                                        {damages[0].mitigated.toLocaleString()}
                                    </span>
                                    {damages[0].isInvincible ? (
                                        <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap">
                                            Invuln
                                        </span>
                                    ) : (damages[0].mitigationPercent > 0 || damages[0].shieldTotal > 0) && (
                                        <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap hidden md:inline">
                                            {[
                                                damages[0].mitigationPercent > 0 ? `▼ ${damages[0].mitigationPercent}%` : null,
                                                damages[0].shieldTotal > 0 ? `🛡️ ${damages[0].shieldTotal.toLocaleString()}` : null
                                            ].filter(Boolean).join(' | ')}
                                        </span>
                                    )}
                                </>
                            ) : ''}
                        </div>
                        <div className={clsx("flex-1 w-full flex flex-col items-center justify-center gap-0.5 leading-none",
                            (() => {
                                const evt = events[1];
                                const dmg = damages[1];
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
                            {damages[1] && (damages[1].unmitigated > 0 || damages[1].isInvincible) ? (
                                <>
                                    <span className={clsx(
                                        (() => {
                                            const evt = events[1];
                                            const dmg = damages[1];
                                            let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                            if (evt.target === 'MT' || evt.target === 'ST') {
                                                maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                                            }
                                            const isLethal = dmg.mitigated >= maxHp;
                                            return isLethal ? "text-red-600 dark:text-red-400 font-black shadow-sm" : "text-green-600 dark:text-green-400";
                                        })()
                                    )}>
                                        {damages[1].mitigated.toLocaleString()}
                                    </span>
                                    {damages[1].isInvincible ? (
                                        <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap">
                                            Invuln
                                        </span>
                                    ) : (damages[1].mitigationPercent > 0 || damages[1].shieldTotal > 0) && (
                                        <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap hidden md:inline">
                                            {[
                                                damages[1].mitigationPercent > 0 ? `▼ ${damages[1].mitigationPercent}%` : null,
                                                damages[1].shieldTotal > 0 ? `🛡️ ${damages[1].shieldTotal.toLocaleString()}` : null
                                            ].filter(Boolean).join(' | ')}
                                        </span>
                                    )}
                                </>
                            ) : ''}
                        </div>
                    </>
                )}
            </div >

            {/* Job Columns Cells */}
            {
                partyMembers.map((member) => (
                    <div
                        key={member.id}
                        className={clsx(
                            "hidden md:flex h-full items-center justify-center relative group/cell cursor-pointer transition-colors border-r",
                            theme === 'dark'
                                ? "border-white/[0.02] hover:bg-white/[0.05]"
                                : "border-slate-200 hover:bg-slate-100"
                        )}
                        style={{ width: `${getColumnWidth(member.role)}px`, minWidth: `${getColumnWidth(member.role)}px`, maxWidth: `${getColumnWidth(member.role)}px` }}
                        onClick={(e) => onCellClick(member.id, time, e)}
                        title={t('mitigation.select')}
                    >
                        {/* Placeholder styling handled by class */}
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
    if (prevProps.partySortOrder !== nextProps.partySortOrder) return false;
    if (prevProps.events.length !== nextProps.events.length) return false;
    return true;
});