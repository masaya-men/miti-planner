import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedPlan } from '../types';
import type { TemplateData } from '../data/templateLoader';
import type { PlanData } from '../types';
import { useMitigationStore } from './useMitigationStore';
import { planService } from '../lib/planService';

interface PlanState {
    plans: SavedPlan[];
    currentPlanId: string | null;
    lastActivePlanId: string | null;

    // Firestore同期用の状態（localStorageには保存しない）
    _dirtyPlanIds: Set<string>;
    _deletedPlanIds: Set<string>;
    _isSyncing: boolean;
    _lastSyncAt: number;

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
    /** ログアウト前に全プランを強制同期（_isSyncingチェックをバイパス） */
    forceSyncAll: (uid: string, displayName: string) => Promise<void>;
    migrateOnLogin: (uid: string, displayName: string) => Promise<void>;
    deleteFromFirestore: (planId: string, uid: string, contentId: string | null) => Promise<void>;
    hasDirtyPlans: () => boolean;
    setPlans: (plans: SavedPlan[]) => void;
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
                    // 削除したのが現在のプランなら、最新の残りプランに切り替え
                    const nextPlanId = wasCurrent
                        ? (remaining.length > 0 ? remaining.sort((a, b) => b.updatedAt - a.updatedAt)[0].id : null)
                        : state.currentPlanId;
                    return {
                        plans: remaining,
                        currentPlanId: nextPlanId,
                        lastActivePlanId: state.lastActivePlanId === id ? nextPlanId : state.lastActivePlanId,
                        _dirtyPlanIds: newDirty,
                        _deletedPlanIds: plan
                            ? new Set([...state._deletedPlanIds, id])
                            : state._deletedPlanIds,
                    };
                });
                // 削除したのが現在のプランなら、useMitigationStoreのデータも切り替え
                if (wasCurrent) {
                    const nextId = get().currentPlanId;
                    if (nextId) {
                        const nextPlan = get().plans.find((p) => p.id === nextId);
                        if (nextPlan?.data) {
                            useMitigationStore.getState().loadSnapshot(nextPlan.data);
                        }
                    } else {
                        // プランが0件 → ストアをクリア
                        useMitigationStore.getState().resetForTutorial();
                    }
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

            markDirty: (planId) => set((state) => ({
                _dirtyPlanIds: new Set([...state._dirtyPlanIds, planId]),
            })),

            hasDirtyPlans: () => {
                const state = get();
                return state._dirtyPlanIds.size > 0 || state._deletedPlanIds.size > 0;
            },

            setPlans: (plans) => set({ plans }),

            /**
             * dirtyなプランをFirestoreに同期する
             * 3分以上のインターバルを強制（コスト抑制）
             */
            syncToFirestore: async (uid, displayName) => {
                const state = get();
                if (state._isSyncing) return;
                if (state._dirtyPlanIds.size === 0 && state._deletedPlanIds.size === 0) return;

                // 最低3分間隔のチェック（ただしページ離脱時は強制実行するため呼び出し側で制御）
                set({ _isSyncing: true });

                try {
                    // 削除されたプランの処理
                    const deletedIds = new Set(state._deletedPlanIds);
                    for (const planId of deletedIds) {
                        try {
                            // 削除済みプランのcontentIdは不明なので null で処理
                            await planService.deletePlan(planId, uid, null);
                        } catch (err) {
                            console.error('Firestore削除エラー:', planId, err);
                        }
                    }

                    // dirtyプランの同期
                    await planService.syncDirtyPlans(
                        state._dirtyPlanIds,
                        state.plans,
                        uid,
                        displayName,
                    );

                    // 同期完了 → dirty/deletedをクリア
                    set({
                        _dirtyPlanIds: new Set<string>(),
                        _deletedPlanIds: new Set<string>(),
                        _lastSyncAt: Date.now(),
                    });
                } catch (err) {
                    console.error('Firestore同期エラー:', err);
                } finally {
                    set({ _isSyncing: false });
                }
            },

            /**
             * ログアウト前に全プランを強制同期（_isSyncingチェックをバイパス）
             * 全プランをdirty扱いで確実にFirestoreに保存する
             */
            forceSyncAll: async (uid, displayName) => {
                try {
                    const state = get();
                    // 全プランをdirty扱いにする
                    const allPlanIds = new Set(state.plans.map(p => p.id));
                    // 削除の処理
                    for (const planId of state._deletedPlanIds) {
                        try {
                            await planService.deletePlan(planId, uid, null);
                        } catch (err) {
                            console.error('Firestore強制削除エラー:', planId, err);
                        }
                    }
                    // 全プランを同期
                    await planService.syncDirtyPlans(
                        allPlanIds,
                        state.plans,
                        uid,
                        displayName,
                    );
                    set({
                        _dirtyPlanIds: new Set<string>(),
                        _deletedPlanIds: new Set<string>(),
                        _lastSyncAt: Date.now(),
                        _isSyncing: false,
                    });
                } catch (err) {
                    console.error('Firestore強制同期エラー:', err);
                }
            },

            /**
             * ログイン時: localStorageプランをFirestoreにマイグレーション＋マージ
             */
            migrateOnLogin: async (uid, displayName) => {
                try {
                    const merged = await planService.migrateLocalPlansToFirestore(
                        get().plans,
                        uid,
                        displayName,
                    );
                    set({
                        plans: merged,
                        _dirtyPlanIds: new Set<string>(),
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
            version: 1,
            // Firestore同期用の内部状態はlocalStorageに保存しない
            partialize: (state) => ({
                plans: state.plans,
                currentPlanId: state.currentPlanId,
                lastActivePlanId: state.lastActivePlanId,
            }),
        }
    )
);
