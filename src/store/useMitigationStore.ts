import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Mitigation, PartyMember, PlayerStats, TimelineEvent, Phase, Label, AppliedMitigation, PlanData, LocalizedString } from '../types';
import { migratePhases, ensurePhaseEndTimes, repairLastPhaseEndTime, repairAdjacentPhaseBoundaries } from '../utils/phaseMigration';
import { migrateLabels, isLegacyLabelFormat, ensureLabelEndTimes, repairLastLabelEndTime, repairAdjacentLabelBoundaries } from '../utils/labelMigration';

import { calculateMemberValues } from '../utils/calculator';
import { buildScholarAutoInserts, buildAetherflowChainFrom, hasAnyAetherflow } from '../utils/scholarAutoInsert';
import {
  getJobsFromStore,
  getMitigationsFromStore,
  getLevelModifiersFromStore,
  getDefaultStatsByLevelFromStore,
  getPatchStatsFromStore,
} from '../hooks/useSkillsData';
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
    labels: Label[];
    partyMembers: PartyMember[];
}

/** チュートリアル用の退避スナップショット型 */
export interface TutorialSnapshot {
    timelineEvents: TimelineEvent[];
    timelineMitigations: AppliedMitigation[];
    phases: Phase[];
    labels: Label[];
    partyMembers: PartyMember[];
    myMemberId: string | null;
    myJobHighlight: boolean;
    hideEmptyRows: boolean;
}

interface MitigationState {
    mitigations: Mitigation[];
    partyMembers: PartyMember[];
    timelineEvents: TimelineEvent[];
    phases: Phase[];
    labels: Label[];
    timelineMitigations: AppliedMitigation[];
    aaSettings: AASettings;
    schAetherflowPatterns: Record<string, 1 | 2>;
    currentLevel: number; // 👈 マルチレベル対応用

    // UI State
    myMemberId: string | null;
    myJobHighlight: boolean;
    hideEmptyRows: boolean;
    showRowBorders: boolean;
    clipboardEvent: TimelineEvent | null;
    timelineSortOrder: 'light_party' | 'role';
    conflictingMitigationId: string | null;

    /** 手動でエーテルフローを置いたあとの「リキャストごとに配置しますか？」ポップアップ制御 */
    aetherflowChainPrompt: { memberId: string; startTime: number } | null;

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
    addPhase: (startTime: number, name: LocalizedString) => void;
    updatePhase: (id: string, name: LocalizedString) => void;
    removePhase: (id: string) => void;
    updatePhaseEndTime: (id: string, newEndTime: number) => void;
    updatePhaseStartTime: (id: string, newStartTime: number) => void;
    addLabel: (startTime: number, name: LocalizedString) => void;
    updateLabel: (id: string, name: LocalizedString) => void;
    removeLabel: (id: string) => void;
    updateLabelEndTime: (id: string, newEndTime: number) => void;
    updateLabelStartTime: (id: string, newStartTime: number) => void;
    addMitigation: (mitigation: AppliedMitigation) => void;
    removeMitigation: (id: string) => void;
    updateMitigationTime: (id: string, newTime: number) => void;
    setMemberJob: (memberId: string, jobId: string | null) => void;
    setAaSettings: (settings: AASettings) => void;
    setSchAetherflowPattern: (memberId: string, pattern: 1 | 2) => void;
    /** Bulk-replace timeline events (e.g. from FFLogs import). Clears existing mitigations. */
    importTimelineEvents: (events: TimelineEvent[], importPhases?: { id: number; startTimeSec: number; name: LocalizedString }[], importLabels?: Label[]) => void;
    /** Changes a member's job and strictly overwrites their mitigations with the provided array */
    changeMemberJobWithMitigations: (memberId: string, jobId: string, mitis: AppliedMitigation[]) => void;
    /** 👇追加：複数のメンバーのジョブ変更を一括で適用する（履歴は1回だけ保存） */
    updatePartyBulk: (updates: { memberId: string, jobId: string | null, mitigations?: AppliedMitigation[] }[]) => void;

