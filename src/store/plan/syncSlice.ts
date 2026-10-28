import type { SavedPlan } from '../../types';
import { useMitigationStore } from '../useMitigationStore';
import { planService } from '../../lib/planService';
import { dirtyIdsAfterSync } from '../../lib/dirtyAfterSync';
import { markWorkingStore, workingStoreEditedSince, resolveRemoteLoad } from '../../lib/keepLocalEditsOnRemoteLoad';
import { addConflictCopies } from '../../lib/conflictCopy';
import type { PlanState, PlanSliceContext } from './types';

export const createSyncSlice = ({ set, get }: PlanSliceContext): Pick<
    PlanState,
    | 'pullFromFirestore'
    | 'syncToFirestore'
    | 'forceSyncAll'
    | 'manualSync'
> => ({
    // Firestore同期メソッド

    /**
     * Firestoreから最新データを取得してローカルとマージ（PULL操作）
     * アプリ復帰時・タブ復帰時に呼ぶ
     */
    pullFromFirestore: async (uid) => {
        const state = get();
        if (state._isSyncing) {
            return false;
        }
        // 取り直しの間に手元でした編集を、終わった時に古い内容で上書きしないための印 (2026-10-28 消失)
        const workingMark = markWorkingStore(useMitigationStore.getState());
        let keptLocalEdits = false;

        // PULL 開始時点の状態を捕捉。 PULL 失敗時はここに復元する (= ユーザーが見ていた
        // 「同期済」 等の正しい状態を、 読み取り失敗だけで 'error' に上書きしないため)。
        const prevStatus = state._cloudStatus;

        set({ _isSyncing: true, _cloudStatus: 'syncing' });
        try {
            const { merged, changed } = await planService.fetchAndMerge(
                state.plans,
                uid,
                // 端末側で削除済みと分かっている ID は復活させない (墓標伝播前のちらつき防止)
                state._deletedPlanIds,
            );
            keptLocalEdits = workingStoreEditedSince(workingMark, useMitigationStore.getState());
            if (changed) {
                const r = resolveRemoteLoad({ merged, inputPlans: state.plans, currentPlans: get().plans, currentPlanId: get().currentPlanId, workingMark, working: useMitigationStore.getState() });
                set({ plans: r.plans });
                addConflictCopies(r.conflicts, get().addPlan);
                keptLocalEdits = r.keepWorking;
                const currentPlanId = get().currentPlanId;
                if (currentPlanId) {
                    const updatedPlan = r.plans.find(p => p.id === currentPlanId);
                    if (!updatedPlan) {
                        // 現在のプランがリモートで削除された → 無選択状態に戻す
                        const lastActive = get().lastActivePlanId;
                        set({ currentPlanId: null, lastActivePlanId: lastActive === currentPlanId ? null : lastActive });
                        useMitigationStore.getState().resetForTutorial();
                    } else if (updatedPlan.data && !keptLocalEdits) {
                        const localPlan = state.plans.find(p => p.id === currentPlanId);
                        // リモートの方が新しい場合のみMitigationStoreを更新
                        if (localPlan && updatedPlan.updatedAt > localPlan.updatedAt) {
                            // 根治(I-2): 現在プランを再ロード → 持ち主IDも明示して不変条件を保つ
                            useMitigationStore.getState().loadSnapshot(updatedPlan.data, currentPlanId);
                        }
                    }
                }
            }
            // changed有無に関わらず、currentPlanIdが存在しないプランを指していたらクリア
            const finalPlanId = get().currentPlanId;
            if (finalPlanId && !get().plans.find(p => p.id === finalPlanId)) {
                const lastActive = get().lastActivePlanId;
                set({ currentPlanId: null, lastActivePlanId: lastActive === finalPlanId ? null : lastActive });
                useMitigationStore.getState().resetForTutorial();
            }
            set({ _isSyncing: false, _cloudStatus: 'synced' });
            return keptLocalEdits;
        } catch (err) {
            console.error('Firestore PULL エラー:', err);
            // PULL は読み取り操作 (= ユーザーデータには影響なし) なので、 失敗しても
            // 'error' で警告しない。 直前の状態を復元する。 たとえば PUSH 成功直後
            // ('synced') にバックグラウンド PULL が失敗しても、 'synced' を維持する。
            // これによりログイン後 5 分定期 PULL / タブ切替 PULL が失敗しても、
            // 「リロードしないと treat エラーが消えない」 という UX 違和感が解消される。
            set({
                _isSyncing: false,
                _cloudStatus: prevStatus === 'synced' ? 'synced' : 'idle',
            });
            return workingStoreEditedSince(workingMark, useMitigationStore.getState());
        }
    },

    /**
     * dirtyなプランをFirestoreに同期する
     * 3分以上のインターバルを強制（コスト抑制）
     */
    syncToFirestore: async (uid, displayName, force = false, onlyPlanIds?: string[]) => {
        const state = get();
        if (state._isSyncing) return;
        if (state._dirtyPlanIds.size === 0 && state._deletedPlanIds.size === 0) return;

        // クールダウン判定
        // force=true（タブ切替・ページ離脱）→ 常にスキップ
        // 初回push（前回sync以降に新しい編集がある）→ スキップ
        // それ以外 → 5分クールダウン適用
        if (!force) {
            const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
            const now = Date.now();
            const hasNewEdits = [...state._dirtyPlanIds].some(id => {
                const plan = state.plans.find(p => p.id === id);
                return plan && plan.updatedAt > state._lastSyncAt;
            });
            if (!hasNewEdits && state._lastSyncAt > 0 && now - state._lastSyncAt < SYNC_COOLDOWN_MS) return;
        }

        // 同期開始時点のdirty/deletedをスナップショット（同期中に追加された分を保持するため）
        // onlyPlanIds 指定時: dirty / deleted の両方を交差絞り込み (race-safe)
        let syncingDirtyIds = new Set(state._dirtyPlanIds);
        let syncingDeletedIds = new Set(state._deletedPlanIds);
        if (onlyPlanIds !== undefined) {
            const filterSet = new Set(onlyPlanIds);
            syncingDirtyIds = new Set([...syncingDirtyIds].filter(id => filterSet.has(id)));
            syncingDeletedIds = new Set([...syncingDeletedIds].filter(id => filterSet.has(id)));
        }

        const syncStartedAt = Date.now();
        set({ _isSyncing: true, _cloudStatus: 'syncing' });

        try {
            // 削除されたプランの処理
            const failedDeleteIds = new Set<string>();
            for (const planId of syncingDeletedIds) {
                try {
                    await planService.deletePlan(planId, uid, null);
                } catch (err) {
                    // 権限エラー・NOT_FOUND = Firestoreに存在しない → リトライ不要
                    const msg = err instanceof Error ? err.message : '';
                    if (msg.includes('permissions') || msg.includes('NOT_FOUND')) {
                        // Firestoreに存在しないプランの削除は成功扱い
                    } else {
                        failedDeleteIds.add(planId);
                        console.error('Firestore削除エラー:', err);
                    }
                }
            }

            // dirtyプランの同期（リモート削除検出・競合検出付き）
            const { deletedRemotely, conflicted } = await planService.syncDirtyPlans(
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
                const { showToast } = await import('../../components/toastBus');
                const i18next = (await import('i18next')).default;
                showToast(i18next.t('app.plan_deleted_remotely'));
            }

            // 競合が発生したプランをコピーとして保存
            if (conflicted.length > 0) {
                for (const plan of conflicted) {
                    const copyPlan: SavedPlan = {
                        ...structuredClone(plan),
                        id: `plan_${Date.now()}_conflict`,
                        ownerId: 'local',
                        ownerDisplayName: 'Guest',
                        title: `${plan.title} (競合コピー)`,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        // データ安全(2026-08-08): 競合コピーは独立した新しいプラン。
                        // 元プランが共同編集ルームに繋がっていても、コピー先まで
                        // 同じ部屋の「持ち主」を名乗らせない(reseed信頼境界ガードが
                        // 誤って信頼してしまうため)。
                        activeCollabRoomToken: undefined,
                        collabMaxParticipants: undefined,
                    };
                    get().addPlan(copyPlan);
                }
                const { showToast } = await import('../../components/toastBus');
                const i18next = (await import('i18next')).default;
                showToast(i18next.t('app.plan_conflict_detected'));
            }

            // 同期完了 → 同期した分のみをdirty/deletedから除去（同期中に追加された分は残す）
            set((current) => {
                // 送っている間に同じ表へ来た編集の印は残す (2026-10-28 消失調査)
                const remainingDirty = dirtyIdsAfterSync(current._dirtyPlanIds, syncingDirtyIds, state.plans, current.plans);
                const remainingDeleted = new Set(current._deletedPlanIds);
                // 削除失敗したものはキューに残す（次回リトライ）
                for (const id of syncingDeletedIds) {
                    if (!failedDeleteIds.has(id)) remainingDeleted.delete(id);
                }
                return {
                    _dirtyPlanIds: remainingDirty,
                    _deletedPlanIds: remainingDeleted,
                    // 送り始めた時刻 = 送っている間の編集を次回「新しい編集」と見なして間引かない
                    _lastSyncAt: syncStartedAt,
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
            // 削除の処理（権限エラー = Firestoreに存在しない → スキップ）
            for (const planId of state._deletedPlanIds) {
                try {
                    await planService.deletePlan(planId, uid, null);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : '';
                    if (!msg.includes('permissions') && !msg.includes('NOT_FOUND')) {
                        console.error('Firestore強制削除エラー:', err);
                    }
                }
            }
            // dirtyプランのみ同期（盲目的に全プランをpushしない）
            // ログアウト時なので競合コピーは作らない（次回ログイン時にmigrateOnLoginが処理）
            if (state._dirtyPlanIds.size > 0) {
                await planService.syncDirtyPlans(
                    state._dirtyPlanIds,
                    state.plans,
                    uid,
                    displayName,
                ).catch(err => console.error('Firestore強制同期エラー:', err));
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
     * 手動同期ボタン用: クールダウン無視で即座にPUSH + PULL
     */
    manualSync: async (uid, displayName) => {
        if (get()._isSyncing) return;

        const syncStartedAt = Date.now();
        set({ _isSyncing: true, _cloudStatus: 'syncing' });
        try {
            // PUSH: dirtyプランがあれば送信（最新のstateを使う）
            const pushState = get();
            if (pushState._dirtyPlanIds.size > 0 || pushState._deletedPlanIds.size > 0) {
                for (const planId of pushState._deletedPlanIds) {
                    try {
                        await planService.deletePlan(planId, uid, null);
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : '';
                        if (!msg.includes('permissions') && !msg.includes('NOT_FOUND')) {
                            console.error('手動同期: 削除エラー:', err);
                        }
                    }
                }
                const { deletedRemotely, conflicted } = await planService.syncDirtyPlans(
                    pushState._dirtyPlanIds,
                    pushState.plans,
                    uid,
                    displayName,
                );
                // 競合コピー保存
                if (conflicted.length > 0) {
                    for (const plan of conflicted) {
                        const copyPlan: SavedPlan = {
                            ...structuredClone(plan),
                            id: `plan_${Date.now()}_conflict`,
                            ownerId: 'local',
                            ownerDisplayName: 'Guest',
                            title: `${plan.title} (競合コピー)`,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            // データ安全(2026-08-08): 競合コピーは独立した新しいプラン。
                            // 元プランが共同編集ルームに繋がっていても、コピー先まで
                            // 同じ部屋の「持ち主」を名乗らせない(reseed信頼境界ガードが
                            // 誤って信頼してしまうため)。
                            activeCollabRoomToken: undefined,
                            collabMaxParticipants: undefined,
                        };
                        get().addPlan(copyPlan);
                    }
                    const { showToast } = await import('../../components/toastBus');
                    const i18next = (await import('i18next')).default;
                    showToast(i18next.t('app.plan_conflict_detected'));
                }
                // リモート削除
                for (const planId of deletedRemotely) {
                    get().deletePlan(planId);
                }
                // 送っている間の編集・削除の印は残す (2026-10-28 消失調査)
                set((current) => ({
                    _dirtyPlanIds: dirtyIdsAfterSync(current._dirtyPlanIds, pushState._dirtyPlanIds, pushState.plans, current.plans),
                    _deletedPlanIds: new Set([...current._deletedPlanIds].filter(id => !pushState._deletedPlanIds.has(id))),
                }));
            }

            // PULL: Firestoreから最新を取得
            const currentPlans = get().plans;
            const workingMark = markWorkingStore(useMitigationStore.getState());
            const { merged, changed } = await planService.fetchAndMerge(
                currentPlans,
                uid,
                // PUSH 前に削除済みだった ID も復活させない (墓標が読めるまでの保険)
                pushState._deletedPlanIds,
            );
            // 取り直しの間に手元でした編集は古い内容で上書きしない (2026-10-28 消失)
            if (changed) {
                const r = resolveRemoteLoad({ merged, inputPlans: currentPlans, currentPlans: get().plans, currentPlanId: get().currentPlanId, workingMark, working: useMitigationStore.getState() });
                set({ plans: r.plans });
                addConflictCopies(r.conflicts, get().addPlan);
                const currentPlanId = get().currentPlanId;
                if (currentPlanId) {
                    const updatedPlan = r.plans.find(p => p.id === currentPlanId);
                    if (!updatedPlan) {
                        // 現在のプランがリモートで削除された → 無選択状態に戻す
                        const lastActive = get().lastActivePlanId;
                        set({ currentPlanId: null, lastActivePlanId: lastActive === currentPlanId ? null : lastActive });
                        useMitigationStore.getState().resetForTutorial();
                    } else if (updatedPlan.data && !r.keepWorking) {
                        const localPlan = currentPlans.find(p => p.id === currentPlanId);
                        if (localPlan && updatedPlan.updatedAt > localPlan.updatedAt) {
                            // 根治(I-2): 現在プランを再ロード → 持ち主IDも明示して不変条件を保つ
                            useMitigationStore.getState().loadSnapshot(updatedPlan.data, currentPlanId);
                        }
                    }
                }
            }

            // changed有無に関わらず、currentPlanIdが存在しないプランを指していたらクリア
            const finalPlanId = get().currentPlanId;
            if (finalPlanId && !get().plans.find(p => p.id === finalPlanId)) {
                const lastActive = get().lastActivePlanId;
                set({ currentPlanId: null, lastActivePlanId: lastActive === finalPlanId ? null : lastActive });
                useMitigationStore.getState().resetForTutorial();
            }
            set({ _isSyncing: false, _cloudStatus: 'synced', _lastSyncAt: syncStartedAt });
        } catch (err) {
            console.error('手動同期エラー:', err);
            set({ _isSyncing: false, _cloudStatus: 'error' });
            throw err;
        }
    },
});
