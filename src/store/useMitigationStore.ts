import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Mitigation, PartyMember, PlayerStats, TimelineEvent, Phase, AppliedMitigation } from '../types';
import { calculateMemberValues } from '../utils/calculator';
import { JOBS, MITIGATIONS } from '../data/mockData';
import { LEVEL_MODIFIERS } from '../data/levelModifiers';
import { DEFAULT_STATS_BY_LEVEL, ALL_PATCH_STATS } from '../data/defaultStats';
import { useTutorialStore } from './useTutorialStore';

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
    timelineSortOrder: 'light_party' | 'role';

    // Undo/Redo History (not persisted)
    _history: HistorySnapshot[]; // 👈 軽減だけでなく、すべてのデータを履歴に持つように変更
    _future: HistorySnapshot[];

    // Actions
    setCurrentLevel: (level: number) => void;
    applyDefaultStats: (level: number, patch?: string) => void;
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
    /** 👇追加：複数のメンバーのジョブ変更を一括で適用する（履歴は1回だけ保存） */
    updatePartyBulk: (updates: { memberId: string, jobId: string | null, mitigations?: AppliedMitigation[] }[]) => void;

    // Bulk delete
    clearMitigationsByMember: (memberId: string) => void;
    clearAllMitigations: () => void;
    /** Reset all state for tutorial restart/completion */
    resetForTutorial: () => void;
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
    setTimelineSortOrder: (order: 'light_party' | 'role') => void;
}

const subBase100 = LEVEL_MODIFIERS[100].sub;
const fillDefaultStats = (partial: any): PlayerStats => ({
    ...partial,
    crt: subBase100,
    ten: subBase100,
    ss: subBase100
});

