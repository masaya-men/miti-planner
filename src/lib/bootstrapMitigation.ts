import type { PlanData, SavedPlan } from '../types';
import { isEmptyPlanData } from './isEmptyPlanData';

/**
 * 起動時 desync 復旧の判定 (hydration gate / bootstrapping)。
 *
 * 背景: プランのデータは 2 つの localStorage (plan.data と mitigation-storage) に
 * 二重保存されており、片方だけ消える/退避すると desync する。currentPlanId は
 * 非空プランを指すのに作業ストア (MitigationStore) が空 = desync。この状態を放置すると
 * 画面が空のまま見え、さらに空上書きの引き金になる。
 *
 * 真実は plan.data 側 (Firestore 同期される保存データ) なので、作業ストアが空のときだけ
 * plan.data を作業ストアへ復元する。作業ストアが非空のとき (= 通常リロードで最新編集が
 * 残っている) は復元しない (= 最新編集を捨てない)。
 */
export function shouldRestoreMitigationFromPlan(args: {
    currentPlanId: string | null;
    plan: SavedPlan | undefined;
    mitigationSnapshot: PlanData;
}): boolean {
    const { currentPlanId, plan, mitigationSnapshot } = args;
    if (!currentPlanId || !plan) return false;
    // プランが非空なのに作業ストアが空 = desync → 復元
    return !isEmptyPlanData(plan.data) && isEmptyPlanData(mitigationSnapshot);
}
