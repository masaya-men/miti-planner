import React, { useMemo, useState } from 'react';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { MITIGATIONS, JOBS } from '../data/mockData';
import clsx from 'clsx';
import type { TimelineEvent, Mitigation } from '../types';
import { MitigationSelector } from './MitigationSelector';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';

type MergedEvent = TimelineEvent & { hitCount: number; span: number; lastHitTime: number };

export const CheatSheetView: React.FC = () => {
    const { contentLanguage } = useThemeStore();
    const { timelineEvents, timelineMitigations, partyMembers, addMitigation, schAetherflowPatterns } = useMitigationStore();
    const { t } = useTranslation();

    // 状態管理
    const [mitigationSelectorOpen, setMitigationSelectorOpen] = useState(false);
    const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedMitigationTime, setSelectedMitigationTime] = useState<number>(0);
    const [memberSelectOpen, setMemberSelectOpen] = useState(false);

    // ダメージ計算頭脳
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
                if (!def) return;
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

                let burstMultiplier = 1;
                if (def.burstValue && def.burstDuration && event.time < appMit.time + def.burstDuration) {
                    burstMultiplier = (1 - def.burstValue / 100);
                }

                const multiplier = (1 - mitigationValue / 100) * burstMultiplier;
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
                            // Self-only healing increase (e.g. Dissipation, Neutral Sect) only applies to the caster's own heals
                            if (bDef.healingIncreaseSelfOnly && buff.ownerId !== appMit.ownerId) return;
                            healingMultiplier += (bDef.healingIncrease / 100);
                        }
                    });

                    const localizedName = contentLanguage === 'en' ? def.name.en : def.name.ja;
                    let maxValBase = member.computedValues[localizedName] || 0;

                    if ((def.id === 'helios_conjunction' || def.id === 'aspected_helios') && isConditionalShield) {
                        maxValBase = member.computedValues[`${def.name.en} (Neutral)`] || member.computedValues[`${def.name.ja} (Nセクト)`] || 0;
                    }

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

        const handleRowClick = () => {
            const centerX = (window.innerWidth / 2) - 120;
            const centerY = (window.innerHeight / 2) - 150;

            setSelectorPosition({ x: centerX, y: centerY });
            setSelectedMitigationTime(event.time);
            setMemberSelectOpen(true);
        };

        const renderMitigationGroup = (mitigations: typeof timelineMitigations, alignRight: boolean = false) => {
            const uniqueMitigations = mitigations.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

            return (
                <div className={clsx("flex flex-wrap gap-1 items-center", alignRight ? "justify-end" : "justify-start")}>
                    {uniqueMitigations.map(m => {
                        const def = MITIGATIONS.find(d => d.id === m.mitigationId);
                        const isMyJob = useMitigationStore.getState().myMemberId === m.ownerId;
                        if (!def) return null;

                        const targetMember = m.targetId ? partyMembers.find(p => p.id === m.targetId) : null;
                        const targetJob = targetMember ? JOBS.find(j => j.id === targetMember.jobId) : null;

                        return (
                            <div
                                key={m.id}
                                className={clsx(
                                    "relative flex items-center justify-center w-5 h-5 rounded overflow-hidden shadow-sm border border-white/20",
                                    !isMyJob && useMitigationStore.getState().myJobHighlight && useMitigationStore.getState().myMemberId ? "opacity-50 grayscale" : ""
                                )}
                            >
                                <Tooltip content={`${contentLanguage === 'en' ? def.name.en : def.name.ja} (${m.ownerId}${m.targetId ? ` ➔ ${m.targetId}` : ''})`}>
                                    <img src={def.icon} alt={contentLanguage === 'en' ? def.name.en : def.name.ja} className="w-full h-full object-cover" />
                                </Tooltip>

                                {m.targetId && (
                                    <div className="absolute -bottom-0.5 -right-0.5 z-10 bg-slate-900/90 rounded-tl-[3px] p-[1px] shadow-sm ring-[0.5px] ring-white/30 flex items-center justify-center">
                                        {targetJob ? (
                                            <img src={targetJob.icon} alt={contentLanguage === 'en' ? targetJob.name.en : targetJob.name.ja} className="w-2.5 h-2.5 object-contain drop-shadow-md" />
                                        ) : (
                                            <span className="text-[6px] font-black text-white px-0.5 block scale-90">{m.targetId}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        };

        return (
            <div
                onClick={handleRowClick}
                className={clsx(
                    "flex w-full items-stretch min-h-[44px] border-b  relative group cursor-pointer",
                    isLethal
                        ? ("bg-red-50/50 hover:bg-red-100/50 dark:bg-red-500/10 dark:hover:bg-red-500/20")
                        : ("hover:bg-slate-50 dark:hover:bg-white/[0.02]"),
                    "border-slate-200 dark:border-white/5"
                )}>
                <div className="flex-1 p-1.5 flex items-center justify-end border-r border-white/5 pr-3">
                    {renderMitigationGroup(mtGroupMitigations, true)}
                </div>

                <div className={clsx(
                    "w-[130px] shrink-0 flex flex-col items-center justify-center p-1.5 relative z-10 border-x mx-[-1px] shadow-[0_0_15px_rgba(0,0,0,0.1)] pointer-events-none ",
                    "bg-slate-100/90 border-slate-300 dark:bg-black/60 dark:border-white/20"
                )}>
                    {/* 1段目: 時間 */}
                    <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-300 font-bold tracking-wider leading-none mb-0.5 drop-shadow-md">
                        {formatTime(event.time)}
                    </span>

                    {/* 2段目: 攻撃種別アイコン + 攻撃名 + 連続ヒット */}
                    <div className="flex items-center gap-1 w-full justify-center opacity-90 mb-0.5">
                        {event.damageType === 'magical' && <img src="/icons/type_magic.png" className="w-2.5 h-2.5 shrink-0" alt="Magical" />}
                        {event.damageType === 'physical' && <img src="/icons/type_phys.png" className="w-2.5 h-2.5 shrink-0" alt="Physical" />}
                        {event.damageType === 'unavoidable' && <img src="/icons/type_dark.png" className="w-2.5 h-2.5 shrink-0" alt="Dark" />}
                        <span
                            className={clsx(
                                "text-[10px] leading-tight truncate font-black drop-shadow-md cursor-help",
                                isLethal ? "text-red-600 dark:text-red-400" : hasDamage ? "text-green-600 dark:text-green-400" : "text-app-text"
                            )}
                        >
                            {contentLanguage === 'en' && event.name.en ? event.name.en : event.name.ja}
                        </span>
                        {/* 連続ヒットバッジ */}
                        {event.hitCount > 1 && (
                            <Tooltip content={t('ui.total_hits', { count: event.hitCount, span: event.span })}>
                                <span
                                    className="text-[7px] font-bold px-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap shadow-sm scale-90 shrink-0"
                                >
                                    ×{event.hitCount}
                                </span>
                            </Tooltip>
                        )}
                    </div>

                    {/* 3段目: 最終ダメージ + サマリー + ターゲット（すべて1行にまとめる） */}
                    <div className="flex items-center justify-center gap-1 w-full leading-none">
                        {/* 最終ダメージ量 */}
                        {hasDamage && dmgInfo && (
                            <span className={clsx(
                                "text-[10px] font-mono font-black drop-shadow-md shrink-0",
                                isLethal ? "text-red-600 dark:text-red-400" : "text-app-text"
                            )}>
                                {dmgInfo.isInvincible ? t('timeline.invuln') : actualDamage.toLocaleString()}
                            </span>
                        )}

                        {/* 軽減率・バリア量（超省略表記） */}
                        {dmgInfo && !dmgInfo.isInvincible && (dmgInfo.mitigationPercent > 0 || dmgInfo.shieldTotal > 0) && (
                            <span className="text-[8px] text-app-text-secondary font-black whitespace-nowrap tracking-tighter scale-90 origin-left shrink-0">
                                {[
                                    dmgInfo.mitigationPercent > 0 ? `▼-${dmgInfo.mitigationPercent}%` : null,
                                    dmgInfo.shieldTotal > 0 ? `🛡️${Math.floor(dmgInfo.shieldTotal / 1000)}k` : null
                                ].filter(Boolean).join(' ') || ''}
                            </span>
                        )}

                        {/* ターゲット（ジョブアイコンのみ表示） */}
                        {(event.target === 'MT' || event.target === 'ST') && (() => {
                            const targetMember = partyMembers.find(m => m.id === event.target);
                            const targetJob = targetMember ? JOBS.find(j => j.id === targetMember.jobId) : null;

                            return targetJob ? (
                                <div
                                    className={clsx(
                                        "flex items-center justify-center rounded p-[1px] shadow-sm border shrink-0",
                                        event.target === 'MT'
                                            ? "bg-cyan-500/20 border-cyan-500/30"
                                            : "bg-amber-500/20 border-amber-500/30"
                                    )}
                                >
                                    <Tooltip content={`${event.target} (${contentLanguage === 'en' ? targetJob.name.en : targetJob.name.ja})`}>
                                        <img src={targetJob.icon} alt={contentLanguage === 'en' ? targetJob.name.en : targetJob.name.ja} className="w-3 h-3 object-contain drop-shadow-md shrink-0" />
                                    </Tooltip>
                                </div>
                            ) : (
                                <span className={clsx(
                                    "text-[7px] font-bold px-1 rounded uppercase tracking-wider whitespace-nowrap scale-90 shrink-0",
                                    event.target === 'MT' ? "text-cyan-400 bg-cyan-400/20" : "text-amber-400 bg-amber-400/20"
                                )}>
                                    {event.target}
                                </span>
                            );
                        })()}
                    </div>
                </div>

                <div className="flex-1 p-1.5 flex items-center justify-start border-l border-white/5 pl-3">
                    {renderMitigationGroup(stGroupMitigations, false)}
                </div>
            </div>
        );
    };

    const damageEvents = useMemo(() => {
        const rawEvents = timelineEvents
            .filter(e => e.damageAmount && e.damageAmount > 0 && e.name.ja !== 'AA')
            .sort((a, b) => a.time - b.time);

        const merged: MergedEvent[] = [];

        for (const event of rawEvents) {
            const lastMerge = merged[merged.length - 1];

            if (lastMerge && lastMerge.name.ja === event.name.ja) {
                const totalSpan = event.time - lastMerge.time;
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
        <div className={clsx(
            "flex flex-col h-full w-full max-w-4xl mx-auto rounded-2xl border overflow-hidden relative shadow-sm",
            "bg-white/90 border-slate-200 dark:bg-slate-950/40 dark:border-white/10"
        )}>
            <div className={clsx(
                "flex items-stretch h-11 border-b shrink-0 z-20 shadow-xl  [scrollbar-gutter:stable] overflow-hidden",
                "bg-slate-50 border-slate-200 dark:bg-slate-900/60 dark:border-white/10"
            )}>
                <div className="flex-1 flex items-center justify-center border-r border-slate-300/20 bg-gradient-to-r from-blue-600/30 via-blue-500/10 to-transparent">
                    <span className="text-[10px] font-black text-blue-700 dark:text-cyan-300 uppercase tracking-[0.2em] px-2 text-center drop-shadow-sm">MT Group</span>
                </div>
                <div className={clsx(
                    "w-[130px] shrink-0 flex flex-col items-center justify-center border-x",
                    "border-slate-200 bg-slate-100/50 dark:border-white/10 dark:bg-white/5"
                )}>
                    <span className="text-[9px] font-black text-app-text-secondary uppercase tracking-[0.15em] drop-shadow-sm">Timeline</span>
                </div>
                <div className="flex-1 flex items-center justify-center border-l border-slate-300/20 bg-gradient-to-l from-orange-600/30 via-orange-500/10 to-transparent relative">
                    <div className="absolute inset-y-0 left-full w-20 bg-orange-600/30 pointer-events-none" />
                    <span className="text-[10px] font-black text-orange-700 dark:text-amber-300 uppercase tracking-[0.2em] px-2 text-center drop-shadow-sm">ST Group</span>
                </div>
            </div>

            {/* Scrollable List Container (Relative) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth thin-scrollbar pb-10 [scrollbar-gutter:stable]">
                <div className="flex-1 flex flex-col">
                    {damageEvents.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-app-text-muted text-sm font-medium">
                            {t('ui.no_damage_events')}
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {damageEvents.map(event => (
                                <EventRow key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </div>

                {memberSelectOpen && (
                    <div
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        onClick={() => setMemberSelectOpen(false)}
                    >
                        <div
                            className="bg-white dark:bg-slate-900 border border-white/20 p-4 rounded-2xl shadow-sm animate-in zoom-in-95 fade-in duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-[10px] font-bold text-slate-800 dark:text-white mb-3 text-center uppercase tracking-wider drop-shadow-md">
                                {t('modal.add_mitigation_to')}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {partyMembers.map(m => {
                                    const job = JOBS.find(j => j.id === m.jobId);
                                    if (!job) return null;
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => {
                                                setSelectedMemberId(m.id);
                                                setMemberSelectOpen(false);
                                                setMitigationSelectorOpen(true);
                                            }}
                                            className="w-12 h-12 flex flex-col items-center justify-center rounded-xl border border-white/20 bg-white/5 hover:bg-white/20 dark:hover:bg-white/10  shadow-sm cursor-pointer"
                                        >
                                            <img src={job.icon} alt={contentLanguage === 'en' ? job.name.en : job.name.ja} className="w-6 h-6 object-contain drop-shadow-md" />
                                            <span className="text-[9px] font-black text-app-text-secondary mt-1">{m.id}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                <MitigationSelector
                    isOpen={mitigationSelectorOpen}
                    onClose={() => setMitigationSelectorOpen(false)}
                    onSelect={(mitigation: Mitigation & { _targetId?: string }) => {
                        if (!selectedMemberId) return;
                        addMitigation({
                            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
                            mitigationId: mitigation.id,
                            time: selectedMitigationTime,
                            duration: mitigation.duration,
                            ownerId: selectedMemberId,
                            targetId: mitigation._targetId
                        });
                        setMitigationSelectorOpen(false);
                    }}
                    jobId={selectedMemberId ? partyMembers.find(m => m.id === selectedMemberId)?.jobId || null : null}
                    ownerId={selectedMemberId}
                    position={selectorPosition}
                    activeMitigations={timelineMitigations.filter(m => m.ownerId === selectedMemberId)}
                    selectedTime={selectedMitigationTime}
                    schAetherflowPattern={selectedMemberId ? (schAetherflowPatterns[selectedMemberId] ?? 1) : 1}
                    isCentered={true}
                />
            </div>
        </div>
    );
};