import React from 'react';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCollabSessionStore } from '../../store/useCollabSessionStore';
import { reconcileCollabForPlan } from '../../lib/collab/collabLifecycle';

// collab ライフサイクル管制: 「見ているプラン = 接続先」を常に一致させる。
// collab 中に別プランへ移ったら必ず disconnect (exitCollabMode + unobserve) し、
// 切替先プランをローカル再ロードする (collab 中 loadSnapshot は no-op だったので張り直す)。
// ⚠ 配置順が重要: この subscribe は自動保存(usePlanAutoSave)の subscribe より先に登録する。
//   さもないと自動保存の saveSilently が新プランへ旧(collab)データを書き戻してしまう。
//   先に disconnect+再ロードで mitistore を新プランに直してから自動保存が走る。
//   → Layout ではこのフックを usePlanAutoSave より先に呼ぶこと。
export function useCollabLifecycle(): void {
    React.useEffect(() => {
        let prev = usePlanStore.getState().currentPlanId;
        const unsub = usePlanStore.subscribe((state) => {
            const newId = state.currentPlanId;
            if (newId === prev) return;
            prev = newId;
            // 管制本体は collabLifecycle に切り出し済 (回帰テスト collabLifecycle.test.ts)。
            reconcileCollabForPlan(newId);
        });
        // auth 確定でオーナー判定が変わる。ログインが解決した瞬間に現在プランを再評価し、
        // collab-ON の自分のプランならライブ接続を復帰させる (リロード時 auth 未確定対策)。
        // 既に正しく接続済みなら decideCollabAction は 'none' を返すので冪等 (二重接続しない)。
        let prevUid = useAuthStore.getState().user?.uid ?? null;
        const unsubAuth = useAuthStore.subscribe((state) => {
            const uid = state.user?.uid ?? null;
            if (uid === prevUid) return;
            prevUid = uid;
            if (uid) reconcileCollabForPlan(usePlanStore.getState().currentPlanId);
        });
        // ページ離脱時もセッションを切断 (端末メモリ汚染を残さない)。
        const onUnload = () => useCollabSessionStore.getState().session?.disconnect();
        window.addEventListener('beforeunload', onUnload);
        // 初回マウント: 既に collab-ON のプランが開かれていればオーナーは自動接続 (リロード復帰)。
        // この時点で auth 未確定なら上の unsubAuth が確定後に拾う。
        reconcileCollabForPlan(usePlanStore.getState().currentPlanId);
        return () => { unsub(); unsubAuth(); window.removeEventListener('beforeunload', onUnload); };
    }, []);
}
