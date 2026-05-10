import { usePlanStore } from '../store/usePlanStore';
import type { DeleteProgressEvent } from './shareImportTypes';

const MIN_DELAY_LOCAL_MS = 400;
const MIN_DELAY_SERVER_MS = 600;
const MIN_DELAY_CAPACITY_MS = 400;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function executePlanDeletions(
  planIds: string[],
  uid: string | null,
  onProgress: (event: DeleteProgressEvent) => void,
): Promise<void> {
  for (const planId of planIds) {
    onProgress({ planId, stage: 'local_delete', status: 'in_progress' });
    await delay(MIN_DELAY_LOCAL_MS);

    const store = usePlanStore.getState();

    if (uid) {
      // per-plan で contentId を解決 (max_total 対応)。 planService.deletePlan は
      // falsy contentId で byContent を更新しないため、 単一引数では drift する。
      const planContentId = store.plans.find(p => p.id === planId)?.contentId ?? null;
      try {
        await store.deleteFromFirestore(planId, uid, planContentId);
        onProgress({ planId, stage: 'local_delete', status: 'success' });
        onProgress({ planId, stage: 'server_delete', status: 'in_progress' });
        await delay(MIN_DELAY_SERVER_MS);
        onProgress({ planId, stage: 'server_delete', status: 'success' });
      } catch (err) {
        onProgress({
          planId,
          stage: 'server_delete',
          status: 'failed',
          error: String(err),
        });
        throw err; // 整理フローを停止 → caller が retry button を出す
      }
    } else {
      store.deletePlan(planId);
      onProgress({ planId, stage: 'local_delete', status: 'success' });
      onProgress({ planId, stage: 'server_delete', status: 'skipped' });
    }

    await delay(MIN_DELAY_CAPACITY_MS);
    onProgress({ planId, stage: 'capacity_freed', status: 'success' });
  }
}