export const DEFAULT_TANK_STATS: PlayerStats = fillDefaultStats(DEFAULT_STATS_BY_LEVEL[100].tank);
export const DEFAULT_HEALER_STATS: PlayerStats = fillDefaultStats(DEFAULT_STATS_BY_LEVEL[100].other);

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
                    type: 'magical',
                    target: 'MT'
                },
                currentLevel: currentLevel,
                schAetherflowPatterns: {} as Record<string, 1 | 2>,
                myMemberId: null,
                myJobHighlight: false,
                hideEmptyRows: false,
                clipboardEvent: null,
                timelineSortOrder: 'light_party',
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

                setMyMemberId: (memberId) => {
                    set({ myMemberId: memberId });
                    // Tutorial: notify my job was set
                    if (memberId) {
                        useTutorialStore.getState().completeEvent('myjob:set');
                    }
                },
                setCurrentLevel: (level) => {
                    const prevState = get();
                    // レベルが変わる場合のみ処理
                    if (prevState.currentLevel === level) return;

                    pushHistory();
                    set((state) => ({
                        currentLevel: level,
                        partyMembers: state.partyMembers.map(m => ({
                            ...m,
                            computedValues: calculateMemberValues(m, level)
                        }))
                    }));
                },
                applyDefaultStats: (level, patch) => {
                    pushHistory();
                    set((state) => {
                        // 1. パッチ情報があれば優先的に検索
                        // 2. なければレベルごとのデフォルトを使用
                        const patchData = patch ? ALL_PATCH_STATS[patch] : null;
                        const template = patchData || DEFAULT_STATS_BY_LEVEL[level] || DEFAULT_STATS_BY_LEVEL[100];
                        
                        // 不足項目(crt, ten, ss)をベース値で補完
                        const subBase = LEVEL_MODIFIERS[level]?.sub || 420;
                        const fillStats = (partial: any): PlayerStats => ({
                            ...partial,
                            crt: subBase,
                            ten: subBase,
                            ss: subBase
                        });

                        const newDefaults = {
                            tank: fillStats(template.tank),
                            other: fillStats(template.other)
                        };

                        return {
                            partyMembers: state.partyMembers.map(m => {
                                const stats = m.role === 'tank' ? newDefaults.tank : newDefaults.other;
                                return {
                                    ...m,
                                    stats: { ...stats },
                                    computedValues: calculateMemberValues({ ...m, stats }, level)
                                };
                            })
                        };
                    });
                },
                setMyJobHighlight: (enabled) => set({ myJobHighlight: enabled }),
                setHideEmptyRows: (hide) => set({ hideEmptyRows: hide }),
                setClipboardEvent: (event) => set({ clipboardEvent: event }),
                setTimelineSortOrder: (order) => set({ timelineSortOrder: order }),

                addEvent: (event) => {
                    pushHistory();
                    set((state) => ({
                        timelineEvents: [...state.timelineEvents, event].sort((a, b) => a.time - b.time)
                    }));
                    useTutorialStore.getState().completeEvent('event:created');
                },

                importTimelineEvents: (events) => {
                    pushHistory();
                    set({
                        timelineEvents: [...events].sort((a, b) => a.time - b.time),
                        timelineMitigations: [], // Clear old mitigations — they belong to a different fight
                    });
                    // Tutorial: notify that timeline content has been loaded
                    if (events.length > 0) {
                        useTutorialStore.getState().completeEvent('timeline:events-loaded');
                    }
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
                    // Tutorial: notify phase added
                    useTutorialStore.getState().completeEvent('phase:added');
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
                    set((state) => {
                        let currentMitigations = [...state.timelineMitigations];

                        // 副作用：サモン・セラフィムを配置した場合、重複する同一学者の「転化」を削除する
                        if (mitigation.mitigationId === 'summon_seraph') {
                            const seraphDuration = 22;
                            const seraphStart = mitigation.time;
                            const seraphEnd = seraphStart + seraphDuration;

                            currentMitigations = currentMitigations.filter(m => {
                                if (m.mitigationId === 'dissipation' && m.ownerId === mitigation.ownerId) {
                                    const dissStart = m.time;
                                    const dissEnd = m.time + m.duration;
                                    // 重複判定
                                    return (dissEnd <= seraphStart || dissStart >= seraphEnd);
                                }
                                return true;
                            });
                        }

                        return {
                            timelineMitigations: [...currentMitigations, mitigation]
                        };
                    });
                    // Tutorial: notify that a mitigation has been added
                    useTutorialStore.getState().completeEvent('mitigation:added');
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
                    set((state) => {
                        let currentMitigations = state.timelineMitigations.map(m =>
                            m.id === id ? { ...m, time: newTime } : m
                        );

                        const moved = currentMitigations.find(m => m.id === id);
                        if (moved && moved.mitigationId === 'summon_seraph') {
                            const seraphDuration = 22;
                            const seraphStart = moved.time;
                            const seraphEnd = seraphStart + seraphDuration;

                            currentMitigations = currentMitigations.filter(m => {
                                if (m.id === id) return true; // 自分自身は残す
                                if (m.mitigationId === 'dissipation' && m.ownerId === moved.ownerId) {
                                    const dissStart = m.time;
                                    const dissEnd = m.time + m.duration;
                                    // 重複判定
                                    return (dissEnd <= seraphStart || dissStart >= seraphEnd);
                                }
                                return true;
                            });
                        }

                        return {
                            timelineMitigations: currentMitigations
                        };
                    });
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
                    // Tutorial: detect if 4 or 8 members are set
                    const updatedMembers = get().partyMembers;
                    const setCount = updatedMembers.filter(m => m.jobId !== null).length;
                    if (setCount >= 8) {
                        useTutorialStore.getState().completeEvent('party:eight-set');
                    } else if (setCount >= 4) {
                        useTutorialStore.getState().completeEvent('party:four-set');
                    }
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
                        const finalMitis = [...mitis];
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

                updatePartyBulk: (updates) => {
                    pushHistory();
                    set((state) => {
                        let currentMembers = [...state.partyMembers];
                        let currentMitigations = [...state.timelineMitigations];

                        updates.forEach(({ memberId, jobId, mitigations }) => {
                            // 1. メンバー情報の更新
                            currentMembers = currentMembers.map(m => {
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

                            // 2. 軽減スキルの更新
                            if (mitigations) {
                                // 指定されたスキルリストで上書き
                                currentMitigations = currentMitigations.filter(mit => mit.ownerId !== memberId);
                                currentMitigations = [...currentMitigations, ...mitigations];
                            } else {
                                // jobIdが変更された場合のみ、簡易フィルタリング（setMemberJobと同じロジック）を実行
                                const originalMember = state.partyMembers.find(m => m.id === memberId);
                                if (originalMember && originalMember.jobId !== jobId) {
                                    currentMitigations = currentMitigations.reduce<AppliedMitigation[]>((acc, mit) => {
                                        if (mit.ownerId !== memberId) {
                                            acc.push(mit);
                                            return acc;
                                        }
                                        const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
                                        if (def?.jobId === jobId) {
                                            acc.push(mit);
                                            return acc;
                                        }
                                        if (def && def.jobId !== jobId) {
                                            const baseId = def.id.replace(`_${def.jobId}`, '');
                                            const newId = `${baseId}_${jobId}`;
                                            const newDef = MITIGATIONS.find(m => m.id === newId);
                                            if (newDef && newDef.jobId === jobId) {
                                                acc.push({ ...mit, mitigationId: newId });
                                                return acc;
                                            }
                                        }
                                        return acc;
                                    }, []);
                                }
                            }

                            // 3. 学者の場合の転化自動挿入（既存ロジックと同期）
                            if (jobId === 'sch') {
                                const pattern = state.schAetherflowPatterns[memberId] ?? 1;
                                const hasInitialDissipation = currentMitigations.some(m => m.mitigationId === 'dissipation' && m.ownerId === memberId && m.time <= 15);
                                if (!hasInitialDissipation) {
                                    currentMitigations.push({
                                        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9),
                                        mitigationId: 'dissipation',
                                        ownerId: memberId,
                                        time: pattern === 1 ? 1 : 14,
                                        duration: 30
                                    });
                                }
                            }
                        });

                        return {
                            partyMembers: currentMembers,
                            timelineMitigations: currentMitigations
                        };
                    });

                    // チュートリアルイベントのチェック
                    const updatedMembers = get().partyMembers;
                    const setCount = updatedMembers.filter(m => m.jobId !== null).length;
                    if (setCount >= 8) {
                        useTutorialStore.getState().completeEvent('party:eight-set');
                    } else if (setCount >= 4) {
                        useTutorialStore.getState().completeEvent('party:four-set');
                    }
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
                },

                resetForTutorial: () => {
                    const currentLevel = get().currentLevel;
                    const freshMembers = INITIAL_PARTY.map(m => ({
                        ...m,
                        computedValues: calculateMemberValues(m, currentLevel)
                    }));
                    set({
                        timelineEvents: [],
                        timelineMitigations: [],
                        phases: [],
                        partyMembers: freshMembers,
                        myMemberId: null,
                        myJobHighlight: false,
                        _history: [],
                        _future: [],
                    });
                },
            };
        },
        {
            name: 'mitigation-storage',
            version: 4,
            partialize: (state: MitigationState) => ({
                currentLevel: state.currentLevel,
                timelineEvents: state.timelineEvents,
                timelineMitigations: state.timelineMitigations,
                phases: state.phases,
                partyMembers: state.partyMembers,
                schAetherflowPatterns: state.schAetherflowPatterns,
                aaSettings: state.aaSettings,
                myMemberId: state.myMemberId,
                myJobHighlight: state.myJobHighlight,
                hideEmptyRows: state.hideEmptyRows,
                timelineSortOrder: state.timelineSortOrder
            }),
            migrate: (persistedState: any, _version: number) => {
                return persistedState;
            },
            merge: (persisted: any, current: MitigationState) => {
                if (!persisted) return current;
                return { 
                    ...current, 
                    ...persisted,
                    // Re-calculate computed values just in case
                    partyMembers: (persisted.partyMembers || current.partyMembers).map((m: any) => ({
                        ...m,
                        computedValues: calculateMemberValues(m, persisted.currentLevel || current.currentLevel)
                    }))
                };
            }
        }
    )
);