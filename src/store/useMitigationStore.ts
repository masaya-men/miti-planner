import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Mitigation, PartyMember, PlayerStats, TimelineEvent, Phase, AppliedMitigation } from '../types';
import { calculateMemberValues } from '../utils/calculator';
import { JOBS, MITIGATIONS } from '../data/mockData';

export interface AASettings {
    damage: number;
    type: 'physical' | 'magical' | 'unavoidable';
    target: 'MT' | 'ST';
}

const MAX_HISTORY = 30;

// 👇 追加：履歴に保存する「スナップショット（その瞬間の写真）」の型定義
interface HistorySnapshot {
    timelineMitigations: AppliedMitigation[];
    timelineEvents: TimelineEvent[];
    phases: Phase[];
    partyMembers: PartyMember[];
}

interface MitigationState {
    mitigations: Mitigation[];
    partyMembers: PartyMember[];
    timelineEvents: TimelineEvent[];
    phases: Phase[];
    timelineMitigations: AppliedMitigation[];
    aaSettings: AASettings;
    schAetherflowPatterns: Record<string, 1 | 2>;
    currentLevel: number; // 👈 マルチレベル対応用

    // UI State
    myMemberId: string | null;
    myJobHighlight: boolean;
    hideEmptyRows: boolean;
    clipboardEvent: TimelineEvent | null;

    // Undo/Redo History (not persisted)
    _history: HistorySnapshot[]; // 👈 軽減だけでなく、すべてのデータを履歴に持つように変更
    _future: HistorySnapshot[];

    // Actions
    setCurrentLevel: (level: number) => void;
    updateMemberStats: (memberId: string, stats: Partial<PlayerStats>) => void;
    initializeParty: () => void;
    addEvent: (event: TimelineEvent) => void;
    updateEvent: (id: string, event: Partial<TimelineEvent>) => void;
    removeEvent: (id: string) => void;
    addPhase: (endTime: number, name?: string) => void;
    updatePhase: (id: string, name: string) => void;
    removePhase: (id: string) => void;
    addMitigation: (mitigation: AppliedMitigation) => void;
    removeMitigation: (id: string) => void;
    updateMitigationTime: (id: string, newTime: number) => void;
    setMemberJob: (memberId: string, jobId: string) => void;
    setAaSettings: (settings: AASettings) => void;
    setSchAetherflowPattern: (memberId: string, pattern: 1 | 2) => void;
    /** Bulk-replace timeline events (e.g. from FFLogs import). Clears existing mitigations. */
    importTimelineEvents: (events: TimelineEvent[]) => void;
    /** Changes a member's job and strictly overwrites their mitigations with the provided array */
    changeMemberJobWithMitigations: (memberId: string, jobId: string, mitis: AppliedMitigation[]) => void;

    // Bulk delete
    clearMitigationsByMember: (memberId: string) => void;
    clearAllMitigations: () => void;
    /** 👇追加：既存の軽減をすべて消去し、新しい軽減リストで一括上書きする（Undo1回で戻せる） */
    applyAutoPlan: (result: { mitigations: AppliedMitigation[], warnings: string[] }) => void;

    // Undo/Redo
    undo: () => void;
    redo: () => void;

    // UI Actions
    setMyMemberId: (memberId: string | null) => void;
    setMyJobHighlight: (enabled: boolean) => void;
    setHideEmptyRows: (hide: boolean) => void;
    setClipboardEvent: (event: TimelineEvent | null) => void;
}

export const DEFAULT_TANK_STATS: PlayerStats = {
    hp: 296194,
    mainStat: 6317,
    det: 3141,
    crt: 2000,
    ten: 1000,
    ss: 400,
    wd: 130
};

export const DEFAULT_HEALER_STATS: PlayerStats = {
    hp: 186816,
    mainStat: 6355,
    det: 2434,
    crt: 2000,
    ten: 400,
    ss: 400,
    wd: 154
};

