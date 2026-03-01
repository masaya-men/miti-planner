import React, { useMemo } from 'react';
import { useMitigationStore } from '../store/useMitigationStore';
import { MITIGATIONS } from '../data/mockData';
import clsx from 'clsx';
import type { TimelineEvent } from '../types';

// マージ（合体）されたイベント用の型
type MergedEvent = TimelineEvent & { hitCount: number; span: number; lastHitTime: number };

export const CheatSheetView: React.FC = () => {
    const { timelineEvents, timelineMitigations, partyMembers } = useMitigationStore();

    // 完璧なダメージ計算頭脳
    const damageMap = useMemo(() => {
        const map = new Map<string, { unmitigated: number; mitigated: number, mitigationPercent: number, shieldTotal: number, isInvincible?: boolean }>();
        const sortedEvents = [...timelineEvents].sort((a, b) => a.time - b.time);
        const shieldStates = new Map<string, Map<string, number>>();

        const getShieldState = (context: string, instanceId: string, maxValue: number) => {
            if (!shieldStates.has(context)) shieldStates.set(context, new Map());
            const contextMap = shieldStates.get(context)!;
            if (!contextMap.has(instanceId)) contextMap.set(instanceId, maxValue);
            return contextMap.get(instanceId)!;
        };

        const updateShieldState = (context: string, instanceId: string, newValue: number) => {
            if (!shieldStates.has(context)) shieldStates.set(context, new Map());
            shieldStates.get(context)!.set(instanceId, newValue);
        };

        sortedEvents.forEach(event => {
            if (!event.damageAmount) {
                map.set(event.id, { unmitigated: 0, mitigated: 0, mitigationPercent: 0, shieldTotal: 0, isInvincible: false });
                return;
            }

            const target = event.target;
            const displayContext = (target === 'MT' || target === 'ST') ? target : 'Party';
            const affectedContexts = (target === 'MT' || target === 'ST') ? [target] : ['Party', 'MT', 'ST'];

            let currentDamage = event.damageAmount;
            let mitigationMultipliers = 1;
            let displayShieldTotal = 0;
            let isInvincibleForEvent = false;

            const activeMitigations = timelineMitigations.filter(m => m.time <= event.time && event.time < m.time + m.duration);

            activeMitigations.forEach(appMit => {
                const def = MITIGATIONS.find(m => m.id === appMit.mitigationId);
                if (!def || def.isShield) return;
                if (def.scope === 'self' && appMit.ownerId !== displayContext && appMit.targetId !== displayContext) return;
                if (appMit.targetId && appMit.targetId !== displayContext) return;

                if (def.isInvincible) {
                    currentDamage = 0;
                    isInvincibleForEvent = true;
                }
                if (isInvincibleForEvent) return;

                let mitigationValue = def.value;
                if (event.damageType === 'physical' && def.valuePhysical !== undefined) mitigationValue = def.valuePhysical;
                else if (event.damageType === 'magical' && def.valueMagical !== undefined) mitigationValue = def.valueMagical;
                else {
                    if (def.type === 'physical' && event.damageType === 'magical') return;
                    if (def.type === 'magical' && event.damageType === 'physical') return;
                }

                const multiplier = (1 - mitigationValue / 100);
                currentDamage *= multiplier;
                mitigationMultipliers *= multiplier;
            });

            currentDamage = Math.floor(currentDamage);
            const damageForShields = currentDamage;

            if (!isInvincibleForEvent) {
                activeMitigations.forEach(appMit => {
                    const def = MITIGATIONS.find(m => m.id === appMit.mitigationId);
                    if (!def) return;

                    let isConditionalShield = false;
                    if (def.id === 'helios_conjunction') {
                        const nsActive = timelineMitigations.some(m => m.mitigationId === 'neutral_sect' && m.time <= appMit.time && appMit.time < m.time + m.duration);
                        if (nsActive) isConditionalShield = true;
                    }

                    if (!def.isShield && !isConditionalShield) return;
                    if (def.scope === 'self' && appMit.ownerId !== displayContext && appMit.targetId !== displayContext) return;
                    if (appMit.targetId && appMit.targetId !== displayContext) return;
                    if (def.type === 'physical' && event.damageType === 'magical') return;
                    if (def.type === 'magical' && event.damageType === 'physical') return;

                    const member = partyMembers.find(m => m.id === appMit.ownerId);
                    if (!member) return;

                    let healingMultiplier = 1;
                    const buffsAtCast = timelineMitigations.filter(b => b.time <= appMit.time && appMit.time < b.time + b.duration && b.id !== appMit.id);

                    buffsAtCast.forEach(buff => {
                        const bDef = MITIGATIONS.find(d => d.id === buff.mitigationId);
                        if (bDef && bDef.healingIncrease) {
                            if (bDef.scope === 'self' && buff.ownerId !== displayContext) return;
                            healingMultiplier += (bDef.healingIncrease / 100);
                        }
                    });

                    const maxValBase = member.computedValues[def.name] || 0;
                    const maxVal = Math.floor(maxValBase * healingMultiplier);

                    const remainingForDisplay = getShieldState(displayContext, appMit.id, maxVal);
                    displayShieldTotal += remainingForDisplay;

                    if (remainingForDisplay > 0 && currentDamage > 0) {
                        const absorbed = Math.min(remainingForDisplay, currentDamage);
                        currentDamage -= absorbed;
                    }

                    affectedContexts.forEach(ctx => {
                        const remaining = getShieldState(ctx, appMit.id, maxVal);
                        if (remaining > 0) {
                            const absorbed = Math.min(remaining, damageForShields);
                            updateShieldState(ctx, appMit.id, remaining - absorbed);
                        }
                    });
                });
            }

            const finalTaken = Math.max(0, currentDamage);
            const percentMod = Math.round((1 - mitigationMultipliers) * 100);

            map.set(event.id, {
                unmitigated: event.damageAmount,
                mitigated: finalTaken,
                mitigationPercent: percentMod,
                shieldTotal: displayShieldTotal,
                isInvincible: isInvincibleForEvent
            });
        });

        return map;
    }, [timelineEvents, timelineMitigations, partyMembers]);

    const formatTime = (time: number) => {
        const min = Math.floor(Math.abs(time) / 60);
        const sec = Math.abs(time) % 60;
        const sign = time < 0 ? '-' : '';
        return `${sign}${min}:${sec.toString().padStart(2, '0')}`;
    };

    const EventRow = ({ event }: { event: MergedEvent }) => {
        // 🎯 究極の改修ポイント：攻撃の期間（span）全体をカバーする軽減をすべて取得して集約！
        const activeMitigations = timelineMitigations.filter(m => {
            return m.time <= (event.time + event.span) && (m.time + m.duration) >= event.time;
        });

        const mtGroupIds = ['MT', 'H1', 'D1', 'D3'];
        const mtGroupMitigations = activeMitigations.filter(m => mtGroupIds.includes(m.ownerId));
        const stGroupMitigations = activeMitigations.filter(m => !mtGroupIds.includes(m.ownerId));

        let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
        if (event.target === 'MT' || event.target === 'ST') {
            maxHp = partyMembers.find(m => m.id === event.target)?.stats.hp || 1;
        }

        const dmgInfo = damageMap.get(event.id);
        const actualDamage = dmgInfo ? dmgInfo.mitigated : (event.damageAmount || 0);

        const isLethal = actualDamage >= maxHp && actualDamage > 0;
        const hasDamage = actualDamage > 0;

        const renderMitigationGroup = (mitigations: typeof timelineMitigations, alignRight: boolean = false) => {
            // 重複する軽減アイコンを排除（同じ技の中で何度も同じ軽減が取得されるのを防ぐ）
            const uniqueMitigations = mitigations.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

            return (
                <div className={clsx("flex flex-wrap gap-1 items-center", alignRight ? "justify-end" : "justify-start")}>
                    {uniqueMitigations.map(m => {
                        const def = MITIGATIONS.find(d => d.id === m.mitigationId);
                        const isMyJob = useMitigationStore.getState().myMemberId === m.ownerId;
                        if (!def) return null;

                        return (
                            <div
                                key={m.id}
                                className={clsx(
                                    "relative flex items-center justify-center w-5 h-5 rounded overflow-hidden shadow-sm border border-white/20",
                                    !isMyJob && useMitigationStore.getState().myJobHighlight && useMitigationStore.getState().myMemberId ? "opacity-50 grayscale" : ""
                                )}
                                title={`${def.name} (${m.ownerId})`}
                            >
                                <img src={def.icon} alt={def.name} className="w-full h-full object-cover" />
                                {m.targetId && (
                                    <div className="absolute -bottom-0.5 -right-0.5 z-10 bg-black/80 rounded px-[2px] text-[6px] font-black text-slate-800 dark:text-white ring-[0.5px] ring-white/20 scale-90">
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
            <div className={clsx(
                "flex w-full items-stretch min-h-[40px] border-b border-white/5 transition-colors relative group",
                isLethal ? "bg-red-500/10 hover:bg-red-500/20" : "hover:bg-white/[0.02]"
            )}>
                <div className="flex-1 p-1 flex items-center justify-end border-r border-white/5 pr-2">
                    {renderMitigationGroup(mtGroupMitigations, true)}
                </div>

                <div className="w-[120px] shrink-0 flex flex-col items-center justify-center p-1 relative z-10 bg-black/20 backdrop-blur-sm border-x border-white/10 mx-[-1px] shadow-[0_0_10px_rgba(0,0,0,0.2)]">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-wider leading-none mb-0.5 shadow-black drop-shadow-md">
                        {formatTime(event.time)}
                        {/* 期間が長い場合は ~ 0:51 のように終了時間も表示すると親切かもしれませんね（今回はスッキリさを優先して非表示にしています） */}
                    </span>
                    <span className={clsx(
                        "text-xs text-center leading-tight line-clamp-2 px-1 break-words w-full shadow-black drop-shadow-md",
                        isLethal ? "text-red-500 font-extrabold" : hasDamage ? "text-green-400 font-bold" : "text-slate-800 dark:text-slate-100 font-bold"
                    )}>
                        {event.name}
                    </span>
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

                        {/* 合体した攻撃に「×6」のバッジを表示 */}
                        {event.hitCount > 1 && (
                            <span
                                className="text-[8px] font-bold px-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap shadow-sm"
                                title={`合計 ${event.hitCount} 回のヒット (${event.span}秒間)`}
                            >
                                ×{event.hitCount}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1 p-1 flex items-center justify-start border-l border-white/5 pl-2">
                    {renderMitigationGroup(stGroupMitigations, false)}
                </div>
            </div>
        );
    };

    // 🎯 究極のマージロジック：同じ名前の攻撃が15秒以内に来たら全部まとめる！
    const damageEvents = useMemo(() => {
        const rawEvents = timelineEvents
            .filter(e => e.damageAmount && e.damageAmount > 0 && e.name !== 'AA')
            .sort((a, b) => a.time - b.time);

        const merged: MergedEvent[] = [];

        for (const event of rawEvents) {
            const lastMerge = merged[merged.length - 1];

            if (lastMerge && lastMerge.name === event.name) {
                const totalSpan = event.time - lastMerge.time; // 最初のヒットからの経過時間

                // 最初のヒットから15秒以内なら、問答無用で合体させる！
                if (totalSpan <= 15) {
                    lastMerge.hitCount += 1;
                    lastMerge.span = totalSpan;
                    lastMerge.lastHitTime = event.time;
                    continue;
                }
            }

            merged.push({
                ...event,
                hitCount: 1,
                span: 0,
                lastHitTime: event.time
            });
        }

        return merged;
    }, [timelineEvents]);

    return (
        <div className="flex flex-col h-full w-full max-w-3xl mx-auto bg-white/10 dark:bg-slate-900/30 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/5 overflow-y-auto overflow-x-hidden relative scroll-smooth thin-scrollbar pb-10 shadow-glass">
            <div className="flex items-stretch h-10 bg-white/20 dark:bg-slate-900/60 border-b border-white/20 dark:border-white/5 shrink-0 sticky top-0 z-20 shadow-glass backdrop-blur-xl">
                <div className="flex-1 flex items-center justify-center border-r border-white/5 bg-gradient-to-r from-blue-900/30 to-blue-500/10">
                    <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest px-2 text-center drop-shadow-md">MT Group</span>
                </div>
                <div className="w-[120px] shrink-0 flex flex-col items-center justify-center border-x border-white/5 shadow-inner">
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest drop-shadow-md">Timeline</span>
                </div>
                <div className="flex-1 flex items-center justify-center border-l border-white/5 bg-gradient-to-l from-orange-900/30 to-orange-500/10">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest px-2 text-center drop-shadow-md">ST Group</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col">
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