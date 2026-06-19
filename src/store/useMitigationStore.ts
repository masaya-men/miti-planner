import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Mitigation, PartyMember, PlayerStats, TimelineEvent, Phase, Label, AppliedMitigation, PlanData, LocalizedString, PlanMemo, PlanProgress, ProgressPoint } from '../types';
import { appendProgressPoint, removeProgressPoint, normalizeProgress, insertProgressPoint } from '../lib/progressLogic';
import { migratePhases, ensurePhaseEndTimes, repairLastPhaseEndTime, repairAdjacentPhaseBoundaries } from '../utils/phaseMigration';
import { migrateLabels, isLegacyLabelFormat, ensureLabelEndTimes, repairLastLabelEndTime, repairAdjacentLabelBoundaries } from '../utils/labelMigration';
import { MEMO_LIMITS } from '../types/firebase';

import { calculateMemberValues } from '../utils/calculator';
import { buildScholarAutoInserts, buildAetherflowChainFrom, hasAnyAetherflow } from '../utils/scholarAutoInsert';
import { buildAstrologianAutoInserts, buildAstrologianDrawChainFrom, hasAnyAstrologianDraw } from '../utils/astrologianAutoInsert';
import {
  getJobsFromStore,
  getMitigationsFromStore,
  getLevelModifiersFromStore,
  getDefaultStatsByLevelFromStore,
  getPatchStatsFromStore,
} from '../hooks/useSkillsData';
import { useTutorialStore } from './useTutorialStore';
import { DEFAULT_NEW_MODE } from '../utils/mitigationResolver';
import type { CollabHandlers } from '../lib/collab/collabTypes';
import type { BatchOp } from '../lib/collab/yjsPlanData';

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
    /** 競合表示用: 直前にユーザーが手動配置したインスタンス id (セッションのみ・partialize 非対象)。
     *  「置いた時は"既存の相手"だけ光らせ、自分が今置いた方は光らせない」を実現するため、
     *  この id だけ脈動/矢印から除外する。リロードで null に戻る → 既存競合は両方光る。 */
    lastPlacedMitigationId: string | null;
    /** メモ機能 (#57) — シート上のメモ配列。 plan データの一部として永続化される。 */
    memos: PlanMemo[];
    /** 進捗トラッキング (#HUD) — 表ごとの進捗データ。 plan データの一部として永続化される。 */
    progress: PlanProgress;
    /** メモ機能 (#57) — UI 一時状態 (タブ切替・リロードでリセット、 partialize には含めない)。 */
    toolMode: 'idle' | 'aa-placement' | 'memo';

    /** 手動でエーテルフローを置いたあとの「リキャストごとに配置しますか？」ポップアップ制御 */
    aetherflowChainPrompt: { memberId: string; startTime: number } | null;

    /** 手動で占星ドロー (Astral/Umbral) を置いたあとの「リキャストごとに交互配置しますか？」ポップアップ制御 */
    astrologianDrawChainPrompt: { memberId: string; startTime: number; startKind: 'astral_draw' | 'umbral_draw' } | null;

    // Undo/Redo History (not persisted)
    _history: HistorySnapshot[]; // 👈 軽減だけでなく、すべてのデータを履歴に持つように変更
    _future: HistorySnapshot[];

    // --- 共同編集 (段取り②-a・遅延ロード境界) ---
    // store は yjs を実行時 import しない。共同編集操作は遅延チャンク(collabProvider)が
    // 注入する CollabHandlers に委譲する。_ydoc 等 yjs 型の state は store に持たない。
    _collabActive: boolean;
    _collabHandlers: CollabHandlers | null;
    /** ②-c: 共同編集中の Undo/Redo 可否(Y.UndoManager の canUndo/canRedo を反映・ボタン活性用)。 */
    _collabCanUndo: boolean;
    _collabCanRedo: boolean;
    _setCollabUndoRedo: (canUndo: boolean, canRedo: boolean) => void;
    /** ⑤-3b: ジョイナー読み取り専用中は localStorage persist を skip し、自分の保存データを汚さない。 */
    _collabReadonly: boolean;
    setCollabReadonly: (v: boolean) => void;
    /** 根治: 作業ストアが今どの表の内容を載せているか(=データの持ち主)。保存先の決定に使う。 */
    _loadedPlanId: string | null;
    setLoadedPlanId: (id: string | null) => void;

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
    loadSnapshot: (snapshot: PlanData, planId?: string) => void;

    // UI Actions
    setMyMemberId: (memberId: string | null) => void;
    setMyJobHighlight: (enabled: boolean) => void;
    setHideEmptyRows: (hide: boolean) => void;
    setShowRowBorders: (show: boolean) => void;
    setClipboardEvent: (event: TimelineEvent | null) => void;
    setTimelineSortOrder: (order: 'light_party' | 'role') => void;
    /** エーテルフロー連鎖配置プロンプト制御 */
    dismissAetherflowChainPrompt: () => void;
    /** プロンプトの startTime から 60s 間隔で最終イベントまで aetherflow を連続配置する */
    confirmAetherflowChain: () => void;

    /** 占星ドロー交互配置プロンプト制御 */
    dismissAstrologianDrawChainPrompt: () => void;
    /** プロンプトの startTime から 60s 間隔で最終イベントまで Astral/Umbral を交互配置する */
    confirmAstrologianDrawChain: () => void;

    // --- 共同編集 (段取り②-a) ---
    /** 共同編集を開始(遅延チャンクが handlers を注入)。 */
    enterCollabMode: (handlers: CollabHandlers) => void;
    /** 共同編集を終了し通常モードへ戻す。 */
    exitCollabMode: () => void;
    /** 遅延チャンクの observeDeep から呼ぶ: Yjs 側の最新軽減配列を store に反映(盾連鎖を再計算)。 */
    _applyMitigationsFromCollab: (mitigations: AppliedMitigation[]) => void;
    // ②-b-1: Yjs 側の最新要素を store に反映(pushHistory は積まない＝②-a と同じ)。
    _applyEventsFromCollab: (events: TimelineEvent[]) => void;
    _applyPhasesFromCollab: (phases: Phase[]) => void;
    _applyLabelsFromCollab: (labels: Label[]) => void;
    _applyMemosFromCollab: (memos: PlanMemo[]) => void;
    /** ②-b-2: Yjs 側の最新 partyMembers を store に反映(computedValues は currentLevel からローカル再計算)。 */
    _applyPartyMembersFromCollab: (members: PartyMember[]) => void;
    _applyMetaFromCollab: (meta: { currentLevel?: number; aaSettings?: AASettings; schAetherflowPatterns?: Record<string, 1 | 2> }) => void;

    // メモ機能アクション (#57)
    setToolMode: (mode: 'idle' | 'aa-placement' | 'memo') => void;
    addMemo: (input: { text: string; timeSec: number; xRatio: number }) => boolean;
    updateMemo: (id: string, patch: Partial<Pick<PlanMemo, 'text' | 'timeSec' | 'xRatio'>>) => void;
    deleteMemo: (id: string) => void;
    deleteAllMemos: () => void;

    // 進捗トラッキング アクション (#HUD)
    recordReachedPoint: (reachedPos: number) => void;
    removeProgressPoint: (index: number) => void;
    setCleared: (cleared: boolean) => void;
    setActiveDays: (n: number | undefined) => void;
    setActiveHours: (n: number | undefined) => void;
    setProgressPointNote: (index: number, note: string) => void;
    clearAllProgressPoints: () => void;
    insertProgressPointAt: (index: number, point: ProgressPoint) => void;
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
    { id: 'MT', jobId: null, role: 'tank',   stats: { ...getDefaultTankStats() },   computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'ST', jobId: null, role: 'tank',   stats: { ...getDefaultTankStats() },   computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'H1', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'H2', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D1', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D2', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D3', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D4', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
];

