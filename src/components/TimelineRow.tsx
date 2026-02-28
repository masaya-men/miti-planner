import React, { memo } from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import type { PartyMember, TimelineEvent } from '../types';
import { getColumnWidth } from './Timeline';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { JOBS } from '../data/mockData';

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
    onDamageClick
}: TimelineRowProps) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();

    // Bilingual event name helper (same pattern as Job/Mitigation)
    const getEventName = (ev: TimelineEvent) =>
        contentLanguage === 'en' && ev.nameEn ? ev.nameEn : ev.name;

    const displayTimeStr = Math.floor(Math.abs(time) / 60) + ':' + (Math.abs(time) % 60).toString().padStart(2, '0');
    const formattedTime = time < 0 && time > -60 ? `-0:${(Math.abs(time) % 60).toString().padStart(2, '0')}` :
        time < 0 ? `-${displayTimeStr}` :
            displayTimeStr;

    return (
        <div
            className={clsx(
                "absolute left-0 w-full md:w-fit border-b border-white/[0.03] flex h-[50px] group transition-colors hover:bg-white/[0.04] duration-75"
            )}
            style={{ top: `${top}px` }}
        >
            {/* Phase Column */}
            <div
                className={
                    clsx(
                        "w-[30px] md:w-[100px] border-r border-white/[0.02] h-full relative cursor-pointer flex items-center justify-center transition-colors group-hover:text-slate-100"
                    )}
                onClick={(e) => onPhaseAdd(time, e)}
                title={t('timeline.end_phase')}
            >
                <div className="flex items-center justify-center w-full h-full text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={16} />
                </div>
            </div >

            {/* Time Column */}
            <div className="w-[40px] md:w-[70px] border-r border-white/[0.02] h-full flex items-center justify-center relative font-mono text-[10px] md:text-sm text-slate-400 transition-colors group-hover:text-slate-100 group-hover:font-bold">
                {formattedTime}
            </div >

            {/* Event Column (Vertical Stack, Max 2) */}
            <div className={clsx(
                "flex-1 md:flex-none md:w-[200px] border-r border-white/[0.02] h-full relative flex flex-col transition-colors",
                "group-hover:bg-white/[0.02]"
            )}>
                {events.length === 0 ? (
                    // Case 0: Empty - Center Add Button across entire cell
                    <div
                        className={clsx(
                            "w-full h-full flex items-center justify-center cursor-pointer hover:bg-white/[0.05] transition-all opacity-0 group-hover:opacity-100"
                        )}
                        onClick={(e) => onAddEventClick(time, e)}
                    >
                        <Plus size={16} className="text-slate-600 hover:text-slate-600 dark:text-slate-400 transition-colors" />
                    </div>
                ) : events.length === 1 ? (
                    // Case 1: Single Event - Center Vertically
                    <div className="w-full h-full relative group/slot">
                        <div
                            className="w-full h-full flex items-center justify-between px-2 cursor-pointer hover:bg-white/[0.05] transition-colors gap-2"
                            onClick={(e) => onEventClick(events[0], e)}
                            title={`${getEventName(events[0])} (${events[0].damageAmount?.toLocaleString()})`}
                        >
                            {/* Left Side: Icon + Name */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                {/* Damage Type Icon */}
                                {events[0].damageType === 'magical' && <img src="/icons/type_magic.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Magical" />}
                                {events[0].damageType === 'physical' && <img src="/icons/type_phys.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Physical" />}
                                {events[0].damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Dark" />}

                                {/* Name */}
                                <span className="text-xs font-medium text-slate-200 truncate leading-none pt-0.5">{getEventName(events[0])}</span>
                            </div>

                            {/* Right Side: Target */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                {/* Target (Job Icon for MT/ST) */}
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

                        {/* Hover Add Button (Overlay at Bottom) */}
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
                    // Case > 1: Split Slots (Existing Logic)
                    <>
                        {/* Slot 1 (Top) */}
                        <div className="flex-1 w-full border-b border-white/[0.02] relative group/slot">
                            <div
                                className="w-full h-full flex items-center justify-between px-2 cursor-pointer hover:bg-white/[0.05] transition-colors gap-2"
                                onClick={(e) => onEventClick(events[0], e)}
                                title={`${getEventName(events[0])} (${events[0].damageAmount?.toLocaleString()})`}
                            >
                                {/* Left Side: Icon + Name */}
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {/* Damage Type Icon */}
                                    {events[0].damageType === 'magical' && <img src="/icons/type_magic.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Magical" />}
                                    {events[0].damageType === 'physical' && <img src="/icons/type_phys.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Physical" />}
                                    {events[0].damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Dark" />}

                                    {/* Name */}
                                    <span className="text-xs font-medium text-slate-200 truncate leading-none pt-0.5">{getEventName(events[0])}</span>
                                </div>

                                {/* Right Side: Target */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
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
                        </div>

                        {/* Slot 2 (Bottom) */}
                        <div className="flex-1 w-full relative group/slot">
                            <div
                                className="w-full h-full flex items-center justify-between px-2 cursor-pointer hover:bg-white/[0.05] transition-colors gap-2"
                                onClick={(e) => onEventClick(events[1], e)}
                                title={`${getEventName(events[1])} (${events[1].damageAmount?.toLocaleString()})`}
                            >
                                {/* Left Side: Icon + Name */}
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {events[1].damageType === 'magical' && <img src="/icons/type_magic.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Magical" />}
                                    {events[1].damageType === 'physical' && <img src="/icons/type_phys.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Physical" />}
                                    {events[1].damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-3 h-3 opacity-90 flex-shrink-0" alt="Dark" />}
                                    <span className="text-xs font-medium text-slate-200 truncate leading-none pt-0.5">{getEventName(events[1])}</span>
                                </div>

                                {/* Right Side: Target */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {(events[1].target === 'MT' || events[1].target === 'ST') && (
                                        <>
                                            <span className="text-[10px] text-slate-500 font-mono">on</span>
                                            {(() => {
                                                const member = partyMembers.find(m => m.id === events[1].target);
                                                const job = member ? JOBS.find(j => j.id === member.jobId) : null;
                                                return job ? (
                                                    <img src={job.icon} className="w-5 h-5 rounded-sm" alt={events[1].target} />
                                                ) : (
                                                    <span className={clsx(
                                                        "text-[10px] font-bold px-1 rounded",
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
                className="w-[45px] md:w-[100px] border-r border-white/[0.02] h-full flex flex-col items-center justify-center text-[10px] md:text-sm font-mono font-bold text-slate-300 transition-colors group-hover:text-slate-100 md:cursor-default cursor-pointer"
                onClick={(e) => onDamageClick?.(time, e)}
            >
                {events.length === 1 ? (
                    // Case 1: Single Event - Center Vertically
                    <div className="w-full h-full flex items-center justify-center">
                        {damages[0] && damages[0].unmitigated > 0 ? damages[0].unmitigated.toLocaleString() : ''}
                    </div>
                ) : (
                    // Case Normal
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
                className="w-[45px] md:w-[100px] border-r border-white/[0.02] h-full flex flex-col items-center justify-center text-[10px] md:text-sm font-mono font-bold text-slate-200 transition-colors group-hover:text-white md:cursor-default cursor-pointer"
                onClick={(e) => onDamageClick?.(time, e)}
            >
                {events.length === 1 ? (
                    // Case 1: Single Event - Center Vertically
                    <div className={clsx("w-full h-full flex flex-col items-center justify-center gap-0.5 leading-none", (() => {
                        const evt = events[0];
                        const dmg = damages[0];
                        if (!evt || !dmg) return "";

                        if (dmg.unmitigated <= 0) return "";
                        // Determine Target HP
                        let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1; // Default to Healer
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

                                        // Determine Target HP
                                        let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                        if (evt.target === 'MT' || evt.target === 'ST') {
                                            maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                                        }
                                        const isLethal = dmg.mitigated >= maxHp;
                                        return isLethal ? "text-red-500 font-extrabold" : "text-green-400";
                                    })()
                                )}>
                                    {damages[0].mitigated.toLocaleString()}
                                </span>
                                {damages[0].isInvincible ? (
                                    <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap">
                                        Invuln
                                    </span>
                                ) : (damages[0].mitigationPercent > 0 || damages[0].shieldTotal > 0) && (
                                    <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap">
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
                    // Case Normal
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
                                            return isLethal ? "text-red-500 font-extrabold" : "text-green-400";
                                        })()
                                    )}>
                                        {damages[0].mitigated.toLocaleString()}
                                    </span>
                                    {damages[0].isInvincible ? (
                                        <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap">
                                            Invuln
                                        </span>
                                    ) : (damages[0].mitigationPercent > 0 || damages[0].shieldTotal > 0) && (
                                        <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap">
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
                                            return isLethal ? "text-red-500 font-extrabold" : "text-green-400";
                                        })()
                                    )}>
                                        {damages[1].mitigated.toLocaleString()}
                                    </span>
                                    {damages[1].isInvincible ? (
                                        <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap">
                                            Invuln
                                        </span>
                                    ) : (damages[1].mitigationPercent > 0 || damages[1].shieldTotal > 0) && (
                                        <span className="text-[9px] text-slate-500 font-normal tracking-tighter scale-90 whitespace-nowrap">
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
                            "hidden md:flex border-r border-white/[0.02] h-full items-center justify-center relative group/cell cursor-pointer transition-colors hover:bg-white/[0.05]"
                        )}
                        style={{ width: `${getColumnWidth(member.role)}px`, minWidth: `${getColumnWidth(member.role)}px`, maxWidth: `${getColumnWidth(member.role)}px` }}
                        onClick={(e) => onCellClick(member.id, time, e)}
                        title={t('mitigation.select')}
                    >
                        {/* Placeholder styling handled by class */}
                    </div>
                ))
            }
        </div >
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo

    // Check if critical data changed
    if (prevProps.time !== nextProps.time) return false;
    if (prevProps.top !== nextProps.top) return false;
    if (prevProps.events !== nextProps.events) return false; // Event array check
    // Need to check damages array deeply? Or length/ref? Ref should change if data updates.
    if (prevProps.damages !== nextProps.damages) return false;

    if (prevProps.partyMembers !== nextProps.partyMembers) return false; // Party members array ref check

    // Check Sort Order
    if (prevProps.partySortOrder !== nextProps.partySortOrder) return false;

    // Check events length just in case
    if (prevProps.events.length !== nextProps.events.length) return false;

    return true;
});
