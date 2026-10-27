import type { StoreApi } from 'zustand';
import type { Mitigation, PartyMember, PlayerStats, TimelineEvent, Phase, Label, AppliedMitigation, PlanData, LocalizedString, PlanMemo, PlanProgress, ProgressPoint } from '../../types';
import type { CollabHandlers } from '../../lib/collab/collabTypes';
import type { ImportMode } from '../../utils/importModes';

export interface AASettings {
    damage: number;
    type: 'physical' | 'magical' | 'unavoidable';
    target: 'MT' | 'ST';
}

export const MAX_HISTORY = 30;

// 👇 追加：履歴に保存する「スナップショット（その瞬間の写真）」の型定義
export interface HistorySnapshot {
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

export interface MitigationState {
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
    /** スプシ表示の罫線(ふつう表示の showRowBorders とは別に持つ。既定 ON)。 */
    sheetRowBorders: boolean;
    clipboardEvent: TimelineEvent | null;
    timelineSortOrder: 'light_party' | 'role';
    /** 表示/非表示スイッチで非表示にしたパーティメンバーID。見た目だけの絞り込みで、
     *  自動配置・競合チェック・ダメージ計算等の内部処理には一切影響しない
     *  (2026-08-19 ブラウザ全体の見た目設定・プランをまたいで保持・共同編集は同期しない)。 */
    hiddenPartyMemberIds: string[];
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
    /** Bulk-replace/append timeline events (e.g. from FFLogs import). Mode controls mitigation handling. */
    importTimelineEvents: (events: TimelineEvent[], importPhases: { id: number; startTimeSec: number; name: LocalizedString }[] | undefined, importLabels: Label[] | undefined, mode: ImportMode) => void;
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
    setSheetRowBorders: (show: boolean) => void;
    setClipboardEvent: (event: TimelineEvent | null) => void;
    setTimelineSortOrder: (order: 'light_party' | 'role') => void;
    toggleHiddenPartyMember: (id: string) => void;
    /** 全部表示/全部非表示/反転の一括操作用。1件ずつtoggleを繰り返すと再描画も1回ずつ発生するため、
     * 1回のsetで一気に置き換える(2026-08-27)。 */
    setHiddenPartyMemberIds: (ids: string[]) => void;
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
    /** 遅延チャンクの observeDeep から呼ぶ: Yjs 側の最新進捗打点を store に反映(union 結果)。 */
    _applyProgressPointsFromCollab: (points: ProgressPoint[]) => void;
    /** ②-b-2: Yjs 側の最新 partyMembers を store に反映(computedValues は currentLevel からローカル再計算)。 */
    _applyPartyMembersFromCollab: (members: PartyMember[]) => void;
    _applyMetaFromCollab: (meta: { currentLevel?: number; aaSettings?: AASettings; schAetherflowPatterns?: Record<string, 1 | 2>; progressCleared?: boolean; progressActiveDays?: number; progressActiveHours?: number }) => void;

    // メモ機能アクション (#57)
    setToolMode: (mode: 'idle' | 'aa-placement' | 'memo') => void;
    addMemo: (input: { text: string; timeSec: number; xRatio: number }) => boolean;
    updateMemo: (id: string, patch: Partial<Pick<PlanMemo, 'text' | 'timeSec' | 'xRatio'>>) => void;
    deleteMemo: (id: string) => void;
    deleteAllMemos: () => void;

    // 進捗トラッキング アクション (#HUD)
    recordReachedPoint: (reachedPos: number) => void;
    removeProgressPoint: (id: string) => void;
    setCleared: (cleared: boolean) => void;
    setActiveDays: (n: number | undefined) => void;
    setActiveHours: (n: number | undefined) => void;
    setProgressPointNote: (id: string, note: string) => void;
    clearAllProgressPoints: () => void;
    insertProgressPointAt: (index: number, point: ProgressPoint) => void;
}

/** 各スライス(操作のまとまり)が受け取る、本体の set/get と履歴の積み方。 */
export type SliceContext = {
    set: StoreApi<MitigationState>['setState'];
    get: () => MitigationState;
    pushHistory: () => void;
};