// ────────────────────────────────────────────────────────────────────
// ②-b-2: partyMembers 変更 mutation のソロ計算を純関数に抽出(collab/ソロ両経路で共有=DRY)。
// collab 分岐は同じ関数で結果を計算し、差分をハンドラ経由で Y に反映する(二重実装回避)。
// ────────────────────────────────────────────────────────────────────

/** applyDefaultStats のソロ計算。level/patch から全メンバーの stats を既定値で更新する。 */
function computeDefaultStatsMembers(
    members: PartyMember[],
    level: number,
    patch?: string,
): PartyMember[] {
    const patchData = patch ? getPatchStatsFromStore()[patch] : null;
    const template = patchData || getDefaultStatsByLevelFromStore()[level] || getDefaultStatsByLevelFromStore()[100];
    const subBase = getLevelModifiersFromStore()[level]?.sub || 420;
    const fillStats = (partial: any): PlayerStats => ({ ...partial, crt: subBase, ten: subBase, ss: subBase });
    const newDefaults = { tank: fillStats(template.tank), other: fillStats(template.other) };
    return members.map((m) => {
        const stats = m.role === 'tank' ? newDefaults.tank : newDefaults.other;
        return { ...m, stats: { ...stats }, computedValues: calculateMemberValues({ ...m, stats }, level) };
    });
}

/** ジョブ変更計算で参照する store の最小スライス。 */
type PartyComputeSlice = Pick<MitigationState, 'partyMembers' | 'timelineMitigations' | 'timelineEvents' | 'currentLevel'>;

/** setMemberJob のソロ計算。ジョブ変更 + 当該メンバーの mitigations フィルタ/移行/学者・占星の自動挿入。 */
function computeSetMemberJob(
    state: PartyComputeSlice,
    memberId: string,
    jobId: string | null,
): { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] } {
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
            const computedValues = calculateMemberValues(updatedMember, state.currentLevel);
            return { ...updatedMember, computedValues };
        }
        return m;
    });

    const filteredMitigations = state.timelineMitigations.reduce<AppliedMitigation[]>((acc, mit) => {
        if (mit.ownerId !== memberId) { acc.push(mit); return acc; }
        const def = getMitigationsFromStore().find(m => m.id === mit.mitigationId);
        if (def?.jobId === jobId) { acc.push(mit); return acc; }
        if (def && def.jobId !== jobId) {
            const baseId = def.id.replace(`_${def.jobId}`, '');
            const newId = `${baseId}_${jobId}`;
            const newDef = getMitigationsFromStore().find(m => m.id === newId);
            if (newDef && newDef.jobId === jobId) { acc.push({ ...mit, mitigationId: newId }); return acc; }
        }
        return acc;
    }, []);

    if (jobId === 'sch' && !hasAnyAetherflow(memberId, filteredMitigations)) {
        filteredMitigations.push(...buildScholarAutoInserts(memberId, filteredMitigations, state.timelineEvents));
    }
    if (jobId === 'ast' && !hasAnyAstrologianDraw(memberId, filteredMitigations)) {
        filteredMitigations.push(...buildAstrologianAutoInserts(memberId, filteredMitigations, state.timelineEvents));
    }
    return { partyMembers: newMembers, timelineMitigations: filteredMitigations };
}

