import type { SavedPlan } from '../types';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';

/**
 * 新規プランを確定し、作業ストアの持ち主として登録して現在プランに切り替える共有処理。
 * Sidebar / NewPlanModal の両作成フローが使う(順序の罠を 1 箇所に閉じ込める)。
 */
export function commitNewPlan(plan: SavedPlan): void {
  usePlanStore.getState().addPlan(plan);
  // 順序が肝: 持ち主ID(_loadedPlanId)を currentPlanId より「先」に確定する。
  // setCurrentPlanId は Layout の plan-switch subscribe(saveSilently)を同期発火させる。
  // 先に持ち主を新規プランへ向けておかないと、その保存が古い _loadedPlanId(直前プラン)へ
  // 新規プランの空データを書き込み、直前プランの軽減/イベントを破壊する(C-1)。
  useMitigationStore.getState().setLoadedPlanId(plan.id);
  usePlanStore.getState().setCurrentPlanId(plan.id);
}
