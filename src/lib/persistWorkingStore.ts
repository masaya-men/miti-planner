import type { PlanData } from '../types';

/**
 * 作業ストア(MitigationStore)の内容を、その「データが属する表」へ保存する。
 *
 * 根治の要点: 保存先を「今 UI が見ている表(currentPlanId)」ではなく
 * 「データの持ち主(loadedPlanId)」で決める。表を素早く切り替えた一瞬に
 * UI の選択とデータがズレても、データは自分の表以外には書き込まれないため、
 * 「切替先(別の表)の軽減を空で上書きして消す」事故が構造的に起きなくなる。
 *
 * 依存(loadedPlanId / getSnapshot / updatePlan)は注入式にして純粋に保ち、
 * ストアの重い初期化なしに単体テストできるようにする。
 */
export interface PersistWorkingStoreDeps {
  /** 手元の作業データが属する表の ID(=最後に作業ストアへ読み込んだ表)。 */
  loadedPlanId: string | null;
  /** 作業ストアの現在の中身を PlanData として取り出す。 */
  getSnapshot: () => PlanData;
  /** 指定 ID の表へ data を保存する(空上書きガード等は updatePlan 側が担う)。 */
  updatePlan: (id: string, patch: { data: PlanData }) => void;
}

export function persistWorkingStore(deps: PersistWorkingStoreDeps): void {
  // 持ち主が未確定(切替の谷間・初期化前)なら保存しない。誤った表への書き込みを防ぐ。
  if (!deps.loadedPlanId) return;
  deps.updatePlan(deps.loadedPlanId, { data: deps.getSnapshot() });
}