/** 1 メンバーのジョブ変更結果から batch ops を作る(partyMembers upsert + そのメンバーの mitigations 入替)。 */
function memberJobBatchOps(
    prevMitigations: AppliedMitigation[],
    memberId: string,
    next: { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] },
): BatchOp[] {
    const changedMember = next.partyMembers.find(m => m.id === memberId);
    const oldIds = prevMitigations.filter(m => m.ownerId === memberId).map(m => m.id);
    const newMits = next.timelineMitigations.filter(m => m.ownerId === memberId);
    return [
        { kind: 'upsert', key: 'partyMembers', items: changedMember ? [changedMember] : [] },
        { kind: 'remove', key: 'timelineMitigations', ids: oldIds },
        { kind: 'upsert', key: 'timelineMitigations', items: newMits },
    ];
}

/** changeMemberJobWithMitigations のソロ計算。ジョブ変更 + 引数 mitigations で上書き + 学者/占星補完。 */
function computeChangeMemberJobWithMitigations(
    state: PartyComputeSlice,
    memberId: string,
    jobId: string,
    mitis: AppliedMitigation[],
): { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] } {
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

    const otherMitigations = state.timelineMitigations.filter(m => m.ownerId !== memberId);
    const finalMitis = [...mitis];
    if (jobId === 'sch') {
        const ownedMitis = finalMitis.map(m => ({ ...m, ownerId: memberId }));
        if (!hasAnyAetherflow(memberId, ownedMitis)) {
            finalMitis.push(...buildScholarAutoInserts(memberId, ownedMitis, state.timelineEvents));
        }
    }
    if (jobId === 'ast') {
        const ownedMitis = finalMitis.map(m => ({ ...m, ownerId: memberId }));
        if (!hasAnyAstrologianDraw(memberId, ownedMitis)) {
            finalMitis.push(...buildAstrologianAutoInserts(memberId, ownedMitis, state.timelineEvents));
        }
    }
    return { partyMembers: newMembers, timelineMitigations: [...otherMitigations, ...finalMitis] };
}

/** updatePartyBulk のソロ計算。複数メンバーのジョブ/mitigations を一括反映(履歴 1 回相当)。 */
function computeUpdatePartyBulk(
    state: PartyComputeSlice,
    updates: { memberId: string; jobId: string | null; mitigations?: AppliedMitigation[] }[],
): { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] } {
    let currentMembers = [...state.partyMembers];
    let currentMitigations = [...state.timelineMitigations];

    updates.forEach(({ memberId, jobId, mitigations }) => {
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

        if (mitigations) {
            currentMitigations = currentMitigations.filter(mit => mit.ownerId !== memberId);
            currentMitigations = [...currentMitigations, ...mitigations];
        } else {
            const originalMember = state.partyMembers.find(m => m.id === memberId);
            if (originalMember && originalMember.jobId !== jobId) {
                currentMitigations = currentMitigations.reduce<AppliedMitigation[]>((acc, mit) => {
                    if (mit.ownerId !== memberId) { acc.push(mit); return acc; }
                    const def = getMitigationsFromStore().find(m => m.id === mit.mitigationId);
                    if (def?.jobId === jobId) { acc.push(mit); return acc; }
                    if (def && def.jobId !== jobId) {
                        const baseId = def.id.replace(`_${def.jobId}`, '');
                        const newId = `${baseId}_${jobId}`;
                        const newDef = getMitigationsFromStore().find(m => m.id === newId);
                        if (newDef && newDef.jobId === jobId) { acc.push({ ...mit, mitigationId: newId }); return acc; }
                    }
                    return acc;
                }, []);
            }
        }

        if (jobId === 'sch' && !hasAnyAetherflow(memberId, currentMitigations)) {
            currentMitigations.push(...buildScholarAutoInserts(memberId, currentMitigations, state.timelineEvents));
        }
        if (jobId === 'ast' && !hasAnyAstrologianDraw(memberId, currentMitigations)) {
            currentMitigations.push(...buildAstrologianAutoInserts(memberId, currentMitigations, state.timelineEvents));
        }
    });

    return { partyMembers: currentMembers, timelineMitigations: currentMitigations };
}

