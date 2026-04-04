import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedPlan, ContentLevel } from '../types';
import type { TemplateData } from '../data/templateLoader';
import type { PlanData } from '../types';
import { useMitigationStore } from './useMitigationStore';
import { planService } from '../lib/planService';
import { PLAN_LIMITS } from '../types/firebase';
import { getContentById } from '../data/contentRegistry';

interface PlanState {
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

    // Actions
    addPlan: (plan: SavedPlan) => void;
    updatePlan: (id: string, data: Partial<SavedPlan>) => void;
    deletePlan: (id: string) => void;
    setCurrentPlanId: (id: string | null) => void;
    getPlan: (id: string) => SavedPlan | undefined;
    createPlanFromTemplate: (contentId: string, templateData: TemplateData, title: string, initialData: PlanData) => SavedPlan;

    // Firestore同期アクション
    markDirty: (planId: string) => void;
    syncToFirestore: (uid: string, displayName: string) => Promise<void>;
    /** Firestoreから最新データを取得してローカルとマージ（PULL操作） */
    pullFromFirestore: (uid: string) => Promise<void>;
    /** ログアウト前にdirtyプランを強制同期（_isSyncingチェックをバイパス） */
    forceSyncAll: (uid: string, displayName: string) => Promise<void>;
    migrateOnLogin: (uid: string, displayName: string) => Promise<void>;
    deleteFromFirestore: (planId: string, uid: string, contentId: string | null) => Promise<void>;
    hasDirtyPlans: () => boolean;
    setPlans: (plans: SavedPlan[]) => void;
    /** プランを複製して直下に挿入。件数制限超過時はnullを返す */
    duplicatePlan: (planId: string) => SavedPlan | null;
}

