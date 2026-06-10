import type { SavedPlan, PlanData } from '../types';
import { useMitigationStore } from '../store/useMitigationStore';
import { decompressPlanData } from '../utils/compression';

/**
 * 指定プランのデータを MitigationStore に読み込む共有ヘルパ。
 * Sidebar のプラン切替と、collab 管制 (Layout) の disconnect 後再ロードが共用する。
 * 圧縮プラン (archived/silent compress) は解凍してから渡す。
 * 解凍済みデータを返すので、呼び出し側 (Sidebar) は必要なら plan に書き戻して再キャッシュできる。
 * 注: collab 中は loadSnapshot 自体が no-op (useMitigationStore:_collabActive ガード)。
 * 管制は disconnect (= exitCollabMode) の後にこれを呼ぶこと。
 */
export async function loadPlanDataIntoStore(plan: SavedPlan): Promise<PlanData | undefined> {
  let data: PlanData | undefined = plan.data;
  if ((!data || Object.keys(data).length === 0) && plan.compressedData) {
    data = await decompressPlanData(plan.compressedData);
  }
  if (data) useMitigationStore.getState().loadSnapshot(data);
  return data;
}