// Initial Party Slots
const INITIAL_PARTY: PartyMember[] = [
    { id: 'MT', jobId: null, role: 'tank', stats: { ...DEFAULT_TANK_STATS }, computedValues: {} },
    { id: 'ST', jobId: null, role: 'tank', stats: { ...DEFAULT_TANK_STATS }, computedValues: {} },
    { id: 'H1', jobId: null, role: 'healer', stats: { ...DEFAULT_HEALER_STATS }, computedValues: {} },
    { id: 'H2', jobId: null, role: 'healer', stats: { ...DEFAULT_HEALER_STATS }, computedValues: {} },
    { id: 'D1', jobId: null, role: 'dps', stats: { ...DEFAULT_HEALER_STATS }, computedValues: {} },
    { id: 'D2', jobId: null, role: 'dps', stats: { ...DEFAULT_HEALER_STATS }, computedValues: {} },
    { id: 'D3', jobId: null, role: 'dps', stats: { ...DEFAULT_HEALER_STATS }, computedValues: {} },
    { id: 'D4', jobId: null, role: 'dps', stats: { ...DEFAULT_HEALER_STATS }, computedValues: {} },
];

export const useMitigationStore = create<MitigationState>()(
    persist(
        (set, get) => {

            // Helper: push current state snapshot onto history stack before mutating
            const pushHistory = () => {
                const state = get();
                const snapshot: HistorySnapshot = {
                    timelineMitigations: [...state.timelineMitigations],
                    timelineEvents: [...state.timelineEvents],
                    phases: [...state.phases],
                    partyMembers: [...state.partyMembers]
                };
                const newHistory = [...state._history, snapshot].slice(-MAX_HISTORY);
                set({ _history: newHistory, _future: [] });
            };

            // Initialize values for default party
            const currentLevel = 100; // 初期値
            const initialMembers = INITIAL_PARTY.map(m => ({
                ...m,
                computedValues: calculateMemberValues(m, currentLevel)
            }));

            return {
                mitigations: [],
                partyMembers: initialMembers,
                timelineEvents: [],
                phases: [],
                timelineMitigations: [],
                aaSettings: {
                    damage: 0,
                    type: 'physical',
                    target: 'MT'
                },
                currentLevel: currentLevel,
                schAetherflowPatterns: {} as Record<string, 1 | 2>,
                myMemberId: null,
                myJobHighlight: false,
                hideEmptyRows: false,
                clipboardEvent: null,
                _history: [],
                _future: [],

                // Undo: restore the last snapshot from history
                undo: () => set((state) => {
                    if (state._history.length === 0) return state;
                    const previous = state._history[state._history.length - 1];
                    const newHistory = state._history.slice(0, -1);
                    const currentSnapshot: HistorySnapshot = {
                        timelineMitigations: state.timelineMitigations,
                        timelineEvents: state.timelineEvents,
                        phases: state.phases,
                        partyMembers: state.partyMembers
                    };
                    return {
                        _history: newHistory,
                        _future: [currentSnapshot, ...state._future],
                        timelineMitigations: previous.timelineMitigations,
                        timelineEvents: previous.timelineEvents,
                        phases: previous.phases,
                        partyMembers: previous.partyMembers,
                    };
                }),

                // Redo: restore the next snapshot from future
                redo: () => set((state) => {
                    if (state._future.length === 0) return state;
                    const next = state._future[0];
                    const newFuture = state._future.slice(1);
                    const currentSnapshot: HistorySnapshot = {
                        timelineMitigations: state.timelineMitigations,
                        timelineEvents: state.timelineEvents,
                        phases: state.phases,
                        partyMembers: state.partyMembers
                    };
                    return {
                        _history: [...state._history, currentSnapshot],
                        _future: newFuture,
                        timelineMitigations: next.timelineMitigations,
                        timelineEvents: next.timelineEvents,
                        phases: next.phases,
                        partyMembers: next.partyMembers,
                    };
                }),

                // Bulk delete: clear mitigations for a specific member
                clearMitigationsByMember: (memberId) => {
                    pushHistory();
                    set((state) => ({
                        timelineMitigations: state.timelineMitigations.filter(m => m.ownerId !== memberId)
                    }));
                },

                // Bulk delete: clear ALL mitigations
                clearAllMitigations: () => {
                    pushHistory();
                    set({ timelineMitigations: [] });
                },

                // 👇追加：オートプラン用の一括上書き処理（履歴はここで「1回」だけ保存される）
                applyAutoPlan: ({ mitigations, warnings }) => {
                    pushHistory();
                    set(state => ({
                        timelineMitigations: mitigations,
                        timelineEvents: state.timelineEvents.map(e => ({
                            ...e,
                            warning: warnings.includes(e.id)
                        }))
                    }));
                },

                setMyMemberId: (memberId) => set({ myMemberId: memberId }),
                setCurrentLevel: (level) => {
                    pushHistory();
                    set((state) => ({
                        currentLevel: level,
                        // レベルが変更されたら全員の計算値を再計算
                        partyMembers: state.partyMembers.map(m => ({
                            ...m,
                            computedValues: calculateMemberValues(m, level)
                        }))
                    }));
                },
                setMyJobHighlight: (enabled) => set({ myJobHighlight: enabled }),
                setHideEmptyRows: (hide) => set({ hideEmptyRows: hide }),
                setClipboardEvent: (event) => set({ clipboardEvent: event }),

                addEvent: (event) => {
                    pushHistory();
                    set((state) => ({
                        timelineEvents: [...state.timelineEvents, event].sort((a, b) => a.time - b.time)
                    }));
                },

                importTimelineEvents: (events) => {
                    pushHistory();
                    set({
                        timelineEvents: [...events].sort((a, b) => a.time - b.time),
                        timelineMitigations: [], // Clear old mitigations — they belong to a different fight
                    });
                },

                updateEvent: (id, updatedEvent) => {
                    pushHistory();
                    set((state) => ({
                        timelineEvents: state.timelineEvents.map(e => e.id === id ? { ...e, ...updatedEvent } : e).sort((a, b) => a.time - b.time)
                    }));
                },

                removeEvent: (id) => {
                    pushHistory();
                    set((state) => ({
                        timelineEvents: state.timelineEvents.filter(e => e.id !== id)
                    }));
                },

                addPhase: (endTime, name = 'New Phase') => {
                    const exists = get().phases.some(p => p.endTime === endTime);
                    if (exists) return;
                    pushHistory();
                    set((state) => {
                        const newPhase: Phase = {
                            id: crypto.randomUUID(),
                            name,
                            endTime
                        };
                        return { phases: [...state.phases, newPhase].sort((a, b) => a.endTime - b.endTime) };
                    });
                },

                updatePhase: (id, name) => {
                    pushHistory();
                    set((state) => ({
                        phases: state.phases.map(p => p.id === id ? { ...p, name } : p)
                    }));
                },

                removePhase: (id) => {
                    pushHistory();
                    set((state) => ({
                        phases: state.phases.filter(p => p.id !== id)
                    }));
                },

                addMitigation: (mitigation) => {
                    pushHistory();
                    set((state) => ({
                        timelineMitigations: [...state.timelineMitigations, mitigation]
                    }));
                },

                removeMitigation: (id) => {
                    pushHistory();
                    set((state) => {
                        const removed = state.timelineMitigations.find(m => m.id === id);
                        if (!removed) return { timelineMitigations: state.timelineMitigations.filter(m => m.id !== id) };

                        const removedDef = MITIGATIONS.find(d => d.id === removed.mitigationId);
                        if (!removedDef) return { timelineMitigations: state.timelineMitigations.filter(m => m.id !== id) };

                        // Find skills that depend on the removed skill
                        const dependentIds = MITIGATIONS.filter(d => d.requires === removed.mitigationId).map(d => d.id);

                        const removedStart = removed.time;
                        const removedEnd = removed.time + removed.duration;

                        return {
                            timelineMitigations: state.timelineMitigations.filter(m => {
                                if (m.id === id) return false; // Remove the target itself
                                // Remove dependents that overlap the removed skill's window
                                if (dependentIds.includes(m.mitigationId) && m.ownerId === removed.ownerId) {
                                    return !(m.time >= removedStart && m.time < removedEnd);
                                }
                                return true;
                            })
                        };
                    });
                },

                updateMitigationTime: (id, newTime) => {
                    pushHistory();
                    set((state) => ({
                        timelineMitigations: state.timelineMitigations.map(m =>
                            m.id === id ? { ...m, time: newTime } : m
                        )
                    }));
                },

                setMemberJob: (memberId, jobId) => {
                    pushHistory();
                    set((state) => {
                        const newMembers = state.partyMembers.map(m => {
                            if (m.id === memberId) {
                                const job = JOBS.find(j => j.id === jobId);
                                const newRole = job ? job.role : m.role;
                                let newStats = { ...m.stats };

                                // If role changed, reset stats to default of new role
                                if (job && job.role !== m.role) {
                                    if (job.role === 'tank') newStats = { ...DEFAULT_TANK_STATS };
                                    else if (job.role === 'healer') newStats = { ...DEFAULT_HEALER_STATS };
                                    else newStats = { ...DEFAULT_HEALER_STATS };
                                }

                                const updatedMember = { ...m, jobId, role: newRole, stats: newStats };
                                const computedValues = calculateMemberValues(updatedMember, state.currentLevel);
                                return { ...updatedMember, computedValues };
                            }
                            return m;
                        });

                        // Filter or Migrate Mitigations
                        const filteredMitigations = state.timelineMitigations.reduce<AppliedMitigation[]>((acc, mit) => {
                            // Keep mitigations owned by others
                            if (mit.ownerId !== memberId) {
                                acc.push(mit);
                                return acc;
                            }

                            const def = MITIGATIONS.find(m => m.id === mit.mitigationId);

                            // If exact match (job specific or shared if any), keep it
                            if (def?.jobId === jobId) {
                                acc.push(mit);
                                return acc;
                            }

                            // Try to migrate Role Actions (e.g. rampart_gnb -> rampart_drk)
                            if (def && def.jobId !== jobId) {
                                const baseId = def.id.replace(`_${def.jobId}`, '');
                                const newId = `${baseId}_${jobId}`;
                                const newDef = MITIGATIONS.find(m => m.id === newId);

                                if (newDef && newDef.jobId === jobId) {
                                    // Migration successful
                                    acc.push({ ...mit, mitigationId: newId });
                                    return acc;
                                }
                            }

                            // Otherwise filter out
                            return acc;
                        }, []);

                        // Auto-insert Dissipation for Scholar if missing
                        if (jobId === 'sch') {
                            const pattern = state.schAetherflowPatterns[memberId] ?? 1;
                            const hasInitialDissipation = filteredMitigations.some(m => m.mitigationId === 'dissipation' && m.ownerId === memberId && m.time <= 15);
                            if (!hasInitialDissipation) {
                                filteredMitigations.push({
                                    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9),
                                    mitigationId: 'dissipation',
                                    ownerId: memberId,
                                    time: pattern === 1 ? 1 : 14,
                                    duration: 30
                                });
                            }
                        }

                        return { partyMembers: newMembers, timelineMitigations: filteredMitigations };
                    });
                },

                changeMemberJobWithMitigations: (memberId, jobId, mitis) => {
                    pushHistory();
                    set((state) => {
                        // Update member job
                        const newMembers = state.partyMembers.map(m => {
                            if (m.id === memberId) {
                                const job = JOBS.find(j => j.id === jobId);
                                const newRole = job ? job.role : m.role;
                                let newStats = { ...m.stats };
                                if (job && job.role !== m.role) {
                                    if (job.role === 'tank') newStats = { ...DEFAULT_TANK_STATS };
                                    else if (job.role === 'healer') newStats = { ...DEFAULT_HEALER_STATS };
                                    else newStats = { ...DEFAULT_HEALER_STATS };
                                }
                                const updatedMember = { ...m, jobId, role: newRole, stats: newStats };
                                return { ...updatedMember, computedValues: calculateMemberValues(updatedMember, state.currentLevel) };
                            }
                            return m;
                        });

                        // Remove old mitigations for this member, and append the newly migrated ones
                        const otherMitigations = state.timelineMitigations.filter(m => m.ownerId !== memberId);

                        // Auto-insert Dissipation for Scholar if missing
                        let finalMitis = [...mitis];
                        if (jobId === 'sch') {
                            const pattern = state.schAetherflowPatterns[memberId] ?? 1;
                            const hasInitialDissipation = finalMitis.some(m => m.mitigationId === 'dissipation' && m.time <= 15);
                            if (!hasInitialDissipation) {
                                finalMitis.push({
                                    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9),
                                    mitigationId: 'dissipation',
                                    ownerId: memberId,
                                    time: pattern === 1 ? 1 : 14,
                                    duration: 30
                                });
                            }
                        }

                        return { partyMembers: newMembers, timelineMitigations: [...otherMitigations, ...finalMitis] };
                    });
                },

                updateMemberStats: (memberId, stats) => {
                    pushHistory();
                    set((state) => ({
                        partyMembers: state.partyMembers.map(m => {
                            if (m.id === memberId) {
                                const newStats = { ...m.stats, ...stats };
                                const computedValues = calculateMemberValues({ ...m, stats: newStats }, state.currentLevel);
                                return { ...m, stats: newStats, computedValues };
                            }
                            return m;
                        })
                    }));
                },

                setAaSettings: (settings) => set({ aaSettings: settings }),

                setSchAetherflowPattern: (memberId, pattern) => {
                    pushHistory();
                    set((state) => {
                        // Remove any existing dissipation for this member that might have been the previous auto-inserted one
                        const existingMitigations = state.timelineMitigations.filter(
                            m => !(m.mitigationId === 'dissipation' && m.ownerId === memberId && m.time <= 15)
                        );

                        const newDissipation = {
                            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9),
                            mitigationId: 'dissipation',
                            ownerId: memberId,
                            time: pattern === 1 ? 1 : 14,
                            duration: 30
                        };

                        return {
                            schAetherflowPatterns: { ...state.schAetherflowPatterns, [memberId]: pattern },
                            timelineMitigations: [...existingMitigations, newDissipation]
                        };
                    });
                },

                initializeParty: () => {
                    // Handled in initial state
                }
            };
        },
        {
            name: 'mitigation-storage',
            version: 4,
            partialize: (state: MitigationState) => ({
                currentLevel: state.currentLevel,
                // Only persist per-member stats (not jobs, not transient data)
                _memberStats: state.partyMembers.reduce((acc, m) => {
                    acc[m.id] = m.stats;
                    return acc;
                }, {} as Record<string, PlayerStats>),
            }),
            migrate: () => {
                // All previous versions: just return empty, let merge handle it
                return {};
            },
            merge: (persisted: any, current: MitigationState) => {
                if (!persisted || !persisted._memberStats) return current;
                const statsMap = persisted._memberStats as Record<string, PlayerStats>;
                const currentLevel = persisted.currentLevel || 100;
                const newMembers = current.partyMembers.map(m => {
                    if (statsMap[m.id]) {
                        const restored = { ...m, stats: { ...m.stats, ...statsMap[m.id] } };
                        return { ...restored, computedValues: calculateMemberValues(restored, currentLevel) };
                    }
                    return { ...m, computedValues: calculateMemberValues(m, currentLevel) };
                });
                return { ...current, currentLevel, partyMembers: newMembers };
            }
        }
    )
);