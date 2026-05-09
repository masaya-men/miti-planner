import { usePlanStore } from '../store/usePlanStore';
import type { DeleteProgressEvent } from './shareImportTypes';

const MIN_DELAY_LOCAL_MS = 400;
const MIN_DELAY_SERVER_MS = 600;
const MIN_DELAY_CAPACITY_MS = 400;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function executePlanDeletions(
  planIds: string[],
  uid: string | null,
  contentId: string,
  onProgress: (event: DeleteProgressEvent) => void,
): Promise<void> {
  for (const planId of planIds) {
    onProgress({ planId, stage: 'local_delete', status: 'in_progress' });
    await delay(MIN_DELAY_LOCAL_MS);

    if (uid) {
      try {
        // deleteFromFirestore はローカル削除 + Firestore 削除を内部で行う
        await usePlanStore.getState().deleteFromFirestore(planId, uid, contentId);
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
      usePlanStore.getState().deletePlan(planId);
      onProgress({ planId, stage: 'local_delete', status: 'success' });
      onProgress({ planId, stage: 'server_delete', status: 'skipped' });
    }

    await delay(MIN_DELAY_CAPACITY_MS);
    onProgress({ planId, stage: 'capacity_freed', status: 'success' });
  }
}
