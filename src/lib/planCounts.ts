/**
 * ユーザープランカウンターの初期化・修復・上限チェック
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { fetchUserPlans } from './planFetch';
import { COLLECTIONS, PLAN_LIMITS } from '../types/firebase';
import type { FirestoreUserPlanCounts } from '../types/firebase';

// ========================================
// ユーザープランカウンター
// ========================================

/** カウンタードキュメントを初期化（未作成の場合のみ） */
export async function ensurePlanCounts(uid: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.USER_PLAN_COUNTS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      total: 0,
      byContent: {},
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * カウンターをFirestoreの実データから再計算して修復する
 * 過去の同期失敗でカウンターが実態と乖離した場合のリカバリ用
 */
export async function repairPlanCounts(uid: string): Promise<void> {
  const plans = await fetchUserPlans(uid);
  const total = plans.length;
  const byContent: Record<string, number> = {};
  for (const plan of plans) {
    const cid = plan.contentId || '';
    if (cid) {
      byContent[cid] = (byContent[cid] || 0) + 1;
    }
  }
  await ensurePlanCounts(uid);
  const ref = doc(db, COLLECTIONS.USER_PLAN_COUNTS, uid);
  await setDoc(ref, {
    total,
    byContent,
    updatedAt: serverTimestamp(),
  });
}

/**
 * プラン上限チェック（クライアント側の事前チェック）
 *
 * 上限到達時は reason / current / max を返し、UI 側で具体的件数を表示できるようにする。
 * createPlan 内では `PLAN_LIMIT_${reason}|current=${n}|max=${m}` 形式の Error メッセージで
 * 投げるので、`parsePlanLimitError` でパースして表示文言を組み立てる。
 */
export async function checkPlanLimits(
  uid: string,
  contentId: string,
): Promise<
  | { allowed: true }
  | { allowed: false; reason: 'max_total' | 'max_per_content'; current: number; max: number }
> {
  const ref = doc(db, COLLECTIONS.USER_PLAN_COUNTS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { allowed: true };
  }
  const counts = snap.data() as FirestoreUserPlanCounts;
  if (counts.total >= PLAN_LIMITS.MAX_TOTAL_PLANS) {
    return {
      allowed: false,
      reason: 'max_total',
      current: counts.total,
      max: PLAN_LIMITS.MAX_TOTAL_PLANS,
    };
  }
  if (contentId && (counts.byContent[contentId] ?? 0) >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) {
    return {
      allowed: false,
      reason: 'max_per_content',
      current: counts.byContent[contentId] ?? 0,
      max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT,
    };
  }
  return { allowed: true };
}
