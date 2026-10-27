import React from 'react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import { shouldRestoreMitigationFromPlan, shouldRelabelLoadedPlanId } from '../../lib/bootstrapMitigation';

// 起動時 desync 復旧 (hydration gate / bootstrapping)。
// currentPlanId は非空プランを指すのに作業ストアが空 = キャッシュ全消し等の desync。
// 真実 (plan.data) を作業ストアへ復元し、空のまま見える/空上書きの引き金になるのを防ぐ。
// localStorage persist は同期復元済みなのでマウント時点で state は揃っている。
export function useBootstrapRestore(isRemoteLoadingRef: React.MutableRefObject<boolean>): void {
    React.useEffect(() => {
        const { currentPlanId, plans } = usePlanStore.getState();
        const plan = plans.find(p => p.id === currentPlanId);
        if (shouldRestoreMitigationFromPlan({
            currentPlanId,
            plan,
            mitigationSnapshot: useMitigationStore.getState().getSnapshot(),
            // データ安全(2026-08-07監査): 札(_loadedPlanId)と currentPlanId の食い違いも
            // ここで検出させる(マルチタブ desync 対策。詳細は bootstrapMitigation.ts 参照)。
            loadedPlanId: useMitigationStore.getState()._loadedPlanId,
        }) && plan?.data) {
            isRemoteLoadingRef.current = true;
            useMitigationStore.getState().loadSnapshot(plan.data, currentPlanId!);
            isRemoteLoadingRef.current = false;
        } else if (currentPlanId) {
            // 通常起動: 作業ストア(persist 復元済)は currentPlanId を表している → 持ち主を記録。
            // これが無いと初回保存で _loadedPlanId=null となり保存がスキップされる。
            // ただし、札が既に別プランを指していて(圧縮等でplan.dataが読めず復元もできない場合)
            // 盲目的に貼り直すと誤った札が「確定」してしまうため、その場合は貼らない(データ安全監査)。
            if (shouldRelabelLoadedPlanId({ currentPlanId, loadedPlanId: useMitigationStore.getState()._loadedPlanId })) {
                useMitigationStore.getState().setLoadedPlanId(currentPlanId);
            }
        }
    }, [isRemoteLoadingRef]);
}