    // Bulk delete
    clearMitigationsByMember: (memberId: string) => void;
    clearAllMitigations: () => void;
    /** Reset all state for tutorial restart/completion */
    resetForTutorial: () => void;
    /** チュートリアル終了時に退避した状態を復元する */
    restoreFromSnapshot: (snapshot: TutorialSnapshot) => void;
    /** 👇追加：既存の軽減をすべて消去し、新しい軽減リストで一括上書きする（Undo1回で戻せる） */
    applyAutoPlan: (result: { mitigations: AppliedMitigation[], warnings: string[] }) => void;

    // Undo/Redo
    undo: () => void;
    redo: () => void;

    // Snapshot Actions
    getSnapshot: () => PlanData;
    loadSnapshot: (snapshot: PlanData) => void;

    // UI Actions
    setMyMemberId: (memberId: string | null) => void;
    setMyJobHighlight: (enabled: boolean) => void;
    setHideEmptyRows: (hide: boolean) => void;
    setShowRowBorders: (show: boolean) => void;
    setClipboardEvent: (event: TimelineEvent | null) => void;
    setTimelineSortOrder: (order: 'light_party' | 'role') => void;
    setConflictingMitigationId: (id: string | null) => void;

    /** エーテルフロー連鎖配置プロンプト制御 */
    dismissAetherflowChainPrompt: () => void;
    /** プロンプトの startTime から 60s 間隔で最終イベントまで aetherflow を連続配置する */
    confirmAetherflowChain: () => void;
}

// レベルに応じたサブステベース値を取得（遅延評価）
const getSubBase = (level: number = 100) => {
    const mods = getLevelModifiersFromStore();
    return mods[level]?.sub ?? 420;
};

const fillDefaultStats = (partial: any, level: number = 100): PlayerStats => ({
    ...partial,
    crt: getSubBase(level),
    ten: getSubBase(level),
    ss: getSubBase(level),
});

// ストアからデフォルトステータスを遅延取得する関数
export function getDefaultTankStats(level: number = 100): PlayerStats {
    const defaults = getDefaultStatsByLevelFromStore();
    return fillDefaultStats(defaults[level]?.tank ?? defaults[100]?.tank ?? { hp: 296194, mainStat: 6217, det: 2410, wd: 154 }, level);
}

export function getDefaultHealerStats(level: number = 100): PlayerStats {
    const defaults = getDefaultStatsByLevelFromStore();
    return fillDefaultStats(defaults[level]?.other ?? defaults[100]?.other ?? { hp: 186846, mainStat: 6317, det: 2987, wd: 154 }, level);
}

// 後方互換性（モジュールレベル定数として静的フォールバック値で初期化）
export const DEFAULT_TANK_STATS: PlayerStats = getDefaultTankStats();
export const DEFAULT_HEALER_STATS: PlayerStats = getDefaultHealerStats();

// Initial Party Slots
const INITIAL_PARTY: PartyMember[] = [
    { id: 'MT', jobId: null, role: 'tank', stats: { ...getDefaultTankStats() }, computedValues: {} },
    { id: 'ST', jobId: null, role: 'tank', stats: { ...getDefaultTankStats() }, computedValues: {} },
    { id: 'H1', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {} },
    { id: 'H2', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {} },
    { id: 'D1', jobId: null, role: 'dps', stats: { ...getDefaultHealerStats() }, computedValues: {} },
    { id: 'D2', jobId: null, role: 'dps', stats: { ...getDefaultHealerStats() }, computedValues: {} },
    { id: 'D3', jobId: null, role: 'dps', stats: { ...getDefaultHealerStats() }, computedValues: {} },
    { id: 'D4', jobId: null, role: 'dps', stats: { ...getDefaultHealerStats() }, computedValues: {} },
];

/**
 * copiesShieldスキル（展開戦術等）の自動リンクを解決する。
 * - リンク先が有効ならそのまま
 * - リンク先が無効になった or リンク未設定 → 有効なコピー元が1つなら自動リンク
 * - 0個 or 2個以上 → リンク解除（ユーザー選択待ち）
 */
