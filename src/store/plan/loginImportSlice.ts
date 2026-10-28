import { planService } from '../../lib/planService';
import { useMitigationStore } from '../useMitigationStore';
import { markWorkingStore, workingStoreEditedSince, resolveRemoteLoad } from '../../lib/keepLocalEditsOnRemoteLoad';
import { addConflictCopies } from '../../lib/conflictCopy';
import { takeRecoveredBases } from '../../lib/recoveredPlanBases';
import { getToken } from 'firebase/app-check';
import { ensureAppCheck, auth } from '../../lib/firebase';
import type { PlanState, PlanSliceContext } from './types';

export const createLoginImportSlice = ({ set, get }: PlanSliceContext): Pick<
    PlanState,
    | 'migrateOnLogin'
    | 'getLocalPlanIds'
    | 'executeLocalImport'
    | 'deleteFromFirestore'
> => ({
    /**
     * ログイン時: localStorageプランをFirestoreにマイグレーション＋マージ
     * ローカルが新しいプランはFirestoreに書き戻す（端末間同期の要）
     */
    migrateOnLogin: async (uid) => {
        // 未同期の削除意図を捕捉。migrate に渡して復活を防ぎ、クリアせず保持する
        // (= リロードを跨いだ削除が migrate で復活する旧バグの根治)。
        // 残した削除は後続の sync / 離脱時 forceSync が墓標として書き込む。
        const pendingDeleted = new Set<string>(get()._deletedPlanIds);
        // 並行する syncDirtyPlans 経路を抑制 (二重書き込み + 競合コピー生成防止)
        // - _isSyncing=true で syncToFirestore を即 return させる
        // - _dirtyPlanIds をクリアして、ログアウト中の dirty キューが
        //   migrateLocalPlansToFirestore と同じ ID を再 upload するのを防ぐ
        set({ _isSyncing: true, _dirtyPlanIds: new Set<string>() });
        // 取り込みの間に手元でした編集を、終わった時に古い内容で上書きしないための印 (2026-10-28 消失)
        const startPlans = get().plans;
        const workingMark = markWorkingStore(useMitigationStore.getState());
        const bases = takeRecoveredBases(); // 起動時に書き戻した表の「もと」の版 (レビュー Important 2)
        let keepWorking: boolean | null = null;
        try {
            const { merged, dirtyIds } = await planService.migrateLocalPlansToFirestore(
                startPlans,
                uid,
                pendingDeleted,
            );
            const now = get();
            const r = resolveRemoteLoad({ merged, inputPlans: startPlans, currentPlans: now.plans, currentPlanId: now.currentPlanId, workingMark, working: useMitigationStore.getState(), bases });
            keepWorking = r.keepWorking;
            set({
                plans: r.plans,
                // 書き戻せなかったプラン + 手元の物を残したプランはdirtyとして残す（次回syncで送る）
                _dirtyPlanIds: new Set<string>([...dirtyIds, ...r.keptIds]),
                // 未同期の削除は保持 (墓標未書き込みの削除が復活しないように)。次回 sync で墓標化される。
                _deletedPlanIds: new Set<string>([...pendingDeleted, ...now._deletedPlanIds]),
                _lastSyncAt: Date.now(),
            });
            addConflictCopies(r.conflicts, get().addPlan);
        } catch (err) {
            console.error('マイグレーションエラー:', err);
        } finally {
            set({ _isSyncing: false });
        }
        return keepWorking ?? workingStoreEditedSince(workingMark, useMitigationStore.getState());
    },

    // ダイアログ取り込み候補。 `_createdLoggedIn === true` は自動同期されるので除外。
    // Layout.tsx の localImportPlans / 自動トリガー判定と完全に同じフィルタにする。
    getLocalPlanIds: () => get().plans
        .filter(p => p.ownerId === 'local' && p._createdLoggedIn !== true)
        .map(p => p.id),

    executeLocalImport: async (uid, displayName, planIds, onProgress) => {
        // App Check + Auth トークンを揃えてから書き込む (post-OAuth で未準備な場合に備える)
        // forceRefresh: true で確実に新規トークン取得 (キャッシュが空 / 期限切れでも動く)
        try {
            const appCheck = ensureAppCheck();
            if (appCheck) {
                await getToken(appCheck, true);
            }
            if (auth.currentUser) {
                await auth.currentUser.getIdToken(true);
            }
        } catch {
            // トークン取得失敗でも続行 (createPlan 側で permission-denied として扱う)
        }

        const results: { id: string; status: 'success' | 'failed'; error?: string }[] = [];
        for (const planId of planIds) {
            const plan = get().plans.find(p => p.id === planId);
            if (!plan || plan.ownerId !== 'local') {
                // 既に取り込み済み or 削除済み → スキップ (失敗扱いにしない)
                continue;
            }
            onProgress?.({ id: planId, status: 'uploading' });

            // 防御: data が無いプランは createPlan しても Rules で弾かれる
            // 圧縮済みなら decompress を試みる、それ以外は失敗扱いで次へ
            if (!plan.data || typeof plan.data !== 'object' || Object.keys(plan.data).length === 0) {
                let recovered = false;
                if (plan.compressedData) {
                    try {
                        const decompressed = await get().decompressArchivedPlan(planId);
                        if (decompressed && Object.keys(decompressed).length > 0) {
                            set(state => ({
                                plans: state.plans.map(p =>
                                    p.id === planId ? { ...p, data: decompressed } : p
                                ),
                            }));
                            recovered = true;
                        }
                    } catch {
                        // decompress 失敗 → recovered=false のまま下の分岐で NO_DATA 扱い
                    }
                }
                if (!recovered) {
                    results.push({ id: planId, status: 'failed', error: 'NO_DATA' });
                    onProgress?.({ id: planId, status: 'failed', error: 'NO_DATA' });
                    continue;
                }
            }

            // 最新の plan オブジェクトを取得（decompress で書き換えた可能性に追従）
            const planForUpload = get().plans.find(p => p.id === planId)!;

            // 「既に Firestore に存在する」 場合は createPlan をスキップして成功扱い。
            // 理由: 自動 sync (syncDirtyPlans) が既にこの plan を Firestore に
            // create 済みなのに、 ローカルの ownerId='local' マーカーが消えていない
            // ケースがある (タイミング / persist race)。 そのまま createPlan を呼ぶと
            // Firestore Rules の version 上書き禁止に抵触して permission-denied で
            // 失敗してしまう。 既にあるなら「アップロード完了」 と同じ状態なので
            // ownerId='local' → uid に書き換えるだけで OK。
            try {
                const alreadyExists = await planService.checkPlanExists(planId);
                if (alreadyExists) {
                    set(state => ({
                        plans: state.plans.map(p =>
                            p.id === planId
                                ? { ...p, ownerId: uid, ownerDisplayName: displayName }
                                : p
                        ),
                    }));
                    results.push({ id: planId, status: 'success' });
                    onProgress?.({ id: planId, status: 'success' });
                    continue;
                }
            } catch {
                // checkPlanExists が失敗 (ネットワーク等) → 通常 createPlan に進む
            }

            try {
                await planService.createPlan(planForUpload, uid, displayName);
                // 成功 → state 内の ownerId を 'local' → uid に書き換え
                set(state => ({
                    plans: state.plans.map(p =>
                        p.id === planId
                            ? { ...p, ownerId: uid, ownerDisplayName: displayName }
                            : p
                    ),
                }));
                results.push({ id: planId, status: 'success' });
                onProgress?.({ id: planId, status: 'success' });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                results.push({ id: planId, status: 'failed', error: msg });
                onProgress?.({ id: planId, status: 'failed', error: msg });
            }
        }
        return results;
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
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('permissions') || msg.includes('NOT_FOUND')) {
                // Firestoreに存在しないプラン → キューから除去
                set((state) => {
                    const newDeleted = new Set(state._deletedPlanIds);
                    newDeleted.delete(planId);
                    return { _deletedPlanIds: newDeleted };
                });
            } else {
                console.error('Firestore削除エラー:', err);
                // 失敗しても _deletedPlanIds に残っているので次回の同期で再試行
            }
        }
    },
});
