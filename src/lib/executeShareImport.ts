import { usePlanStore } from '../store/usePlanStore';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { checkPlanLimit } from '../utils/planLimitChecker';
import { buildNewPlan } from './buildShareImportItems';
import { PLAN_LIMITS } from '../types/firebase';
import type {
  ShareImportItem,
  ProgressEvent,
  ImportResult,
  LimitReason,
} from './shareImportTypes';

const MIN_DELAY_CHECK_MS = 400;
const MIN_DELAY_LOCAL_MS = 600;
const MIN_DELAY_SERVER_MS = 800;
/** 上限ヒット時、 該当カードを赤背景に切り替えてから重ねシートを開くまでの待機 (#4) */
const LIMIT_HIT_REVEAL_DELAY_MS = 800;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export interface OnLimitHitParams {
  reason: LimitReason;
  contentId: string | null;
  neededCount: number;
  planId: string | null;
}

export async function executeShareImport(
  plansToImport: ShareImportItem[],
  uid: string | null,
  displayName: string,
  onProgress: (event: ProgressEvent) => void,
  onLimitHit: (params: OnLimitHitParams) => Promise<'resolved' | 'cancelled'>,
): Promise<ImportResult[]> {
  // 1. 総上限事前判定 (#7)
  // existing + import > MAX_TOTAL なら、 1 件ずつヒットさせず最初に 1 度まとめて重ねシートを出す。
  const existingCount = usePlanStore.getState().plans.length;
  const importCount = plansToImport.length;
  if (existingCount + importCount > PLAN_LIMITS.MAX_TOTAL_PLANS) {
    const neededCount = (existingCount + importCount) - PLAN_LIMITS.MAX_TOTAL_PLANS;
    const decision = await onLimitHit({
      reason: 'max_total',
      contentId: null,
      neededCount,
      planId: null,
    });
    if (decision === 'cancelled') {
      // すべて cancelled として返す (個別 stage progress は出さない)
      return plansToImport.map(item => ({
        itemPlanId: item.sourcePlanId ?? item.sourceShareId,
        status: 'cancelled' as const,
      }));
    }
    // resolved → 削除済み state で per_content ループへ進む。
    // 再度総上限が超過していたら次の per_content check で発火するので無限ループにはならない。
  }

  // 2. per_content ループ (既存ロジック + 赤背景シーケンス追加)
  const results: ImportResult[] = [];

  for (const item of plansToImport) {
    const itemPlanId = item.sourcePlanId ?? item.sourceShareId;

    // 1. 上限チェック
    onProgress({ planId: itemPlanId, stage: 'check', status: 'in_progress' });
    await delay(MIN_DELAY_CHECK_MS);

    let limitResult = checkPlanLimit(usePlanStore.getState().plans, item.contentId);
    if (limitResult.exceeded) {
      // #4: 赤背景に切り替え → 800ms wait → 重ねシート起動の連続演出
      useShareImportFlow.getState().setRedFlag(itemPlanId);
      await delay(LIMIT_HIT_REVEAL_DELAY_MS);

      let decision: 'resolved' | 'cancelled';
      try {
        decision = await onLimitHit({
          reason: 'max_per_content',
          contentId: item.contentId,
          neededCount: 1,
          planId: itemPlanId,
        });
      } finally {
        // 解消 / キャンセル / reject いずれの場合も赤フラグは外す (見た目を元に戻す)
        useShareImportFlow.getState().clearRedFlag(itemPlanId);
      }

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
        // NOTE: 'success' event means sync was attempted. If dirty was concurrently
        // cleared elsewhere, this no-ops; the dirty-sync safety net (5 min interval / tab-switch)
        // will pick it up on the next pass.
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
