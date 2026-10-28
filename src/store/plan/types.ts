import type { StoreApi } from 'zustand';
import type { SavedPlan, PlanData } from '../../types';
import type { TemplateData } from '../../types/template';

export interface PlanState {
    plans: SavedPlan[];
    currentPlanId: string | null;
    lastActivePlanId: string | null;

    // Firestore同期用の状態（localStorageには保存しない）
    _dirtyPlanIds: Set<string>;
    _deletedPlanIds: Set<string>;
    _isSyncing: boolean;
    _lastSyncAt: number;

    // 保存インジケーター用（UIに実際の保存状態を反映）
    _saveStatus: 'idle' | 'saving' | 'saved';
    _cloudStatus: 'idle' | 'syncing' | 'synced' | 'error';
    setSaveStatus: (status: 'idle' | 'saving' | 'saved') => void;

    /** ログイン時のmigrateOnLoginが完了したかどうか */
    _migrationDone: boolean;

    // Actions
    addPlan: (plan: SavedPlan) => void;
    updatePlan: (id: string, data: Partial<SavedPlan>) => void;
    deletePlan: (id: string) => void;
    setCurrentPlanId: (id: string | null) => void;
    getPlan: (id: string) => SavedPlan | undefined;
    createPlanFromTemplate: (contentId: string, templateData: TemplateData, title: string, initialData: PlanData) => SavedPlan;

    // Firestore同期アクション
    markDirty: (planId: string) => void;
    syncToFirestore: (uid: string, displayName: string, force?: boolean, onlyPlanIds?: string[]) => Promise<void>;
    /** Firestoreから最新データを取得してローカルとマージ（PULL操作）。
     *  true = 取り直しの間に手元で編集があり、画面を読み直さずに残した(呼び出し側で保存し直す) */
    pullFromFirestore: (uid: string) => Promise<boolean>;
    /** ログアウト前にdirtyプランを強制同期（_isSyncingチェックをバイパス） */
    forceSyncAll: (uid: string, displayName: string) => Promise<void>;
    /** true = 取り込みの間に手元で編集があり残した(呼び出し側は画面を読み直さない) */
    migrateOnLogin: (uid: string, displayName: string) => Promise<boolean>;
    /**
     * B-1 Revision 3: ローカルプラン (`ownerId='local'`) の ID 配列を返す。
     * Firestore への書き込みはここでは行わない（取り込み実行は `executeLocalImport`）。
     */
    getLocalPlanIds: () => string[];
    /**
     * B-1 Revision 3: 指定された ownerId='local' プランを 1 件ずつ Firestore に作成。
     * 進捗は `onProgress` コールバックで通知。各プランの結果を配列で返す。
     * 成功したプランは state 内で `ownerId` を `uid` に書き換える。
     * 失敗したプランは `ownerId='local'` のまま残るので、ユーザーが再試行可能。
     */
    executeLocalImport: (
        uid: string,
        displayName: string,
        planIds: string[],
        onProgress?: (event: { id: string; status: 'uploading' | 'success' | 'failed'; error?: string }) => void,
    ) => Promise<{ id: string; status: 'success' | 'failed'; error?: string }[]>;
    deleteFromFirestore: (planId: string, uid: string, contentId: string | null) => Promise<void>;
    /** 手動同期ボタン用: クールダウン無視で即座にPUSH + PULL */
    manualSync: (uid: string, displayName: string) => Promise<void>;
    hasDirtyPlans: () => boolean;
    setPlans: (plans: SavedPlan[]) => void;
    /** プランを複製して直下に挿入。最新テンプレートのイベントを使用。件数制限超過時はnullを返す */
    duplicatePlan: (planId: string) => Promise<SavedPlan | null>;
    /** 指定プランをアーカイブ（圧縮含む） */
    archivePlan: (id: string) => Promise<void>;
    /** 複数プランを一括アーカイブ */
    archivePlans: (ids: string[]) => Promise<void>;
    /** アーカイブプランのデータを解凍して返す（プラン自体は変更しない） */
    decompressArchivedPlan: (id: string) => Promise<PlanData | null>;
    /** archived && data が展開されているプランを検知して再圧縮 */
    recompressStaleArchives: () => Promise<void>;
    /** 7日以上開かれていない非アーカイブプランをサイレント圧縮（archivedフラグは変更しない） */
    silentCompressStale: () => Promise<void>;
}

export type PlanSliceContext = {
    set: StoreApi<PlanState>['setState'];
    get: () => PlanState;
};
