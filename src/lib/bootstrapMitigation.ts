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
 *
 * 2026-08-07データ安全監査: 作業ストアが非空でも、「今表示中のデータの持ち主」を示す札
 * (loadedPlanId)が currentPlanId と食い違っているときは復元すべき。マルチタブ+リロードで
 * 別プランのデータに currentPlanId のラベルだけが誤って貼られる desync を検出するため
 * (詳細: docs/superpowers/specs/2026-08-07-collab-reseed-trust-boundary-design.md)。
 * loadedPlanId が null(=まだ一度も確定していない。この修正配信直後の全既存ユーザーの
 * 初回起動が該当)のときは、食い違い扱いにせず今まで通り復元しない(データ・挙動とも無変化)。
 */
export function shouldRestoreMitigationFromPlan(args: {
    currentPlanId: string | null;
    plan: SavedPlan | undefined;
    mitigationSnapshot: PlanData;
    loadedPlanId: string | null;
}): boolean {
    const { currentPlanId, plan, mitigationSnapshot, loadedPlanId } = args;
    if (!currentPlanId || !plan) return false;
    // プランが非空なのに作業ストアが空 = desync → 復元
    if (!isEmptyPlanData(plan.data) && isEmptyPlanData(mitigationSnapshot)) return true;
    // 札が具体的な値を持ち、かつ currentPlanId と食い違う = 誤った持ち主の疑い → 復元
    if (loadedPlanId !== null && loadedPlanId !== currentPlanId) return true;
    return false;
}
