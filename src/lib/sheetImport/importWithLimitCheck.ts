import type { SheetImportResult } from './buildPlanFromSheets';
import { checkPlanLimit } from '../../utils/planLimitChecker';
import { commitImportedPlan } from './commitImportedPlan';
import { usePlanStore } from '../../store/usePlanStore';
import { useShareImportFlow } from '../../store/useShareImportFlow';

/**
 * スプシ取込を確定する。選択コンテンツが上限のときは共有取込と同じ
 * LimitResolutionSheet（useShareImportFlow.limitContext）を立てて削除完了を待ち、
 * 枠が空いてから確定する。
 *
 * @returns 確定したら true。満杯シートで「やめる」なら false（呼び出し側はモーダルを閉じない）。
 */
export async function importWithLimitCheck(
  result: SheetImportResult,
  contentId: string | null,
  title: string,
): Promise<boolean> {
  const plans = usePlanStore.getState().plans;
  const limit = checkPlanLimit(plans, contentId);

  if (limit.exceeded) {
    // 共有取込ストアを間借りして既存 LimitResolutionSheet を駆動する。
    // setLimitContext は share status を 'limit_hit'→(解消後)'importing' にするだけで
    // 'idle' に戻さないため、ゲート前にアイドルだった場合のみ後始末する
    // (本物の共有取込が進行中なら触らない)。
    const shareWasIdle = useShareImportFlow.getState().status === 'idle';
    const decision = await new Promise<'resolved' | 'cancelled'>((resolve) => {
      useShareImportFlow.getState().setLimitContext({
        reason: limit.reason!,
        contentId: limit.reason === 'max_total' ? null : contentId,
        neededCount: 1,
        planId: null,
        resolve,
      });
    });
    if (shareWasIdle && useShareImportFlow.getState().status !== 'idle') {
      useShareImportFlow.getState().close();
    }
    if (decision === 'cancelled') return false;
    // 'resolved' = LimitResolutionSheet が削除完了済み → 枠が空いた
  }

  commitImportedPlan(result, { contentId, title });
  return true;
}