const resolveShieldLinks = (
    mitigations: AppliedMitigation[],
    mitigationDefs: Mitigation[],
): AppliedMitigation[] => {
    let changed = false;
    const result = mitigations.map(m => {
        const def = mitigationDefs.find(d => d.id === m.mitigationId);
        if (!def?.copiesShield) return m;

        // 現在のリンクが有効か確認
        if (m.linkedMitigationId) {
            const linked = mitigations.find(l => l.id === m.linkedMitigationId);
            if (linked && linked.mitigationId === def.copiesShield &&
                linked.time <= m.time && linked.time + linked.duration > m.time) {
                // リンク有効 — durationを鼓舞の残り時間に同期
                const remainingDuration = Math.max(1, linked.time + linked.duration - m.time);
                if (m.duration !== remainingDuration) {
                    changed = true;
                    return { ...m, duration: remainingDuration };
                }
                return m;
            }
        }

        // 有効なコピー元を検索
        const available = mitigations.filter(l =>
            l.id !== m.id &&
            l.mitigationId === def.copiesShield &&
            l.time <= m.time &&
            l.time + l.duration > m.time
        );

        if (available.length === 1) {
            changed = true;
            const remainingDuration = Math.max(1, available[0].time + available[0].duration - m.time);
            return { ...m, linkedMitigationId: available[0].id, duration: remainingDuration };
        }

        // 0個 or 2+個: リンク解除
        if (m.linkedMitigationId) {
            changed = true;
            return { ...m, linkedMitigationId: undefined };
        }
        return m;
    });

    return changed ? result : mitigations;
};

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
                    labels: [...state.labels],
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
                labels: [],
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
                hideEmptyRows: true,
                showRowBorders: false,
                clipboardEvent: null,
                timelineSortOrder: 'light_party',
                conflictingMitigationId: null,
                aetherflowChainPrompt: null,
                _history: [],
                _future: [],

                getSnapshot: () => {
                    const state = get();
                    return {
                        currentLevel: state.currentLevel,
                        timelineEvents: state.timelineEvents,
                        timelineMitigations: state.timelineMitigations,
                        phases: state.phases,
                        labels: state.labels,
                        partyMembers: state.partyMembers,
                        aaSettings: state.aaSettings,
                        schAetherflowPatterns: state.schAetherflowPatterns,
                        myMemberId: state.myMemberId,
                    };
                },

                loadSnapshot: (snapshot) => {
                    const membersWithComputed = snapshot.partyMembers.map((m: PartyMember) => ({
                        ...m,
                        computedValues: calculateMemberValues(m, snapshot.currentLevel)
                    }));

                    // timelineEvents の最大時刻を計算（最終フェーズ/ラベルの endTime フォールバックに使用）
                    const maxEventTime = snapshot.timelineEvents.length > 0
                        ? snapshot.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
                        : undefined;

                    const migratedPhases = migratePhases(snapshot.phases ?? [], maxEventTime);
                    const labels: Label[] = isLegacyLabelFormat(snapshot as any)
                        ? migrateLabels(snapshot.timelineEvents, migratedPhases)
                        : ensureLabelEndTimes((snapshot as any).labels ?? [], maxEventTime);

                    // 過去バグ（最終フェーズ/ラベルの endTime が startTime+1 で保存されている）を修復
                    const lastRepairedPhases = maxEventTime !== undefined
                        ? repairLastPhaseEndTime(migratedPhases, snapshot.timelineEvents, maxEventTime)
                        : migratedPhases;
                    const lastRepairedLabels = maxEventTime !== undefined
                        ? repairLastLabelEndTime(labels, snapshot.timelineEvents, maxEventTime)
                        : labels;

                    // 旧隣接規約 (endTime === next.startTime) を新規約 (endTime + 1 === next.startTime) に修復
                    const finalPhases = repairAdjacentPhaseBoundaries(lastRepairedPhases);
                    const finalLabels = repairAdjacentLabelBoundaries(lastRepairedLabels);

                    // 学者の aetherflow 自動挿入マイグレーション
                    // 旧プラン (pattern 時代) は dissipation のみ配置されていて aetherflow が無い。
                    // aetherflow が 1 つでもあるプラン（新形式・編集後保存）はユーザー編集尊重で触らない。
                    let migratedMitigations = [...snapshot.timelineMitigations];
                    for (const member of membersWithComputed) {
                        if (member.jobId === 'sch' && !hasAnyAetherflow(member.id, migratedMitigations)) {
                            const inserts = buildScholarAutoInserts(member.id, migratedMitigations, snapshot.timelineEvents);
                            migratedMitigations.push(...inserts);
                        }
                    }

                    set({
                        currentLevel: snapshot.currentLevel,
                        timelineEvents: snapshot.timelineEvents,
                        timelineMitigations: migratedMitigations,
                        phases: finalPhases,
                        labels: finalLabels,
                        partyMembers: membersWithComputed,
                        aaSettings: snapshot.aaSettings,
                        schAetherflowPatterns: snapshot.schAetherflowPatterns,
                        myMemberId: snapshot.myMemberId ?? null,
                        // Reset Undo/Redo on load
                        _history: [],
                        _future: [],
                    });

                    // チュートリアル: content:selected はSidebar.tsx側でトランジション完了後に発火する
                    // （loadSnapshot内で即座に発火すると、ローディング中にSTEP2に進んでしまう）
                },

                // Undo: restore the last snapshot from history
                undo: () => set((state) => {
                    if (state._history.length === 0) return state;
                    const previous = state._history[state._history.length - 1];
                    const newHistory = state._history.slice(0, -1);
                    const currentSnapshot: HistorySnapshot = {
                        timelineMitigations: state.timelineMitigations,
                        timelineEvents: state.timelineEvents,
                        phases: state.phases,
                        labels: state.labels,
                        partyMembers: state.partyMembers
                    };
                    return {
                        _history: newHistory,
                        _future: [currentSnapshot, ...state._future],
                        timelineMitigations: previous.timelineMitigations,
                        timelineEvents: previous.timelineEvents,
                        phases: previous.phases,
                        labels: previous.labels,
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
                        labels: state.labels,
                        partyMembers: state.partyMembers
                    };
                    return {
                        _history: [...state._history, currentSnapshot],
                        _future: newFuture,
                        timelineMitigations: next.timelineMitigations,
                        timelineEvents: next.timelineEvents,
                        phases: next.phases,
                        labels: next.labels,
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
                    set(state => {
                        // オートプランは dissipation のみ置くので、SCH メンバーに aetherflow を自動補完。
                        // ただし aetherflow が既に含まれていればユーザー編集尊重で触らない。
                        let finalMitigations = [...mitigations];
                        for (const member of state.partyMembers) {
                            if (member.jobId === 'sch' && !hasAnyAetherflow(member.id, finalMitigations)) {
                                const inserts = buildScholarAutoInserts(member.id, finalMitigations, state.timelineEvents);
                                finalMitigations.push(...inserts);
                            }
                        }
                        return {
                            timelineMitigations: finalMitigations,
                            timelineEvents: state.timelineEvents.map(e => ({
                                ...e,
                                warning: warnings.includes(e.id)
                            }))
                        };
                    });
                },

                setMyMemberId: (memberId) => {
                    set({ myMemberId: memberId });
                    // (チュートリアルイベント削除済み: myjob:set)
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
                        const patchData = patch ? getPatchStatsFromStore()[patch] : null;
                        const template = patchData || getDefaultStatsByLevelFromStore()[level] || getDefaultStatsByLevelFromStore()[100];
                        
                        // 不足項目(crt, ten, ss)をベース値で補完
                        const subBase = getLevelModifiersFromStore()[level]?.sub || 420;
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
                setShowRowBorders: (show) => set({ showRowBorders: show }),
                setClipboardEvent: (event) => set({ clipboardEvent: event }),
                setTimelineSortOrder: (order) => set({ timelineSortOrder: order }),
                setConflictingMitigationId: (id) => set({ conflictingMitigationId: id }),

                dismissAetherflowChainPrompt: () => set({ aetherflowChainPrompt: null }),

                confirmAetherflowChain: () => {
                    const state = get();
                    if (!state.aetherflowChainPrompt) return;
                    const { memberId, startTime } = state.aetherflowChainPrompt;
                    pushHistory();
                    set((s) => {
                        const chain = buildAetherflowChainFrom(memberId, startTime, s.timelineMitigations, s.timelineEvents);
                        return {
                            timelineMitigations: [...s.timelineMitigations, ...chain],
                            aetherflowChainPrompt: null,
                        };
                    });
                },

                addEvent: (event) => {
                    pushHistory();
                    set((state) => ({
                        timelineEvents: [...state.timelineEvents, event].sort((a, b) => a.time - b.time)
                    }));
                    useTutorialStore.getState().completeEvent('event:saved');
                },

                importTimelineEvents: (events, importPhases, importLabels) => {
                    pushHistory();
                    const maxEventTime = events.length > 0
                        ? events.reduce((max, e) => Math.max(max, e.time), 0)
                        : undefined;
                    const update: Partial<ReturnType<typeof get>> = {
                        timelineEvents: [...events].sort((a, b) => a.time - b.time),
                        timelineMitigations: [], // Clear old mitigations — they belong to a different fight
                    };
                    if (importPhases) {
                        update.phases = ensurePhaseEndTimes(importPhases
                            .filter(p => p.startTimeSec >= 0)
                            .map(p => ({
                                id: `phase_${p.id}`,
                                name: p.name,
                                startTime: p.startTimeSec,
                            })), maxEventTime);
                    }
                    if (importLabels) {
                        update.labels = importLabels;
                    }
                    set(update as any);
                    // Tutorial: notify that timeline content has been loaded
                    if (events.length > 0) {
                        useTutorialStore.getState().completeEvent('content:selected');
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

                addPhase: (startTime, name) => {
                    const exists = get().phases.some(p => p.startTime === startTime);
                    if (exists) return;
                    pushHistory();
                    set((state) => {
                        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
                        const nextPhase = sorted.find(p => p.startTime > startTime);
                        // 新規約: endTime === startTime でも含有とみなす（描画は endTime+1 まで）
                        const containingPhase = sorted.find(p => p.startTime <= startTime && p.endTime >= startTime);
                        let endTime: number;
                        if (nextPhase) {
                            endTime = nextPhase.startTime - 1;
                        } else if (containingPhase) {
                            endTime = containingPhase.endTime;
                        } else {
                            const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                            endTime = Math.max(maxEventTime, startTime + 1);
                        }
                        const newPhase: Phase = {
                            id: crypto.randomUUID(),
                            name,
                            startTime,
                            endTime,
                        };
                        const clippedPhases = state.phases.map(p => {
                            // 含有フェーズを新 startTime の 1 秒前で終わらせる（gap は意図的に残せる仕様）
                            if (p.endTime >= startTime && p.startTime < startTime) {
                                return { ...p, endTime: startTime - 1 };
                            }
                            return p;
                        });
                        return { phases: [...clippedPhases, newPhase].sort((a, b) => a.startTime - b.startTime) };
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

                updatePhaseEndTime: (id, newEndTime) => {
                    pushHistory();
                    set((state) => {
                        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(p => p.id === id);
                        if (idx < 0) return {};
                        const self = sorted[idx];
                        const nextPhase = sorted[idx + 1];
                        let final = Math.max(newEndTime, self.startTime + 1);
                        if (nextPhase && final >= nextPhase.startTime) {
                            // 新規約: next.startTime = final + 1。next の最低幅 1 秒確保のため final ≤ next.endTime - 2
                            final = Math.min(final, nextPhase.endTime - 2);
                            return {
                                phases: state.phases.map(p => {
                                    if (p.id === id) return { ...p, endTime: final };
                                    if (p.id === nextPhase.id) return { ...p, startTime: final + 1 };
                                    return p;
                                })
                            };
                        }
                        return {
                            phases: state.phases.map(p => p.id === id ? { ...p, endTime: final } : p)
                        };
                    });
                },

                updatePhaseStartTime: (id, newStartTime) => {
                    pushHistory();
                    set((state) => {
                        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(p => p.id === id);
                        if (idx < 0) return {};
                        const self = sorted[idx];
                        const prevPhase = idx > 0 ? sorted[idx - 1] : null;
                        let final = Math.max(newStartTime, 0);
                        final = Math.min(final, self.endTime - 1);
                        if (prevPhase && final <= prevPhase.endTime) {
                            // 新規約: prev.endTime = final - 1。prev の最低幅 1 秒確保のため final ≥ prev.startTime + 2
                            final = Math.max(final, prevPhase.startTime + 2);
                            return {
                                phases: state.phases.map(p => {
                                    if (p.id === id) return { ...p, startTime: final };
                                    if (p.id === prevPhase.id) return { ...p, endTime: final - 1 };
                                    return p;
                                })
                            };
                        }
                        return {
                            phases: state.phases.map(p => p.id === id ? { ...p, startTime: final } : p)
                        };
                    });
                },

                addLabel: (startTime, name) => {
                    const exists = get().labels.some(l => l.startTime === startTime);
                    if (exists) return;
                    pushHistory();
                    set((state) => {
                        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
                        const nextLabel = sorted.find(l => l.startTime > startTime);
                        const containingLabel = sorted.find(l => l.startTime <= startTime && l.endTime >= startTime);
                        let endTime: number;
                        if (nextLabel) {
                            endTime = nextLabel.startTime - 1;
                        } else if (containingLabel) {
                            endTime = containingLabel.endTime;
                        } else {
                            const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                            endTime = Math.max(maxEventTime, startTime + 1);
                        }
                        const newLabel: Label = {
                            id: crypto.randomUUID(),
                            name,
                            startTime,
                            endTime,
                        };
                        const clippedLabels = state.labels.map(l => {
                            if (l.endTime >= startTime && l.startTime < startTime) {
                                return { ...l, endTime: startTime - 1 };
                            }
                            return l;
                        });
                        return { labels: [...clippedLabels, newLabel].sort((a, b) => a.startTime - b.startTime) };
                    });
                },

                updateLabel: (id, name) => {
                    pushHistory();
                    set((state) => ({
                        labels: state.labels.map(l => l.id === id ? { ...l, name } : l)
                    }));
                },

                removeLabel: (id) => {
                    pushHistory();
                    set((state) => ({
                        labels: state.labels.filter(l => l.id !== id)
                    }));
                },

                updateLabelEndTime: (id, newEndTime) => {
                    pushHistory();
                    set((state) => {
                        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(l => l.id === id);
                        if (idx < 0) return {};
                        const self = sorted[idx];
                        const nextLabel = sorted[idx + 1];
                        let final = Math.max(newEndTime, self.startTime + 1);
                        if (nextLabel && final >= nextLabel.startTime) {
                            final = Math.min(final, nextLabel.endTime - 2);
                            return {
                                labels: state.labels.map(l => {
                                    if (l.id === id) return { ...l, endTime: final };
                                    if (l.id === nextLabel.id) return { ...l, startTime: final + 1 };
                                    return l;
                                })
                            };
                        }
                        return {
                            labels: state.labels.map(l => l.id === id ? { ...l, endTime: final } : l)
                        };
                    });
                },

                updateLabelStartTime: (id, newStartTime) => {
                    pushHistory();
                    set((state) => {
                        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(l => l.id === id);
                        if (idx < 0) return {};
                        const self = sorted[idx];
                        const prevLabel = idx > 0 ? sorted[idx - 1] : null;
                        let final = Math.max(newStartTime, 0);
                        final = Math.min(final, self.endTime - 1);
                        if (prevLabel && final <= prevLabel.endTime) {
                            final = Math.max(final, prevLabel.startTime + 2);
                            return {
                                labels: state.labels.map(l => {
                                    if (l.id === id) return { ...l, startTime: final };
                                    if (l.id === prevLabel.id) return { ...l, endTime: final - 1 };
                                    return l;
                                })
                            };
                        }
                        return {
                            labels: state.labels.map(l => l.id === id ? { ...l, startTime: final } : l)
                        };
                    });
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

                        const newMitigations = [...currentMitigations, mitigation];

                        // 手動で aetherflow を置いたときは「リキャストごと配置」確認プロンプトを表示
                        const promptPatch = mitigation.mitigationId === 'aetherflow'
                            ? { aetherflowChainPrompt: { memberId: mitigation.ownerId, startTime: mitigation.time } }
                            : {};

                        return {
                            timelineMitigations: resolveShieldLinks(newMitigations, getMitigationsFromStore()),
                            ...promptPatch,
                        };
                    });
                    // Tutorial: notify that a mitigation has been added
                    useTutorialStore.getState().completeEvent('mitigation:added');
                },

                removeMitigation: (id) => {
                    pushHistory();
                    // 被り先のアニメーション、または被り元の軽減が削除された場合もクリア
                    const currentConflict = get().conflictingMitigationId;
                    if (currentConflict) set({ conflictingMitigationId: null });
                    set((state) => {
                        const removed = state.timelineMitigations.find(m => m.id === id);
                        if (!removed) return { timelineMitigations: resolveShieldLinks(state.timelineMitigations.filter(m => m.id !== id), getMitigationsFromStore()) };

                        const removedDef = getMitigationsFromStore().find(d => d.id === removed.mitigationId);
                        if (!removedDef) return { timelineMitigations: resolveShieldLinks(state.timelineMitigations.filter(m => m.id !== id), getMitigationsFromStore()) };

                        // Find skills that depend on the removed skill
                        const dependentIds = getMitigationsFromStore().filter(d => d.requires === removed.mitigationId).map(d => d.id);

                        const removedStart = removed.time;
                        const removedEnd = removed.time + removed.duration;

                        const filtered = state.timelineMitigations.filter(m => {
                            if (m.id === id) return false; // Remove the target itself
                            // Remove dependents that overlap the removed skill's window
                            if (dependentIds.includes(m.mitigationId) && m.ownerId === removed.ownerId) {
                                return !(m.time >= removedStart && m.time < removedEnd);
                            }
                            return true;
                        });
                        return {
                            timelineMitigations: resolveShieldLinks(filtered, getMitigationsFromStore())
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
                            timelineMitigations: resolveShieldLinks(currentMitigations, getMitigationsFromStore())
                        };
                    });
                },

                setMemberJob: (memberId, jobId) => {
                    pushHistory();
                    set((state) => {
                        const newMembers = state.partyMembers.map(m => {
                            if (m.id === memberId) {
                                const job = getJobsFromStore().find(j => j.id === jobId);
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

                            const def = getMitigationsFromStore().find(m => m.id === mit.mitigationId);

                            // If exact match (job specific or shared if any), keep it
                            if (def?.jobId === jobId) {
                                acc.push(mit);
                                return acc;
                            }

                            // Try to migrate Role Actions (e.g. rampart_gnb -> rampart_drk)
                            if (def && def.jobId !== jobId) {
                                const baseId = def.id.replace(`_${def.jobId}`, '');
                                const newId = `${baseId}_${jobId}`;
                                const newDef = getMitigationsFromStore().find(m => m.id === newId);

                                if (newDef && newDef.jobId === jobId) {
                                    // Migration successful
                                    acc.push({ ...mit, mitigationId: newId });
                                    return acc;
                                }
                            }

                            // Otherwise filter out
                            return acc;
                        }, []);

                        // Auto-insert Dissipation + Aetherflow for Scholar
                        // 既に aetherflow を持っていればユーザー編集尊重でスキップ
                        if (jobId === 'sch' && !hasAnyAetherflow(memberId, filteredMitigations)) {
                            const inserts = buildScholarAutoInserts(memberId, filteredMitigations, state.timelineEvents);
                            filteredMitigations.push(...inserts);
                        }

                        return { partyMembers: newMembers, timelineMitigations: filteredMitigations };
                    });
                    // Tutorial: detect if 4 or 8 members are set
                    // (チュートリアルイベント削除済み: party:eight-set / party:four-set)
                },

                changeMemberJobWithMitigations: (memberId, jobId, mitis) => {
                    pushHistory();
                    set((state) => {
                        // Update member job
                        const newMembers = state.partyMembers.map(m => {
                            if (m.id === memberId) {
                                const job = getJobsFromStore().find(j => j.id === jobId);
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

                        // Auto-insert Dissipation + Aetherflow for Scholar
                        // 既に aetherflow を持っていればユーザー編集尊重でスキップ
                        const finalMitis = [...mitis];
                        if (jobId === 'sch') {
                            const ownedMitis = finalMitis.map(m => ({ ...m, ownerId: memberId }));
                            if (!hasAnyAetherflow(memberId, ownedMitis)) {
                                const inserts = buildScholarAutoInserts(memberId, ownedMitis, state.timelineEvents);
                                finalMitis.push(...inserts);
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
                                    const job = getJobsFromStore().find(j => j.id === jobId);
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
                                        const def = getMitigationsFromStore().find(m => m.id === mit.mitigationId);
                                        if (def?.jobId === jobId) {
                                            acc.push(mit);
                                            return acc;
                                        }
                                        if (def && def.jobId !== jobId) {
                                            const baseId = def.id.replace(`_${def.jobId}`, '');
                                            const newId = `${baseId}_${jobId}`;
                                            const newDef = getMitigationsFromStore().find(m => m.id === newId);
                                            if (newDef && newDef.jobId === jobId) {
                                                acc.push({ ...mit, mitigationId: newId });
                                                return acc;
                                            }
                                        }
                                        return acc;
                                    }, []);
                                }
                            }

                            // 3. 学者の場合の転化+エーテルフロー自動挿入
                            // 既に aetherflow を持っていればユーザー編集尊重でスキップ
                            if (jobId === 'sch' && !hasAnyAetherflow(memberId, currentMitigations)) {
                                const inserts = buildScholarAutoInserts(memberId, currentMitigations, state.timelineEvents);
                                currentMitigations.push(...inserts);
                            }
                        });

                        return {
                            partyMembers: currentMembers,
                            timelineMitigations: currentMitigations
                        };
                    });

                    // (チュートリアルイベント削除済み: party:eight-set / party:four-set)
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
                    const maxLevel = 100;
                    const freshMembers = INITIAL_PARTY.map(m => ({
                        ...m,
                        computedValues: calculateMemberValues(m, maxLevel)
                    }));
                    set({
                        currentLevel: maxLevel,
                        timelineEvents: [],
                        timelineMitigations: [],
                        phases: [],
                        labels: [],
                        partyMembers: freshMembers,
                        myMemberId: null,
                        myJobHighlight: false,
                        hideEmptyRows: true,
                        _history: [],
                        _future: [],
                    });
                    window.dispatchEvent(new CustomEvent('tutorial:reset-ui'));
                },

                restoreFromSnapshot: (snapshot: TutorialSnapshot) => {
                    const currentLevel = get().currentLevel;
                    const membersWithComputed = snapshot.partyMembers.map((m: PartyMember) => ({
                        ...m,
                        computedValues: calculateMemberValues(m, currentLevel)
                    }));
                    set({
                        timelineEvents: snapshot.timelineEvents,
                        timelineMitigations: snapshot.timelineMitigations,
                        phases: snapshot.phases,
                        labels: snapshot.labels,
                        partyMembers: membersWithComputed,
                        myMemberId: snapshot.myMemberId,
                        myJobHighlight: snapshot.myJobHighlight,
                        hideEmptyRows: snapshot.hideEmptyRows,
                        _history: [],
                        _future: [],
                    });
                },
            };
        },
        {
            name: 'mitigation-storage',
            version: 4,
            // チュートリアル中はlocalStorageへの書き込みを停止（壊れたデータの永続化を防止）
            storage: {
                getItem: (name: string) => {
                    const str = localStorage.getItem(name);
                    return str ? JSON.parse(str) : null;
                },
                setItem: (name: string, value: unknown) => {
                    // チュートリアル中は書き込みスキップ
                    if (useTutorialStore.getState().isActive) return;
                    localStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name: string) => {
                    localStorage.removeItem(name);
                },
            },
            partialize: (state: MitigationState) => ({
                currentLevel: state.currentLevel,
                timelineEvents: state.timelineEvents,
                timelineMitigations: state.timelineMitigations,
                phases: state.phases,
                labels: state.labels,
                partyMembers: state.partyMembers,
                schAetherflowPatterns: state.schAetherflowPatterns,
                aaSettings: state.aaSettings,
                myMemberId: state.myMemberId,
                myJobHighlight: state.myJobHighlight,
                hideEmptyRows: state.hideEmptyRows,
                showRowBorders: state.showRowBorders,
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