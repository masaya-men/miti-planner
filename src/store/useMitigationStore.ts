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

interface MitigationState {
    mitigations: Mitigation[];
    partyMembers: PartyMember[];
    timelineEvents: TimelineEvent[];
    phases: Phase[];
    timelineMitigations: AppliedMitigation[];
    aaSettings: AASettings;
    schAetherflowPatterns: Record<string, 1 | 2>;
    // UI State
    myMemberId: string | null;
    hideEmptyRows: boolean;

    // Actions
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

    // UI Actions
    setMyMemberId: (memberId: string | null) => void;
    setHideEmptyRows: (hide: boolean) => void;
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
        (set) => {


            // Initialize values for default party
            const initialMembers = INITIAL_PARTY.map(m => ({
                ...m,
                computedValues: calculateMemberValues(m)
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
                schAetherflowPatterns: {} as Record<string, 1 | 2>,
                myMemberId: null,
                hideEmptyRows: false,

                setMyMemberId: (memberId) => set({ myMemberId: memberId }),
                setHideEmptyRows: (hide) => set({ hideEmptyRows: hide }),

                addEvent: (event) => set((state) => ({
                    timelineEvents: [...state.timelineEvents, event].sort((a, b) => a.time - b.time)
                })),

                updateEvent: (id, updatedEvent) => set((state) => ({
                    timelineEvents: state.timelineEvents.map(e => e.id === id ? { ...e, ...updatedEvent } : e).sort((a, b) => a.time - b.time)
                })),

                removeEvent: (id) => set((state) => ({
                    timelineEvents: state.timelineEvents.filter(e => e.id !== id)
                })),

                addPhase: (endTime, name = 'New Phase') => set((state) => {
                    const exists = state.phases.some(p => p.endTime === endTime);
                    if (exists) return state;

                    const newPhase: Phase = {
                        id: crypto.randomUUID(),
                        name,
                        endTime
                    };
                    return { phases: [...state.phases, newPhase].sort((a, b) => a.endTime - b.endTime) };
                }),

                updatePhase: (id, name) => set((state) => ({
                    phases: state.phases.map(p => p.id === id ? { ...p, name } : p)
                })),

                removePhase: (id) => set((state) => ({
                    phases: state.phases.filter(p => p.id !== id)
                })),

                addMitigation: (mitigation) => set((state) => ({
                    timelineMitigations: [...state.timelineMitigations, mitigation]
                })),

                removeMitigation: (id) => set((state) => {
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
                }),

                updateMitigationTime: (id, newTime) => set((state) => ({
                    timelineMitigations: state.timelineMitigations.map(m =>
                        m.id === id ? { ...m, time: newTime } : m
                    )
                })),

                setMemberJob: (memberId, jobId) => set((state) => {
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
                            const computedValues = calculateMemberValues(updatedMember);
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
                }),

                updateMemberStats: (memberId, stats) => set((state) => ({
                    partyMembers: state.partyMembers.map(m => {
                        if (m.id === memberId) {
                            const newStats = { ...m.stats, ...stats };
                            const computedValues = calculateMemberValues({ ...m, stats: newStats });
                            return { ...m, stats: newStats, computedValues };
                        }
                        return m;
                    })
                })),

                setAaSettings: (settings) => set({ aaSettings: settings }),

                setSchAetherflowPattern: (memberId, pattern) => set((state) => {
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
                }),

                initializeParty: () => {
                    // Handled in initial state
                }
            };
        },
        {
            name: 'mitigation-storage',
            version: 4,
            partialize: (state: MitigationState) => ({
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
                const newMembers = current.partyMembers.map(m => {
                    if (statsMap[m.id]) {
                        const restored = { ...m, stats: { ...m.stats, ...statsMap[m.id] } };
                        return { ...restored, computedValues: calculateMemberValues(restored) };
                    }
                    return m;
                });
                return { ...current, partyMembers: newMembers };
            }
        }
    )
);