/** applyAutoPlan のソロ計算。最終 mitigations(学者/占星補完込み)と warning 更新後 events を返す。 */
function computeApplyAutoPlan(
    state: Pick<MitigationState, 'partyMembers' | 'timelineEvents'>,
    mitigations: AppliedMitigation[],
    warnings: string[],
): { timelineMitigations: AppliedMitigation[]; timelineEvents: TimelineEvent[] } {
    const finalMitigations = [...mitigations];
    for (const member of state.partyMembers) {
        if (member.jobId === 'sch' && !hasAnyAetherflow(member.id, finalMitigations)) {
            finalMitigations.push(...buildScholarAutoInserts(member.id, finalMitigations, state.timelineEvents));
        }
        if (member.jobId === 'ast' && !hasAnyAstrologianDraw(member.id, finalMitigations)) {
            finalMitigations.push(...buildAstrologianAutoInserts(member.id, finalMitigations, state.timelineEvents));
        }
    }
    return {
        timelineMitigations: finalMitigations,
        timelineEvents: state.timelineEvents.map(e => ({ ...e, warning: warnings.includes(e.id) })),
    };
}

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
                lastPlacedMitigationId: null,
                aetherflowChainPrompt: null,
                astrologianDrawChainPrompt: null,
                // メモ機能 (#57)
                memos: [],
                // 進捗トラッキング (#HUD)
                progress: { points: [], cleared: false },
                toolMode: 'idle',
                _history: [],
                _future: [],
                _collabActive: false,
                _collabHandlers: null,
                _collabCanUndo: false,
                _collabCanRedo: false,
                _setCollabUndoRedo: (canUndo, canRedo) => set({ _collabCanUndo: canUndo, _collabCanRedo: canRedo }),
                _collabReadonly: false,
                setCollabReadonly: (v) => set({ _collabReadonly: v }),
                _loadedPlanId: null,
                setLoadedPlanId: (id) => set({ _loadedPlanId: id }),

                // collab 入室時に solo 履歴を持ち込まない(collab 中は CRDT undo が真実)。
                enterCollabMode: (handlers) => set({ _collabActive: true, _collabHandlers: handlers, _history: [], _future: [] }),

                // collab 退出時も _history/_future をクリア。revoke/手動 disconnect 後の Ctrl+Z で
                // 入室前データへ巻き戻り→Firestore 恒久上書きする経路を塞ぐ(canUndo=false 化)。
                exitCollabMode: () => set({ _collabActive: false, _collabHandlers: null, _collabCanUndo: false, _collabCanRedo: false, _history: [], _future: [] }),

                // 遅延チャンク(collabProvider)の observeDeep から呼ばれる。Yjs 側の最新軽減配列を
                // store に反映。盾連鎖(linkedMitigationId/duration)は派生再計算する。
                // pushHistory は呼ばない(共同編集の反映は undo 履歴に積まない。Undo の CRDT 化は②-c)。
                _applyMitigationsFromCollab: (mitigations) =>
                    set({ timelineMitigations: resolveShieldLinks(mitigations, getMitigationsFromStore()) }),

                // ②-b-1: 各要素の Yjs → store 反映(pushHistory なし)。配列は表示順にソートして反映。
                _applyEventsFromCollab: (events) =>
                    set({ timelineEvents: [...events].sort((a, b) => a.time - b.time) }),
                _applyPhasesFromCollab: (phases) =>
                    set({ phases: [...phases].sort((a, b) => a.startTime - b.startTime) }),
                _applyLabelsFromCollab: (labels) =>
                    set({ labels: [...labels].sort((a, b) => a.startTime - b.startTime) }),
                _applyMemosFromCollab: (memos) => set({ memos }),
                _applyPartyMembersFromCollab: (members) =>
                    set((state) => ({
                        partyMembers: members.map((m) => ({
                            ...m,
                            computedValues: calculateMemberValues(m, state.currentLevel),
                        })),
                    })),
                _applyMetaFromCollab: (meta) =>
                    set((state) => {
                        const patch: Partial<MitigationState> = {};
                        if (meta.aaSettings !== undefined) patch.aaSettings = meta.aaSettings;
                        if (meta.schAetherflowPatterns !== undefined) patch.schAetherflowPatterns = meta.schAetherflowPatterns;
                        if (meta.currentLevel !== undefined) {
                            patch.currentLevel = meta.currentLevel;
                            // computedValues は派生 → ローカル再計算(partyMembers は ②-b-2 で Y 同期済み、ここでは state を読む)。
                            patch.partyMembers = state.partyMembers.map((mem) => ({
                                ...mem,
                                computedValues: calculateMemberValues(mem, meta.currentLevel!),
                            }));
                        }
                        return patch;
                    }),

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
                        memos: state.memos,
                        progress: state.progress,
                    };
                },

                loadSnapshot: (snapshot, planId) => {
                    // 共同編集中は部屋の状態(seed)が唯一の正。別プランの読込で無言 desync させない。
                    if (get()._collabActive) return;
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
                        if (member.jobId === 'ast' && !hasAnyAstrologianDraw(member.id, migratedMitigations)) {
                            const inserts = buildAstrologianAutoInserts(member.id, migratedMitigations, snapshot.timelineEvents);
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
                        // メモ: 未マイグレ既存プランは undefined → [] にフォールバック
                        memos: snapshot.memos ?? [],
                        // 進捗: 未マイグレ既存プランは undefined → デフォルト値にフォールバック
                        progress: normalizeProgress(snapshot.progress),
                        // Reset Undo/Redo on load
                        _history: [],
                        _future: [],
                        // 根治: このスナップショットの持ち主を記録(保存先=loadedPlanId の決定に使う)。
                        ...(planId !== undefined ? { _loadedPlanId: planId } : {}),
                    });

                    // チュートリアル: content:selected はSidebar.tsx側でトランジション完了後に発火する
                    // （loadSnapshot内で即座に発火すると、ローディング中にSTEP2に進んでしまう）
                },

                // Undo: collab 中は CRDT undo へ委譲(set 外・反映は observeDeep の単一 set)。solo は従来のローカル履歴。
                undo: () => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者のみ no-op(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive) { get()._collabHandlers?.undo(); return; } // ②-c: CRDT undo へ委譲。set() を挟まない=入れ子 set による store↔Y.Doc desync を回避
                    set((state) => {
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
                    });
                },

                // Redo: collab 中は CRDT redo へ委譲(set 外)。solo は従来のローカル履歴。
                redo: () => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者のみ no-op
                    if (get()._collabActive) { get()._collabHandlers?.redo(); return; } // ②-c: CRDT redo へ委譲(入れ子 set 回避)
                    set((state) => {
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
                    });
                },

                // Bulk delete: clear mitigations for a specific member
                clearMitigationsByMember: (memberId) => {
                    // ②-b-2: 当該メンバーの mitigations を removeItems で除去。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const ids = get().timelineMitigations.filter(m => m.ownerId === memberId).map(m => m.id);
                        get()._collabHandlers!.removeItems('timelineMitigations', ids);
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        timelineMitigations: state.timelineMitigations.filter(m => m.ownerId !== memberId)
                    }));
                },

                // Bulk delete: clear ALL mitigations
                clearAllMitigations: () => {
                    // ②-b-2: timelineMitigations を全置換([])で原子的にクリア。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.batch([{ kind: 'replace', key: 'timelineMitigations', items: [] }]);
                        return;
                    }
                    pushHistory();
                    set({ timelineMitigations: [] });
                },

                // 👇追加：オートプラン用の一括上書き処理（履歴はここで「1回」だけ保存される）
                applyAutoPlan: ({ mitigations, warnings }) => {
                    // ②-b-2: 最終 mitigations 全置換 + warning 更新後 events を 1 batch で原子的に。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const next = computeApplyAutoPlan(get(), mitigations, warnings);
                        get()._collabHandlers!.batch([
                            { kind: 'replace', key: 'timelineMitigations', items: next.timelineMitigations },
                            { kind: 'upsert', key: 'timelineEvents', items: next.timelineEvents.map(e => ({ id: e.id, warning: e.warning })) },
                        ]);
                        return;
                    }
                    pushHistory();
                    set(state => computeApplyAutoPlan(state, mitigations, warnings));
                },

                setMyMemberId: (memberId) => {
                    set({ myMemberId: memberId });
                    // (チュートリアルイベント削除済み: myjob:set)
                },
                setCurrentLevel: (level) => {
                    const prevState = get();
                    // レベルが変わる場合のみ処理
                    if (prevState.currentLevel === level) return;

                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        // level のみ Y へ。computedValues は _applyMetaFromCollab がローカル再計算する
                        // (partyMembers 配列自体は b-1 で同期しない)。
                        get()._collabHandlers!.setMeta('currentLevel', level);
                        return;
                    }
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
                    // ②-b-2: 全メンバーの stats 一括更新を partyMembers に upsert(mitigations 波及なし)。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('partyMembers', computeDefaultStatsMembers(get().partyMembers, level, patch));
                        return;
                    }
                    pushHistory();
                    set((state) => ({ partyMembers: computeDefaultStatsMembers(state.partyMembers, level, patch) }));
                },
                setMyJobHighlight: (enabled) => set({ myJobHighlight: enabled }),
                setHideEmptyRows: (hide) => set({ hideEmptyRows: hide }),
                setShowRowBorders: (show) => set({ showRowBorders: show }),
                setClipboardEvent: (event) => set({ clipboardEvent: event }),
                setTimelineSortOrder: (order) => set({ timelineSortOrder: order }),

                dismissAetherflowChainPrompt: () => set({ aetherflowChainPrompt: null }),

                confirmAetherflowChain: () => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者のみブロック
                    const state = get();
                    if (!state.aetherflowChainPrompt) return;
                    const { memberId, startTime } = state.aetherflowChainPrompt;
                    if (state._collabActive && state._collabHandlers) {
                        // 共同編集中: 連鎖を計算して Yjs へ委譲(observeDeep→_applyMitigationsFromCollab で反映)。
                        // pushHistory は collab では使わない(CRDT undo が真実)。プロンプト解除はローカル UI 状態。
                        const chain = buildAetherflowChainFrom(memberId, startTime, state.timelineMitigations, state.timelineEvents);
                        state._collabHandlers.upsertItems('timelineMitigations', chain);
                        set({ aetherflowChainPrompt: null });
                        return;
                    }
                    pushHistory();
                    set((s) => {
                        const chain = buildAetherflowChainFrom(memberId, startTime, s.timelineMitigations, s.timelineEvents);
                        return {
                            timelineMitigations: [...s.timelineMitigations, ...chain],
                            aetherflowChainPrompt: null,
                        };
                    });
                },

                dismissAstrologianDrawChainPrompt: () => set({ astrologianDrawChainPrompt: null }),

                confirmAstrologianDrawChain: () => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者のみブロック
                    const state = get();
                    if (!state.astrologianDrawChainPrompt) return;
                    const { memberId, startTime, startKind } = state.astrologianDrawChainPrompt;
                    if (state._collabActive && state._collabHandlers) {
                        const chain = buildAstrologianDrawChainFrom(memberId, startTime, startKind, state.timelineMitigations, state.timelineEvents);
                        state._collabHandlers.upsertItems('timelineMitigations', chain);
                        set({ astrologianDrawChainPrompt: null });
                        return;
                    }
                    pushHistory();
                    set((s) => {
                        const chain = buildAstrologianDrawChainFrom(memberId, startTime, startKind, s.timelineMitigations, s.timelineEvents);
                        return {
                            timelineMitigations: [...s.timelineMitigations, ...chain],
                            astrologianDrawChainPrompt: null,
                        };
                    });
                },

                addEvent: (event) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('timelineEvents', [event]);
                        useTutorialStore.getState().completeEvent('event:saved');
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        timelineEvents: [...state.timelineEvents, event].sort((a, b) => a.time - b.time)
                    }));
                    useTutorialStore.getState().completeEvent('event:saved');
                },

                importTimelineEvents: (events, importPhases, importLabels) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const maxEventTime = events.length > 0
                            ? events.reduce((max, e) => Math.max(max, e.time), 0) : undefined;
                        const finalEvents = [...events].sort((a, b) => a.time - b.time);
                        const finalPhases = importPhases
                            ? ensurePhaseEndTimes(importPhases
                                .filter(p => p.startTimeSec >= 0)
                                .map(p => ({ id: `phase_${p.id}`, name: p.name, startTime: p.startTimeSec })), maxEventTime)
                            : undefined;
                        // importBulk が events/phases/labels 全置換 + mitigations クリアを 1 transaction で行う。
                        get()._collabHandlers!.importBulk(finalEvents, finalPhases, importLabels);
                        if (events.length > 0) useTutorialStore.getState().completeEvent('content:selected');
                        return;
                    }
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
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('timelineEvents', [{ id, ...updatedEvent }]);
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        timelineEvents: state.timelineEvents.map(e => e.id === id ? { ...e, ...updatedEvent } : e).sort((a, b) => a.time - b.time)
                    }));
                },

                removeEvent: (id) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('timelineEvents', [id]);
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        timelineEvents: state.timelineEvents.filter(e => e.id !== id)
                    }));
                },

                addPhase: (startTime, name) => {
                    const exists = get().phases.some(p => p.startTime === startTime);
                    if (exists) return;
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const state = get();
                        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
                        const nextPhase = sorted.find(p => p.startTime > startTime);
                        const containingPhase = sorted.find(p => p.startTime <= startTime && p.endTime >= startTime);
                        let endTime: number;
                        if (nextPhase) endTime = nextPhase.startTime - 1;
                        else if (containingPhase) endTime = containingPhase.endTime;
                        else {
                            const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                            endTime = Math.max(maxEventTime, startTime + 1);
                        }
                        const newPhase: Phase = { id: crypto.randomUUID(), name, startTime, endTime };
                        const clipped = state.phases
                            .filter(p => p.endTime >= startTime && p.startTime < startTime)
                            .map(p => ({ id: p.id, endTime: startTime - 1 }));
                        get()._collabHandlers!.upsertItems('phases', [newPhase, ...clipped]);
                        return;
                    }
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
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('phases', [{ id, name }]);
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        phases: state.phases.map(p => p.id === id ? { ...p, name } : p)
                    }));
                },

                removePhase: (id) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('phases', [id]);
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        phases: state.phases.filter(p => p.id !== id)
                    }));
                },

                updatePhaseEndTime: (id, newEndTime) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const sorted = [...get().phases].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(p => p.id === id);
                        if (idx < 0) return;
                        const self = sorted[idx];
                        const nextPhase = sorted[idx + 1];
                        let final = Math.max(newEndTime, self.startTime + 1);
                        if (nextPhase && final >= nextPhase.startTime) {
                            final = Math.min(final, nextPhase.endTime - 2);
                            get()._collabHandlers!.upsertItems('phases', [
                                { id, endTime: final }, { id: nextPhase.id, startTime: final + 1 },
                            ]);
                        } else {
                            get()._collabHandlers!.upsertItems('phases', [{ id, endTime: final }]);
                        }
                        return;
                    }
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
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const sorted = [...get().phases].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(p => p.id === id);
                        if (idx < 0) return;
                        const self = sorted[idx];
                        const prevPhase = idx > 0 ? sorted[idx - 1] : null;
                        let final = Math.max(newStartTime, 0);
                        final = Math.min(final, self.endTime - 1);
                        if (prevPhase && final <= prevPhase.endTime) {
                            final = Math.max(final, prevPhase.startTime + 2);
                            get()._collabHandlers!.upsertItems('phases', [
                                { id, startTime: final }, { id: prevPhase.id, endTime: final - 1 },
                            ]);
                        } else {
                            get()._collabHandlers!.upsertItems('phases', [{ id, startTime: final }]);
                        }
                        return;
                    }
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
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const state = get();
                        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
                        const nextLabel = sorted.find(l => l.startTime > startTime);
                        const containingLabel = sorted.find(l => l.startTime <= startTime && l.endTime >= startTime);
                        let endTime: number;
                        if (nextLabel) endTime = nextLabel.startTime - 1;
                        else if (containingLabel) endTime = containingLabel.endTime;
                        else {
                            const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                            endTime = Math.max(maxEventTime, startTime + 1);
                        }
                        const newLabel: Label = { id: crypto.randomUUID(), name, startTime, endTime };
                        const clipped = state.labels
                            .filter(l => l.endTime >= startTime && l.startTime < startTime)
                            .map(l => ({ id: l.id, endTime: startTime - 1 }));
                        get()._collabHandlers!.upsertItems('labels', [newLabel, ...clipped]);
                        return;
                    }
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
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('labels', [{ id, name }]);
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        labels: state.labels.map(l => l.id === id ? { ...l, name } : l)
                    }));
                },

                removeLabel: (id) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('labels', [id]);
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        labels: state.labels.filter(l => l.id !== id)
                    }));
                },

                updateLabelEndTime: (id, newEndTime) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const sorted = [...get().labels].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(l => l.id === id);
                        if (idx < 0) return;
                        const self = sorted[idx];
                        const next = sorted[idx + 1];
                        let final = Math.max(newEndTime, self.startTime + 1);
                        if (next && final >= next.startTime) {
                            final = Math.min(final, next.endTime - 2);
                            get()._collabHandlers!.upsertItems('labels', [
                                { id, endTime: final }, { id: next.id, startTime: final + 1 },
                            ]);
                        } else {
                            get()._collabHandlers!.upsertItems('labels', [{ id, endTime: final }]);
                        }
                        return;
                    }
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
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const sorted = [...get().labels].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(l => l.id === id);
                        if (idx < 0) return;
                        const self = sorted[idx];
                        const prev = idx > 0 ? sorted[idx - 1] : null;
                        let final = Math.max(newStartTime, 0);
                        final = Math.min(final, self.endTime - 1);
                        if (prev && final <= prev.endTime) {
                            final = Math.max(final, prev.startTime + 2);
                            get()._collabHandlers!.upsertItems('labels', [
                                { id, startTime: final }, { id: prev.id, endTime: final - 1 },
                            ]);
                        } else {
                            get()._collabHandlers!.upsertItems('labels', [{ id, startTime: final }]);
                        }
                        return;
                    }
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
                    // 競合表示: ユーザーが今置いたインスタンスを記録(自動配置 autoHidden は除外)。
                    // この id は脈動/矢印から除外され「既存の相手だけ光る」を実現する。
                    if (!mitigation.autoHidden) {
                        set({ lastPlacedMitigationId: mitigation.id });
                    }
                    // 共同編集中: Yjs へ委譲(セラフィム cascade 等は handlers 実装側で Y 操作)。
                    // timelineMitigations は handler→observeDeep→_applyMitigationsFromCollab 経由で更新。
                    // プロンプト等の UI 一時状態はローカルに反映(yjs 非依存)。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        if (mitigation.mitigationId === 'aetherflow') {
                            set({ aetherflowChainPrompt: { memberId: mitigation.ownerId, startTime: mitigation.time } });
                        }
                        const isManualDraw = !mitigation.autoHidden &&
                            (mitigation.mitigationId === 'astral_draw' || mitigation.mitigationId === 'umbral_draw');
                        if (isManualDraw) {
                            set({ astrologianDrawChainPrompt: { memberId: mitigation.ownerId, startTime: mitigation.time, startKind: mitigation.mitigationId as 'astral_draw' | 'umbral_draw' } });
                        }
                        get()._collabHandlers!.add(mitigation);
                        useTutorialStore.getState().completeEvent('mitigation:added');
                        return;
                    }
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
                        const aetherflowPromptPatch = mitigation.mitigationId === 'aetherflow'
                            ? { aetherflowChainPrompt: { memberId: mitigation.ownerId, startTime: mitigation.time } }
                            : {};

                        // 手動で astral_draw / umbral_draw を置いたときは「以降 60s 毎に交互配置」確認プロンプトを表示
                        // ただし autoHidden (戦闘前 t=-3 の自動配置) はユーザー操作ではないのでトリガーしない
                        const isManualDraw = !mitigation.autoHidden &&
                            (mitigation.mitigationId === 'astral_draw' || mitigation.mitigationId === 'umbral_draw');
                        const astrologianPromptPatch = isManualDraw
                            ? {
                                astrologianDrawChainPrompt: {
                                    memberId: mitigation.ownerId,
                                    startTime: mitigation.time,
                                    startKind: mitigation.mitigationId as 'astral_draw' | 'umbral_draw',
                                },
                            }
                            : {};

                        return {
                            timelineMitigations: resolveShieldLinks(newMitigations, getMitigationsFromStore()),
                            ...aetherflowPromptPatch,
                            ...astrologianPromptPatch,
                        };
                    });
                    // Tutorial: notify that a mitigation has been added
                    useTutorialStore.getState().completeEvent('mitigation:added');
                },

                removeMitigation: (id) => {
                    // 共同編集中: Yjs へ委譲(requires 依存削除等は handlers 実装側で Y 操作)。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.remove(id);
                        return;
                    }
                    pushHistory();
                    set((state) => {
                        const removed = state.timelineMitigations.find(m => m.id === id);
                        if (!removed) return { timelineMitigations: resolveShieldLinks(state.timelineMitigations.filter(m => m.id !== id), getMitigationsFromStore()) };

                        const removedDef = getMitigationsFromStore().find(d => d.id === removed.mitigationId);
                        if (!removedDef) return { timelineMitigations: resolveShieldLinks(state.timelineMitigations.filter(m => m.id !== id), getMitigationsFromStore()) };

                        // requires チェックは ID 比較のみで Mitigation の値（value/recast 等）を読まないため、
                        // モード解決不要。詳細は spec 参照。
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
                    // 競合表示: ドラッグで動かしたインスタンスを「直前に触った1件」として記録。
                    // これを脈動/矢印から除外することで、移動先で競合した場合も「既存の相手だけ光る」(配置と統一)。
                    set({ lastPlacedMitigationId: id });
                    // 共同編集中: Yjs へ委譲(セラフィム cascade 等は handlers 実装側で Y 操作)。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.updateTime(id, newTime);
                        return;
                    }
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
                    // ②-b-2: ジョブ変更カスケード(メンバー + その mitigations)を 1 batch で原子的に委譲。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const next = computeSetMemberJob(get(), memberId, jobId);
                        get()._collabHandlers!.batch(memberJobBatchOps(get().timelineMitigations, memberId, next));
                        return;
                    }
                    pushHistory();
                    set((state) => computeSetMemberJob(state, memberId, jobId));
                    // Tutorial: detect if 4 or 8 members are set
                    // (チュートリアルイベント削除済み: party:eight-set / party:four-set)
                },

                changeMemberJobWithMitigations: (memberId, jobId, mitis) => {
                    // ②-b-2: ジョブ変更 + その mitigations 上書きを 1 batch で原子的に委譲。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const next = computeChangeMemberJobWithMitigations(get(), memberId, jobId, mitis);
                        get()._collabHandlers!.batch(memberJobBatchOps(get().timelineMitigations, memberId, next));
                        return;
                    }
                    pushHistory();
                    set((state) => computeChangeMemberJobWithMitigations(state, memberId, jobId, mitis));
                },

                updatePartyBulk: (updates) => {
                    // ②-b-2: 複数メンバーのジョブ/mitigations 一括変更を 1 batch で(members upsert + mitigations 全置換)。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const next = computeUpdatePartyBulk(get(), updates);
                        const updatedIds = new Set(updates.map(u => u.memberId));
                        const changedMembers = next.partyMembers.filter(m => updatedIds.has(m.id));
                        get()._collabHandlers!.batch([
                            { kind: 'upsert', key: 'partyMembers', items: changedMembers },
                            { kind: 'replace', key: 'timelineMitigations', items: next.timelineMitigations },
                        ]);
                        return;
                    }
                    pushHistory();
                    set((state) => computeUpdatePartyBulk(state, updates));
                    // (チュートリアルイベント削除済み: party:eight-set / party:four-set)
                },

                updateMemberStats: (memberId, stats) => {
                    // ②-b-2: 1 メンバーの stats 更新を partyMembers に upsert(mitigations 波及なし)。
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const m = get().partyMembers.find((x) => x.id === memberId);
                        if (!m) return;
                        const newStats = { ...m.stats, ...stats };
                        const updated = { ...m, stats: newStats, computedValues: calculateMemberValues({ ...m, stats: newStats }, get().currentLevel) };
                        get()._collabHandlers!.upsertItems('partyMembers', [updated]);
                        return;
                    }
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

                setAaSettings: (settings) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.setMeta('aaSettings', settings);
                        return;
                    }
                    set({ aaSettings: settings });
                },

                // メモ機能 アクション (#57)
                setToolMode: (mode) => set({ toolMode: mode }),

                addMemo: (input) => {
                    if (get()._collabReadonly && !get()._collabActive) return false; // 純粋な閲覧者のみブロック
                    const current = get().memos;
                    if (current.length >= MEMO_LIMITS.MAX_MEMOS_PER_PLAN) return false;
                    const now = Date.now();
                    const memo: PlanMemo = {
                        id: `memo_${crypto.randomUUID()}`,
                        text: input.text,
                        timeSec: input.timeSec,
                        xRatio: input.xRatio,
                        createdAt: now,
                        updatedAt: now,
                    };
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('memos', [memo]);
                        return true;
                    }
                    set({ memos: [...current, memo] });
                    return true;
                },

                updateMemo: (id, patch) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('memos', [{ id, ...patch }]);
                        return;
                    }
                    set((state) => ({
                        memos: state.memos.map(m =>
                            m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m
                        ),
                    }));
                },

                deleteMemo: (id) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('memos', [id]);
                        return;
                    }
                    set((state) => ({
                        memos: state.memos.filter(m => m.id !== id),
                    }));
                },

                deleteAllMemos: () => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('memos', get().memos.map(m => m.id));
                        return;
                    }
                    set({ memos: [] });
                },

                // 進捗トラッキング アクション (#HUD)
                // Plan 1 では collab 委譲を使わず常にローカル set() のみ。collab 委譲は Plan 2 で別途。
                recordReachedPoint: (reachedPos) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({
                        progress: { ...state.progress, points: appendProgressPoint(state.progress.points, { ts: Date.now(), reachedPos }) },
                    }));
                },
                removeProgressPoint: (index) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({
                        progress: { ...state.progress, points: removeProgressPoint(state.progress.points, index) },
                    }));
                },
                setCleared: (cleared) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({ progress: { ...state.progress, cleared } }));
                },
                setActiveDays: (n) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({ progress: { ...state.progress, activeDays: n } }));
                },
                setActiveHours: (n) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({ progress: { ...state.progress, activeHours: n } }));
                },
                setProgressPointNote: (index, note) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => {
                        if (index < 0 || index >= state.progress.points.length) return {} as any;
                        const trimmed = note.trim();
                        const points = state.progress.points.map((p, i) => {
                            if (i !== index) return p;
                            if (!trimmed) { const { note: _omit, ...rest } = p; return rest; }
                            return { ...p, note: trimmed };
                        });
                        return { progress: { ...state.progress, points } };
                    });
                },
                clearAllProgressPoints: () => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({ progress: { ...state.progress, points: [] } }));
                },
                insertProgressPointAt: (index, point) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({ progress: { ...state.progress, points: insertProgressPoint(state.progress.points, index, point) } }));
                },

                setSchAetherflowPattern: (memberId, pattern) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
                    if (get()._collabActive && get()._collabHandlers) {
                        const h = get()._collabHandlers!;
                        // 1. パターン値を planMeta に反映
                        h.setMeta('schAetherflowPatterns', { ...get().schAetherflowPatterns, [memberId]: pattern });
                        // 2. 既存の自動転化(time<=15)を削除し、新パターンの転化を配置(②-a mitigation 経路)
                        get().timelineMitigations
                            .filter(m => m.mitigationId === 'dissipation' && m.ownerId === memberId && m.time <= 15)
                            .forEach(m => h.remove(m.id));
                        h.add({
                            id: crypto.randomUUID(),
                            mitigationId: 'dissipation',
                            ownerId: memberId,
                            time: pattern === 1 ? 1 : 14,
                            duration: 30,
                        });
                        return;
                    }
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
                    // 共同編集中は全消しさせない(チュートリアルは collab ルームでは到達しないが安全側で防ぐ)。
                    if (get()._collabActive) return;
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
                        memos: [],
                        // 進捗トラッキング: リセット時もデフォルト値に戻す
                        progress: { points: [], cleared: false },
                        toolMode: 'idle',
                        _history: [],
                        _future: [],
                        // 根治(I-1): どの表も載っていない状態なので持ち主を断つ。
                        // stale な _loadedPlanId への幽霊保存(ログアウト/全消し後)を防ぐ。
                        _loadedPlanId: null,
                    });
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('tutorial:reset-ui'));
                    }
                },

                restoreFromSnapshot: (snapshot: TutorialSnapshot) => {
                    // ②-b-2: 共同編集中は部屋の seed が唯一の正。チュートリアル復元で無言 desync させない。
                    if (get()._collabActive) return;
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
                    // チュートリアル中 or ⑤-3b ジョイナー読み取り専用中は書き込みスキップ
                    // (壊れたデータ／他人の部屋データを自分の localStorage に永続化しない)。
                    if (useTutorialStore.getState().isActive || useMitigationStore.getState()._collabReadonly) return;
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
                timelineSortOrder: state.timelineSortOrder,
                memos: state.memos,
                progress: state.progress,
            }),
            migrate: (persistedState: any, _version: number) => {
                return persistedState;
            },
            merge: (persisted: any, current: MitigationState) => {
                if (!persisted) return current;
                return {
                    ...current,
                    ...persisted,
                    // 進捗: 旧形式(dailyBest)で永続化された端末を新形式(points)へ正規化（undefined.map クラッシュ防止）
                    progress: normalizeProgress(persisted.progress),
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