import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { persistWorkingStore } from '../../lib/persistWorkingStore';
import { markUnsavedWorking, clearUnsavedWorking } from '../../lib/unsavedWorkingMarker';
import { showToast } from '../toastBus';

// 自動保存（2層構造）
// localStorage: 変更検知→500msデバウンス→即時保存（コストゼロ）
// Firestore: イベント駆動（ページ離脱 / タブ非表示 / プラン切替時）+ 5分定期バックアップ
// ⚠ useCollabLifecycle より後に呼ぶこと(subscribe の登録順。理由は useCollabLifecycle.ts 参照)。
export function usePlanAutoSave(isRemoteLoadingRef: React.MutableRefObject<boolean>): void {
    const { t } = useTranslation();
    React.useEffect(() => {
        /** localStorage への保存。
         * 根治: 保存先は「今 UI が見ている表(currentPlanId)」ではなく
         * 「作業ストアが載せている表の持ち主(_loadedPlanId)」。表を素早く切り替えた
         * 一瞬に両者がズレても、データは自分の表以外に書き込まれない(切替先を空で潰さない)。 */
        const saveSilently = () => {
            const mitiStore = useMitigationStore.getState();
            persistWorkingStore({
                loadedPlanId: mitiStore._loadedPlanId,
                getSnapshot: () => mitiStore.getSnapshot(),
                updatePlan: (id, patch) => usePlanStore.getState().updatePlan(id, patch),
            });
            clearUnsavedWorking(mitiStore._loadedPlanId);
        };

        /** Firestoreへの同期（ログイン中 + dirtyがある場合のみ）
         * @param force trueならクールダウン無視（タブ切替・ページ離脱時）
         */
        const syncToCloud = (force = false) => {
            // 共同編集中は Firestore への確定保存を抑制(2クライアントの後勝ち上書き合戦を防ぐ)。
            // localStorage の saveSilently は継続。恒久保存は段取り③で DO が代表実施(設計書 §2-2)。
            if (useMitigationStore.getState()._collabActive) return;
            const authState = useAuthStore.getState();
            const planStore = usePlanStore.getState();
            if (authState.user && planStore.hasDirtyPlans()) {
                const profileName = useAuthStore.getState().profileDisplayName || 'User';
                planStore.syncToFirestore(
                    authState.user.uid,
                    profileName,
                    force,
                ).catch((err) => {
                    console.error('[LoPo] Firestore同期エラー:', err);
                });
            }
        };

        /** Firestoreから最新データを取得（ログイン中のみ）
         *  isRemoteLoadingRefでsubscriptionのdirty markingを抑制
         *  notifyUser=true のときのみトーストを表示（手動 / タブ復帰時のみ） */
        const pullFromCloud = (notifyUser = false) => {
            const authState = useAuthStore.getState();
            if (authState.user) {
                isRemoteLoadingRef.current = true;
                usePlanStore.getState().pullFromFirestore(
                    authState.user.uid,
                ).then((keptLocalEdits) => {
                    if (notifyUser) showToast(t('app.sync_pull_success'), 'info');
                    // 取り直しの間の編集は上の監視が飛ばしている → 残した編集をここで保存し直す (2026-10-28 消失)
                    if (keptLocalEdits) { saveSilently(); syncToCloud(); }
                }).catch((err) => {
                    console.error('[LoPo] Firestore PULL エラー:', err);
                    if (notifyUser) showToast(t('app.sync_pull_error'), 'error');
                }).finally(() => {
                    isRemoteLoadingRef.current = false;
                });
            }
        };

        let localDebounceTimer: ReturnType<typeof setTimeout> | null = null;

        // useMitigationStoreの変更を監視 → localStorageへ500msデバウンス保存
        const unsubMiti = useMitigationStore.subscribe((state, prevState) => {
            // 同じ参照なら何もしない（不要な保存を防止）
            if (state.timelineMitigations === prevState.timelineMitigations
                && state.timelineEvents === prevState.timelineEvents
                && state.phases === prevState.phases
                && state.partyMembers === prevState.partyMembers) return;
            // リモートからの読み込み中は保存・同期をスキップ（dirty循環防止）
            if (isRemoteLoadingRef.current) return;
            // プランが選択されていなければスキップ
            const planIdAtChange = usePlanStore.getState().currentPlanId;
            if (!planIdAtChange) return;
            // 表への保存(0.5 秒後)が走らずに終わっても次の起動で書き戻せるよう、先に印を残す
            markUnsavedWorking(state._loadedPlanId, usePlanStore.getState().plans, state._collabActive);

            // インジケーター: 「保存中...」
            usePlanStore.getState().setSaveStatus('saving');

            // localStorage: 500msデバウンス（ブラウザ内保存なのでコストゼロ）
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            localDebounceTimer = setTimeout(() => {
                // 500ms後にplanIdが変わっていたらプラン切替中だったのでスキップ
                // （旧プランに新データを保存するデータ破損を防止）
                const currentId = usePlanStore.getState().currentPlanId;
                if (currentId !== planIdAtChange) return;
                saveSilently();
                usePlanStore.getState().setSaveStatus('saved');
                // クラウド同期も試行（3分クールダウンで自動的に間引かれる）
                syncToCloud();
            }, 500);
        });

        /** ページ離脱時: localStorage即時保存 + Firestore同期（クールダウン無視）
         *  プラン編集中はブラウザ標準の離脱確認ダイアログを表示 */
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            // プラン編集中なら離脱確認を表示
            if (usePlanStore.getState().currentPlanId) {
                e.preventDefault();
                e.returnValue = '';  // Chrome/Edge互換
            }
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            saveSilently();
            syncToCloud(true);
        };

        /** タブ切替時:
         * 非表示 → localStorage保存 + Firestore PUSH
         * 再表示 → Firestore PULL（他端末の変更を取得）
         */
        const onVisibilityChange = () => {
            if (document.hidden) {
                if (localDebounceTimer) clearTimeout(localDebounceTimer);
                saveSilently();
                syncToCloud(true);  // タブ切替 = ユーザーの意図的操作 → クールダウン無視
                usePlanStore.getState().setSaveStatus('saved');
            } else {
                // タブ再表示 → PULL（他端末の変更を取得）/ ユーザーに通知
                pullFromCloud(true);
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('visibilitychange', onVisibilityChange);

        // プラン切替時: 旧プランをlocalStorage保存 + Firestore同期
        let prevPlanId = usePlanStore.getState().currentPlanId;
        const unsubPlan = usePlanStore.subscribe((state) => {
            const newId = state.currentPlanId;
            const oldId = prevPlanId;
            prevPlanId = newId; // 再入防止: saveSilently→updatePlan→subscribe再発火時にスキップさせる
            if (oldId && oldId !== newId) {
                // collab 中のプラン切替は管制(reconcileCollabForPlan)が disconnect+再ロードを担う。
                // ここで saveSilently すると mitistore の collab 部屋データを新プランへ誤保存し、
                // 管制の再ロードが汚染データを読む競合になる。collab 中は保存をスキップ
                // (collab の恒久保存は DO→Firestore が真実。順序非依存の防御層 = defense-in-depth)。
                if (useMitigationStore.getState()._collabActive) return;
                saveSilently();
                syncToCloud(true);  // プラン切替 = 意図的操作 → クールダウン無視
            }
        });

        // 5分ごとの定期同期（PUSH + PULL）
        const periodicSyncInterval = setInterval(() => {
            // PULLの前にローカル編集をflush（未保存の編集が上書きされるのを防止）
            saveSilently();
            syncToCloud();
            pullFromCloud();
        }, 5 * 60 * 1000);

        return () => {
            unsubMiti();
            unsubPlan();
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            clearInterval(periodicSyncInterval);
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [isRemoteLoadingRef, t]);
}
