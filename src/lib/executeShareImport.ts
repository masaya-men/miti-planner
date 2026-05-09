import { usePlanStore } from '../store/usePlanStore';
import { checkPlanLimit } from '../utils/planLimitChecker';
import { buildNewPlan } from './buildShareImportItems';
import type { ShareImportItem, ProgressEvent, ImportResult } from './shareImportTypes';

const MIN_DELAY_CHECK_MS = 400;
const MIN_DELAY_LOCAL_MS = 600;
const MIN_DELAY_SERVER_MS = 800;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function executeShareImport(
  plansToImport: ShareImportItem[],
  uid: string | null,
  displayName: string,
  onProgress: (event: ProgressEvent) => void,
  onLimitHit: (params: {
    contentId: string;
    neededCount: number;
    planId: string;
  }) => Promise<'resolved' | 'cancelled'>,
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (const item of plansToImport) {
    const itemPlanId = item.sourcePlanId ?? item.sourceShareId;

    // 1. 上限チェック
    onProgress({ planId: itemPlanId, stage: 'check', status: 'in_progress' });
    await delay(MIN_DELAY_CHECK_MS);

    let limitResult = checkPlanLimit(usePlanStore.getState().plans, item.contentId);
    if (limitResult.exceeded) {
      const decision = await onLimitHit({
        contentId: item.contentId ?? '',
        neededCount: 1,
        planId: itemPlanId,
      });
      if (decision === 'cancelled') {
        onProgress({ planId: itemPlanId, stage: 'check', status: 'cancelled' });
        results.push({ itemPlanId, status: 'cancelled' });
        continue;
      }
      // 'resolved' → 再度上限チェック (最新 plans state で)
      limitResult = checkPlanLimit(usePlanStore.getState().plans, item.contentId);
      if (limitResult.exceeded) {
        onProgress({ planId: itemPlanId, stage: 'check', status: 'failed', error: 'still_exceeded' });
        results.push({ itemPlanId, status: 'failed', error: 'still_exceeded' });
        continue;
      }
    }
    onProgress({ planId: itemPlanId, stage: 'check', status: 'success' });

    // 2. 端末保存 (addPlan は ownerId='local' 正規化ガードあり)
    onProgress({ planId: itemPlanId, stage: 'local', status: 'in_progress' });
    let newPlan;
    try {
      newPlan = buildNewPlan(item);
      usePlanStore.getState().addPlan(newPlan);
      await delay(MIN_DELAY_LOCAL_MS);
      onProgress({ planId: itemPlanId, stage: 'local', status: 'success' });
    } catch (err) {
      await delay(200);
      onProgress({ planId: itemPlanId, stage: 'local', status: 'failed', error: String(err) });
      results.push({ itemPlanId, status: 'failed', error: String(err) });
      continue;
    }

    // 3. サーバー保存 (ログイン中のみ、失敗時は dirty 同期にフォールバック)
    if (uid) {
      onProgress({ planId: itemPlanId, stage: 'server', status: 'in_progress' });
      try {
        // POSITIONAL CALL (Task 3 adaptive): (uid, displayName, force, onlyPlanIds)
        await usePlanStore.getState().syncToFirestore(uid, displayName, true, [newPlan.id]);
        await delay(MIN_DELAY_SERVER_MS);
        onProgress({ planId: itemPlanId, stage: 'server', status: 'success' });
      } catch (err) {
        await delay(400);
        onProgress({ planId: itemPlanId, stage: 'server', status: 'failed', error: String(err) });
        // 失敗しても端末保存済み + dirty 同期が拾うので、success として扱う
      }
    } else {
      onProgress({ planId: itemPlanId, stage: 'server', status: 'skipped' });
    }

    results.push({ itemPlanId, newPlanId: newPlan.id, status: 'success' });
  }

  return results;
}