export const usePlanStore = create<PlanState>()(
    persist(
        (set, get) => ({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,

            // Firestore同期用（persistしない — partialize で除外）
            _dirtyPlanIds: new Set<string>(),
            _deletedPlanIds: new Set<string>(),
            _isSyncing: false,
            _lastSyncAt: 0,
            _saveStatus: 'idle' as const,
            _cloudStatus: 'idle' as const,
            setSaveStatus: (status) => set({ _saveStatus: status }),

            addPlan: (plan) => {
                set((state) => ({
                    plans: [plan, ...state.plans],
                    _dirtyPlanIds: new Set([...state._dirtyPlanIds, plan.id]),
                }));
            },

            updatePlan: (id, data) => {
                set((state) => ({
                    plans: state.plans.map((p) => (p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p)),
                    _dirtyPlanIds: new Set([...state._dirtyPlanIds, id]),
                }));
            },

            deletePlan: (id) => {
                const plan = get().plans.find((p) => p.id === id);
                const wasCurrent = get().currentPlanId === id;
                set((state) => {
                    const newDirty = new Set(state._dirtyPlanIds);
                    newDirty.delete(id);
                    const remaining = state.plans.filter((p) => p.id !== id);
                    return {
                        plans: remaining,
                        // 削除したのが現在のプランなら無選択状態に戻す
                        currentPlanId: wasCurrent ? null : state.currentPlanId,
                        lastActivePlanId: state.lastActivePlanId === id ? null : state.lastActivePlanId,
                        _dirtyPlanIds: newDirty,
                        _deletedPlanIds: plan
                            ? new Set([...state._deletedPlanIds, id])
                            : state._deletedPlanIds,
                    };
                });
                // 削除したのが現在のプランなら、ストアをクリア
                if (wasCurrent) {
                    useMitigationStore.getState().resetForTutorial();
                }
            },

            setCurrentPlanId: (id) => set({
                currentPlanId: id,
                ...(id ? { lastActivePlanId: id } : {})
            }),

            getPlan: (id: string) => get().plans.find((p) => p.id === id),

            createPlanFromTemplate: (contentId, templateData, title, initialData) => {
                const newPlanId = `plan_${Date.now()}`;
                const newPlan: SavedPlan = {
                    id: newPlanId,
                    ownerId: 'local',
                    ownerDisplayName: 'Guest',
                    contentId: contentId,
                    title: title,
                    isPublic: false,
                    copyCount: 0,
                    useCount: 0,
                    data: {
                        ...initialData,
                        timelineEvents: [...templateData.timelineEvents],
                        phases: templateData.phases ? templateData.phases
                            .filter(p => p.startTimeSec >= 0) // 戦闘開始前のフェーズを除外
                            .map((p, i, arr) => {
                            // endTime = 次のフェーズの開始時刻。最後のフェーズはタイムラインの最大時刻
                            const nextStart = arr[i + 1]?.startTimeSec;
                            const maxTime = Math.max(...templateData.timelineEvents.map(e => e.time), 0);
                            return {
                                id: `phase_${p.id}`,
                                name: p.name ? `Phase ${i + 1}\n${p.name}` : `Phase ${i + 1}`,
                                endTime: nextStart !== undefined ? nextStart : maxTime + 10
                            };
                        }) : [],
                    },
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                get().addPlan(newPlan);
                get().setCurrentPlanId(newPlanId);
                return newPlan;
            },

            // Firestore同期メソッド

            /**
             * Firestoreから最新データを取得してローカルとマージ（PULL操作）
             * アプリ復帰時・タブ復帰時に呼ぶ
             */
            pullFromFirestore: async (uid) => {
                const state = get();
                if (state._isSyncing) return;

                set({ _isSyncing: true, _cloudStatus: 'syncing' });
                try {
                    const { merged, changed } = await planService.fetchAndMerge(
                        state.plans,
                        uid,
                    );
                    if (changed) {
                        set({ plans: merged });
                        // 現在開いているプランが更新された場合、MitigationStoreも更新
                        const currentPlanId = get().currentPlanId;
                        if (currentPlanId) {
                            const updatedPlan = merged.find(p => p.id === currentPlanId);
                            if (updatedPlan?.data) {
                                const localPlan = state.plans.find(p => p.id === currentPlanId);
                                // リモートの方が新しい場合のみMitigationStoreを更新
                                if (localPlan && updatedPlan.updatedAt > localPlan.updatedAt) {
                                    useMitigationStore.getState().loadSnapshot(updatedPlan.data);
                                }
                            }
                        }
                    }
                    set({ _isSyncing: false, _cloudStatus: 'synced' });
                } catch (err) {
                    console.error('Firestore PULL エラー:', err);
                    set({ _isSyncing: false, _cloudStatus: 'error' });
                }
            },

            markDirty: (planId) => set((state) => ({
                _dirtyPlanIds: new Set([...state._dirtyPlanIds, planId]),
            })),

            hasDirtyPlans: () => {
                const state = get();
                return state._dirtyPlanIds.size > 0 || state._deletedPlanIds.size > 0;
            },

            setPlans: (plans) => set({ plans }),

            duplicatePlan: (planId) => {
                const state = get();
                const source = state.plans.find(p => p.id === planId);
                if (!source) return null;

                // 件数制限チェック
                const totalPlans = state.plans.length;
                if (totalPlans >= PLAN_LIMITS.MAX_TOTAL_PLANS) return null;

                if (source.contentId) {
                    const contentPlans = state.plans.filter(p => p.contentId === source.contentId);
                    if (contentPlans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) return null;
                }

                // 連番サフィックス生成: "M1S" → "M1S (2)", "M1S (2)" → "M1S (3)"
                const baseTitle = source.title.replace(/\s*\(\d+\)$/, '');
                const existingNumbers = state.plans
                    .filter(p => p.title.startsWith(baseTitle))
                    .map(p => {
                        const match = p.title.match(/\((\d+)\)$/);
                        return match ? parseInt(match[1], 10) : 1;
                    });
                const nextNumber = Math.max(...existingNumbers, 1) + 1;
                const newTitle = `${baseTitle} (${nextNumber})`;

                const newPlan: SavedPlan = {
                    ...structuredClone(source),
                    id: `plan_${Date.now()}`,
                    title: newTitle,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    isPublic: false,
                    copyCount: 0,
                    useCount: 0,
                };

                // ソースプランの直後に挿入
                const sourceIndex = state.plans.findIndex(p => p.id === planId);
                const newPlans = [...state.plans];
                newPlans.splice(sourceIndex + 1, 0, newPlan);

                set({
                    plans: newPlans,
                    _dirtyPlanIds: new Set([...state._dirtyPlanIds, newPlan.id]),
                });
                return newPlan;
            },

            /**
             * dirtyなプランをFirestoreに同期する
             * 3分以上のインターバルを強制（コスト抑制）
             */
            syncToFirestore: async (uid, displayName) => {
                const state = get();
                if (state._isSyncing) return;
                if (state._dirtyPlanIds.size === 0 && state._deletedPlanIds.size === 0) return;

                // 3分クールダウン: 前回の同期から3分以内なら実行しない
                const SYNC_COOLDOWN_MS = 3 * 60 * 1000;
                const now = Date.now();
                if (state._lastSyncAt > 0 && now - state._lastSyncAt < SYNC_COOLDOWN_MS) return;

                // 同期開始時点のdirty/deletedをスナップショット（同期中に追加された分を保持するため）
                const syncingDirtyIds = new Set(state._dirtyPlanIds);
                const syncingDeletedIds = new Set(state._deletedPlanIds);

                set({ _isSyncing: true, _cloudStatus: 'syncing' });

                try {
                    // 削除されたプランの処理
                    for (const planId of syncingDeletedIds) {
                        try {
                            await planService.deletePlan(planId, uid, null);
                        } catch (err) {
                            console.error('Firestore削除エラー:', planId, err);
                        }
                    }

                    // dirtyプランの同期（リモート削除検出付き）
                    const deletedRemotely = await planService.syncDirtyPlans(
                        syncingDirtyIds,
                        state.plans,
                        uid,
                        displayName,
                    );

                    // リモートで削除されたプランをローカルからも削除
                    if (deletedRemotely.length > 0) {
                        for (const planId of deletedRemotely) {
                            get().deletePlan(planId);
                        }
                        const { showToast } = await import('../components/Toast');
                        const i18next = (await import('i18next')).default;
                        showToast(i18next.t('app.plan_deleted_remotely'));
                    }

                    // 同期完了 → 同期した分のみをdirty/deletedから除去（同期中に追加された分は残す）
                    set((current) => {
                        const remainingDirty = new Set(current._dirtyPlanIds);
                        for (const id of syncingDirtyIds) remainingDirty.delete(id);
                        const remainingDeleted = new Set(current._deletedPlanIds);
                        for (const id of syncingDeletedIds) remainingDeleted.delete(id);
                        return {
                            _dirtyPlanIds: remainingDirty,
                            _deletedPlanIds: remainingDeleted,
                            _lastSyncAt: Date.now(),
                            _cloudStatus: 'synced' as const,
                        };
                    });
                } catch (err) {
                    console.error('Firestore同期エラー:', err);
                    set({ _cloudStatus: 'error' });
                } finally {
                    set({ _isSyncing: false });
                }
            },

            /**
             * ログアウト前に全プランを強制同期（_isSyncingチェック・クールダウンをバイパス）
             * 全プランをdirty扱いで確実にFirestoreに保存する
             * 10秒でタイムアウト（ネットワーク障害時にログアウトをブロックしない）
             */
            forceSyncAll: async (uid, displayName) => {
                const FORCE_SYNC_TIMEOUT_MS = 10_000;

                const syncWork = async () => {
                    const state = get();
                    // 削除の処理
                    for (const planId of state._deletedPlanIds) {
                        try {
                            await planService.deletePlan(planId, uid, null);
                        } catch (err) {
                            console.error('Firestore強制削除エラー:', planId, err);
                        }
                    }
                    // dirtyプランのみ同期（盲目的に全プランをpushしない）
                    if (state._dirtyPlanIds.size > 0) {
                        await planService.syncDirtyPlans(
                            state._dirtyPlanIds,
                            state.plans,
                            uid,
                            displayName,
                        );
                    }
                };

                try {
                    await Promise.race([
                        syncWork(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('SYNC_TIMEOUT')), FORCE_SYNC_TIMEOUT_MS)
                        ),
                    ]);
                } catch (err) {
                    if (err instanceof Error && err.message === 'SYNC_TIMEOUT') {
                        console.warn('Firestore強制同期がタイムアウト（10秒）。ログアウトを続行します');
                    } else {
                        console.error('Firestore強制同期エラー:', err);
                    }
                } finally {
                    set({
                        _dirtyPlanIds: new Set<string>(),
                        _deletedPlanIds: new Set<string>(),
                        _lastSyncAt: Date.now(),
                        _isSyncing: false,
                    });
                }
            },

            /**
             * ログイン時: localStorageプランをFirestoreにマイグレーション＋マージ
             * ローカルが新しいプランはFirestoreに書き戻す（端末間同期の要）
             */
            migrateOnLogin: async (uid, displayName) => {
                try {
                    const { merged, dirtyIds } = await planService.migrateLocalPlansToFirestore(
                        get().plans,
                        uid,
                        displayName,
                    );
                    set({
                        plans: merged,
                        // Firestoreに書き戻せなかったプランはdirtyとして残す（次回syncで再試行）
                        _dirtyPlanIds: new Set<string>(dirtyIds),
                        _deletedPlanIds: new Set<string>(),
                        _lastSyncAt: Date.now(),
                    });
                } catch (err) {
                    console.error('マイグレーションエラー:', err);
                }
            },

            /**
             * プラン削除 + Firestore即時反映
             */
            deleteFromFirestore: async (planId, uid, contentId) => {
                // localStorageから即時削除
                get().deletePlan(planId);
                // Firestoreからも削除（バックグラウンド）
                try {
                    await planService.deletePlan(planId, uid, contentId);
                    // 削除成功 → _deletedPlanIdsからも除去
                    set((state) => {
                        const newDeleted = new Set(state._deletedPlanIds);
                        newDeleted.delete(planId);
                        return { _deletedPlanIds: newDeleted };
                    });
                } catch (err) {
                    console.error('Firestore削除エラー:', planId, err);
                    // 失敗しても _deletedPlanIds に残っているので次回の同期で再試行
                }
            },
        }),
        {
            name: 'plan-storage',
            version: 2,
            // Firestore同期用の内部状態はlocalStorageに保存しない
            partialize: (state) => ({
                plans: state.plans,
                currentPlanId: state.currentPlanId,
                lastActivePlanId: state.lastActivePlanId,
            }),
            migrate: (persisted: any, version: number) => {
                if (version < 2) {
                    // v1→v2: levelフィールドをバックフィル
                    // 古いプランはp.levelがなく、data.currentLevelがレベルタブ操作で汚染されるバグがあった
                    const VALID_LEVELS = [70, 80, 90, 100];
                    const state = persisted as { plans?: SavedPlan[] };
                    if (state.plans) {
                        state.plans = state.plans.map(plan => {
                            if (plan.level) return plan;
                            // コンテンツ定義 → data.currentLevel の順でレベルを推定
                            const contentLevel = plan.contentId ? getContentById(plan.contentId)?.level : undefined;
                            const inferred = contentLevel ?? plan.data?.currentLevel;
                            const level = (VALID_LEVELS.includes(Number(inferred)) ? Number(inferred) : 100) as ContentLevel;
                            return { ...plan, level };
                        });
                    }
                }
                return persisted;
            },
        }
    )
);
