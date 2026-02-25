import React, { useMemo } from 'react';
import { useMitigationStore } from '../store/useMitigationStore';
import { MITIGATIONS } from '../data/mockData';
import clsx from 'clsx';
import type { TimelineEvent } from '../types';

export const CheatSheetView: React.FC = () => {
    const { timelineEvents, timelineMitigations } = useMitigationStore();

    // Calculate formatted time
    const formatTime = (time: number) => {
        const min = Math.floor(Math.abs(time) / 60);
        const sec = Math.abs(time) % 60;
        const sign = time < 0 ? '-' : '';
        return `${sign}${min}:${sec.toString().padStart(2, '0')}`;
    };

    // Group mitigations by event time window (e.g. active during the event)
    const getMitigationsForEvent = (eventTime: number) => {
        return timelineMitigations.filter(m => {
            return m.time <= eventTime && m.time + m.duration >= eventTime;
        });
    };

    // Component for rendering a single event row
    const EventRow = ({ event }: { event: TimelineEvent }) => {
        const activeMitigations = getMitigationsForEvent(event.time);

        // Split mitigations into MT Group and ST Group
        const mtGroupIds = ['MT', 'H1', 'D1', 'D3'];
        const mtGroupMitigations = activeMitigations.filter(m => mtGroupIds.includes(m.ownerId));
        const stGroupMitigations = activeMitigations.filter(m => !mtGroupIds.includes(m.ownerId));

        const renderMitigationGroup = (mitigations: typeof timelineMitigations, alignRight: boolean = false) => {
            return (
                <div className={clsx("flex flex-wrap gap-1 items-center", alignRight ? "justify-end" : "justify-start")}>
                    {mitigations.map(m => {
                        const def = MITIGATIONS.find(d => d.id === m.mitigationId);
                        const isMyJob = useMitigationStore.getState().myMemberId === m.ownerId;

                        if (!def) return null;

                        return (
                            <div
                                key={m.id}
                                className={clsx(
                                    "relative flex items-center justify-center w-5 h-5 rounded overflow-hidden shadow-sm border border-white/20",
                                    !isMyJob && useMitigationStore.getState().myMemberId ? "opacity-50 grayscale" : ""
                                )}
                                title={`${def.name} (${m.ownerId})`}
                            >
                                <img src={def.icon} alt={def.name} className="w-full h-full object-cover" />

                                {/* Target Badge */}
                                {m.targetId && (
                                    <div className="absolute -bottom-0.5 -right-0.5 z-10 bg-black/80 rounded px-[2px] text-[6px] font-black text-white ring-[0.5px] ring-white/20 scale-90">
                                        {m.targetId}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        };

        return (
            <div className="flex w-full items-stretch min-h-[40px] border-b border-white/5 hover:bg-white/[0.02] transition-colors relative group">

                {/* MT Group Mitigations (Left) */}
                <div className="flex-1 p-1 flex items-center justify-end border-r border-white/5 pr-2">
                    {renderMitigationGroup(mtGroupMitigations, true)}
                </div>

                {/* Central Time & Mechanic */}
                <div className="w-[120px] shrink-0 flex flex-col items-center justify-center p-1 relative z-10 bg-black/20 backdrop-blur-sm border-x border-white/10 mx-[-1px] shadow-[0_0_10px_rgba(0,0,0,0.2)]">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-wider leading-none mb-0.5 shadow-black drop-shadow-md">
                        {formatTime(event.time)}
                    </span>
                    <span className="text-xs font-bold text-slate-100 text-center leading-tight line-clamp-2 px-1 break-words w-full shadow-black drop-shadow-md">
                        {event.name}
                    </span>

                    {/* Event Type & Target Indicatiors */}
                    <div className="flex items-center gap-1 mt-0.5 opacity-80 scale-90">
                        {event.damageType === 'magical' && <img src="/icons/type_magic.png" className="w-2.5 h-2.5" alt="Magical" />}
                        {event.damageType === 'physical' && <img src="/icons/type_phys.png" className="w-2.5 h-2.5" alt="Physical" />}
                        {event.damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-2.5 h-2.5" alt="Dark" />}

                        {(event.target === 'MT' || event.target === 'ST') && (
                            <span className={clsx(
                                "text-[7px] font-bold px-1 rounded uppercase tracking-wider",
                                event.target === 'MT' ? "text-cyan-400 bg-cyan-400/20" : "text-amber-400 bg-amber-400/20"
                            )}>
                                {event.target}
                            </span>
                        )}
                    </div>
                </div>

                {/* ST Group Mitigations (Right) */}
                <div className="flex-1 p-1 flex items-center justify-start border-l border-white/5 pl-2">
                    {renderMitigationGroup(stGroupMitigations, false)}
                </div>

            </div>
        );
    };

    // Filter events to only show those that have damage
    const damageEvents = useMemo(() => {
        return timelineEvents
            .filter(e => e.damageAmount && e.damageAmount > 0)
            .sort((a, b) => a.time - b.time);
    }, [timelineEvents]);

    return (
        <div className="flex flex-col h-full w-full max-w-3xl mx-auto bg-black/30 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">

            {/* Header */}
            <div className="flex items-stretch h-10 bg-black/50 border-b border-white/10 shrink-0 sticky top-0 z-20 shadow-md">
                <div className="flex-1 flex items-center justify-center border-r border-white/5 bg-gradient-to-r from-blue-900/30 to-blue-500/10">
                    <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest px-2 text-center drop-shadow-md">MT Group</span>
                </div>
                <div className="w-[120px] shrink-0 flex flex-col items-center justify-center bg-black/40 border-x border-white/10 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest drop-shadow-md">Timeline</span>
                </div>
                <div className="flex-1 flex items-center justify-center border-l border-white/5 bg-gradient-to-l from-orange-900/30 to-orange-500/10">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest px-2 text-center drop-shadow-md">ST Group</span>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto relative scroll-smooth thin-scrollbar pb-10">
                {damageEvents.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-500 text-sm font-medium">
                        No damage events recorded.
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {damageEvents.map(event => (
                            <EventRow key={event.id} event={event} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
