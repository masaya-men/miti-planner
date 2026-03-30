/**
 * Firestoreプラン保存サービス
 *
 * 設計方針（docs/Firebase設計書.md 準拠）:
 * - ルートコレクション方式（plans/{planId} に ownerId フィールド）
 * - 2層保存: localStorage（常時） + Firestore（間引き・ログインユーザーのみ）
 * - 書き込みタイミング: タブ切替 / ページ離脱 / プラン切替 / 3分に1回
 * - dirty flag で変更があった場合のみ書き込み
 * - 未ログインユーザーは Firestore 書き込みゼロ
 */

import {
  doc,
  collection,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS, PLAN_LIMITS } from '../types/firebase';
import type { FirestorePlan, FirestoreUserPlanCounts } from '../types/firebase';
import type { SavedPlan } from '../types';

// ========================================
// 型変換ヘルパー
// ========================================

/** SavedPlan → Firestore書き込み用オブジェクト（新規作成） */
function toFirestoreCreate(
  plan: SavedPlan,
  uid: string,
  displayName: string,
): any {
  // undefinedを全て除去してからFirestoreに送信（Firestoreはundefinedを拒否する）
  const cleaned = JSON.parse(JSON.stringify({
    ownerId: uid,
    ownerDisplayName: displayName,
    title: plan.title || '',
    contentId: plan.contentId ?? '',
    category: plan.category ?? null,
    isPublic: plan.isPublic ?? false,
    shareId: null,
    copyCount: plan.copyCount ?? 0,
    useCount: plan.useCount ?? 0,
    data: plan.data,
    version: 1,
    archivedAt: null,
  }));
  // serverTimestamp()はJSON.stringifyで消えるので後付け
  cleaned.createdAt = serverTimestamp();
  cleaned.updatedAt = serverTimestamp();
  return cleaned;
}

/** SavedPlan → Firestore書き込み用オブジェクト（更新） */
function toFirestoreUpdate(
  plan: SavedPlan,
  currentVersion: number,
) {
  // undefinedを全て除去（Firestoreはundefinedを拒否する）
  const cleaned = JSON.parse(JSON.stringify({
    title: plan.title || '',
    contentId: plan.contentId ?? '',
    category: plan.category ?? null,
    isPublic: plan.isPublic ?? false,
    data: plan.data,
    version: currentVersion + 1,
  }));
  cleaned.updatedAt = serverTimestamp();
  return cleaned;
}

/** Firestoreドキュメント → SavedPlan */
function fromFirestore(docId: string, data: FirestorePlan): SavedPlan {
  return {
    id: docId,
    ownerId: data.ownerId,
    ownerDisplayName: data.ownerDisplayName,
    title: data.title,
    contentId: data.contentId || null,
    category: (data as any).category ?? undefined,
    isPublic: data.isPublic,
    copyCount: data.copyCount,
    useCount: data.useCount,
    data: data.data,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toMillis()
      : Date.now(),
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toMillis()
      : Date.now(),
  };
}

// ========================================
// ユーザープランカウンター
// ========================================

/** カウンタードキュメントを初期化（未作成の場合のみ） */
async function ensurePlanCounts(uid: string): Promise<void> {
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
async function repairPlanCounts(uid: string): Promise<void> {
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

/** プラン上限チェック（クライアント側の事前チェック） */
async function checkPlanLimits(
  uid: string,
  contentId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const ref = doc(db, COLLECTIONS.USER_PLAN_COUNTS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { allowed: true };
  }
  const counts = snap.data() as FirestoreUserPlanCounts;
  if (counts.total >= PLAN_LIMITS.MAX_TOTAL_PLANS) {
    return { allowed: false, reason: 'max_total' };
  }
  if (contentId && (counts.byContent[contentId] ?? 0) >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) {
    return { allowed: false, reason: 'max_per_content' };
  }
  return { allowed: true };
}

// ========================================
// CRUD 操作
// ========================================

/** ユーザーの全プランを取得 */
async function fetchUserPlans(uid: string): Promise<SavedPlan[]> {
  const q = query(
    collection(db, COLLECTIONS.PLANS),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d.id, d.data() as FirestorePlan));
}

/**
 * プランを Firestore に新規作成（バッチ書き込み: プラン + カウンター）
 * planId は SavedPlan.id をそのまま使う（localStorageと一致させるため）
 */
async function createPlan(
  plan: SavedPlan,
  uid: string,
  displayName: string,
): Promise<void> {
  await ensurePlanCounts(uid);

  const contentId = plan.contentId ?? '';
  const limitCheck = await checkPlanLimits(uid, contentId);
  if (!limitCheck.allowed) {
    throw new Error(`PLAN_LIMIT_${limitCheck.reason}`);
  }

  const batch = writeBatch(db);

  // プランドキュメント
  const planRef = doc(db, COLLECTIONS.PLANS, plan.id);
  batch.set(planRef, toFirestoreCreate(plan, uid, displayName));

  // カウンター更新
  const countRef = doc(db, COLLECTIONS.USER_PLAN_COUNTS, uid);
  const countUpdate: Record<string, any> = {
    total: increment(1),
    updatedAt: serverTimestamp(),
  };
  if (contentId) {
    countUpdate[`byContent.${contentId}`] = increment(1);
  }
  batch.update(countRef, countUpdate);

  await batch.commit();
}

/** プランを Firestore で更新（存在しない場合はエラーをthrow → 呼び出し側でcreateにフォールバック） */
async function updatePlan(
  plan: SavedPlan,
  uid: string,
): Promise<void> {
  const planRef = doc(db, COLLECTIONS.PLANS, plan.id);
  // セキュリティルールの制約で、自分のドキュメントしかreadできないため
  // try/catchで読み取りエラーも含めてハンドリング
  try {
    const snap = await getDoc(planRef);
    if (!snap.exists()) {
      throw new Error('NOT_EXISTS');
    }
    const current = snap.data() as FirestorePlan;
    // ownerIdが自分のものか確認
    if (current.ownerId !== uid) {
      throw new Error('NOT_OWNER');
    }
    await setDoc(planRef, toFirestoreUpdate(plan, current.version), { merge: true });
  } catch (err) {
    // getDocのpermission errorや存在しないエラー → createにフォールバック
    throw err;
  }
}

/** プランを Firestore から削除（バッチ: プラン + カウンター） */
async function deletePlan(
  planId: string,
  uid: string,
  contentId: string | null,
): Promise<void> {
  const batch = writeBatch(db);

  // プラン削除
  const planRef = doc(db, COLLECTIONS.PLANS, planId);
  batch.delete(planRef);

  // カウンター減算
  const countRef = doc(db, COLLECTIONS.USER_PLAN_COUNTS, uid);
  const countUpdate: Record<string, any> = {
    total: increment(-1),
    updatedAt: serverTimestamp(),
  };
  if (contentId) {
    countUpdate[`byContent.${contentId}`] = increment(-1);
  }
  batch.update(countRef, countUpdate);

  await batch.commit();
}

// ========================================
// 同期ロジック
// ========================================

/**
 * ログイン時のデータマイグレーション
 * Firestoreを正（信頼できるデータ）として扱う。
 * localにあってFirestoreにないプランは:
 * - ownerId === 'local'（未ログイン時作成）→ アップロード
 * - それ以外 → 別端末で削除されたとみなし除外
 *
 * 両方に存在してローカルが新しい場合はFirestoreに書き戻す（端末間同期の要）
 *
 * @returns { merged, dirtyIds } — マージ済みプラン + Firestoreに書き戻せなかったプランID
 */
async function migrateLocalPlansToFirestore(
  localPlans: SavedPlan[],
  uid: string,
  displayName: string,
): Promise<{ merged: SavedPlan[]; dirtyIds: string[] }> {
  // カウンターを実データから修復（過去の同期失敗で壊れている可能性があるため）
  try {
    await repairPlanCounts(uid);
  } catch (err) {
    console.error('カウンター修復エラー（続行）:', err);
  }

  // Firestoreから既存プランを取得
  const remotePlans = await fetchUserPlans(uid);
  const remoteIds = new Set(remotePlans.map((p) => p.id));
  const remoteMap = new Map(remotePlans.map((p) => [p.id, p]));

  // ローカルにしかないプランを処理
  const localOnly = localPlans.filter((p) => !remoteIds.has(p.id));
  for (const plan of localOnly) {
    // 未ログイン時に作成されたプラン（ownerId === 'local'）のみアップロード
    // それ以外はFirestoreで削除されたとみなしスキップ
    if (plan.ownerId !== 'local') continue;
    try {
      await createPlan(plan, uid, displayName);
    } catch (err) {
      // 上限に達した場合は残りをスキップ
      if (err instanceof Error && err.message.startsWith('PLAN_LIMIT_')) {
        console.warn('プラン上限に達したため、残りのローカルプランのアップロードをスキップ');
        break;
      }
      console.error('プランのアップロードに失敗:', plan.id, err);
    }
  }

  // マージ + ローカルが新しいプランをFirestoreに書き戻し
  const merged: SavedPlan[] = [];
  const dirtyIds: string[] = []; // Firestoreに書き戻せなかったプランID

  for (const local of localPlans) {
    const remote = remoteMap.get(local.id);
    if (remote) {
      if (remote.updatedAt > local.updatedAt) {
        // リモートが新しい → リモートを採用
        merged.push(remote);
      } else if (local.updatedAt > remote.updatedAt) {
        // ローカルが新しい → ローカルを採用 + Firestoreに書き戻し
        merged.push(local);
        try {
          await updatePlan(local, uid);
        } catch {
          // 書き戻し失敗 → dirtyとしてマーク（次回のsyncで再試行）
          dirtyIds.push(local.id);
        }
      } else {
        // 同じ → リモートを採用（Firestoreのバージョン番号を維持）
        merged.push(remote);
      }
    } else if (local.ownerId === 'local') {
      // ローカルのみ & 未ログイン作成 → 残す（アップロード済み）
      merged.push(local);
    }
    // ローカルのみ & ownerId !== 'local' → 削除されたとみなし除外
  }

  // リモートにのみ存在するプランを追加
  const localIds = new Set(localPlans.map((p) => p.id));
  const remoteOnly = remotePlans.filter((p) => !localIds.has(p.id));
  merged.push(...remoteOnly);

  // updatedAt降順でソート
  merged.sort((a, b) => b.updatedAt - a.updatedAt);

  return { merged, dirtyIds };
}

/** プランがFirestoreに存在するか確認 */
async function checkPlanExists(planId: string): Promise<boolean> {
  try {
    const planRef = doc(db, COLLECTIONS.PLANS, planId);
    const snap = await getDoc(planRef);
    return snap.exists();
  } catch {
    // 権限エラー等 → 存在しないとみなす
    return false;
  }
}

/**
 * dirtyなプランをまとめて Firestore に同期
 * Layout.tsx の自動保存から呼ばれる
 * @returns リモートで削除されたプランのID一覧
 */
async function syncDirtyPlans(
  dirtyPlanIds: Set<string>,
  plans: SavedPlan[],
  uid: string,
  displayName: string,
): Promise<string[]> {
  const deletedRemotely: string[] = [];
  if (dirtyPlanIds.size === 0) return deletedRemotely;

  const plansToSync = plans.filter((p) => dirtyPlanIds.has(p.id));

  // 全プランを並列に同期（ログアウト時の速度改善）
  const results = await Promise.allSettled(
    plansToSync.map(async (plan) => {
      if (plan.ownerId === 'local' || plan.ownerId === uid) {
        try {
          await updatePlan(plan, uid);
        } catch {
          // updateが失敗 → 新規作成を試行
          // ただし ownerId が uid（以前存在したプラン）の場合は
          // リモートで削除された可能性をチェック
          if (plan.ownerId === uid) {
            const exists = await checkPlanExists(plan.id);
            if (!exists) {
              deletedRemotely.push(plan.id);
              return;
            }
          }
          await createPlan(plan, uid, displayName);
        }
      }
    }),
  );

  // 失敗したプランのエラーをログ出力（1つの失敗が他に影響しない）
  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error('Firestore同期エラー:', plansToSync[i].id, result.reason);
    }
  }

  return deletedRemotely;
}

// ========================================
// エクスポート
// ========================================

export const planService = {
  fetchUserPlans,
  createPlan,
  updatePlan,
  deletePlan,
  checkPlanLimits,
  checkPlanExists,
  ensurePlanCounts,
  repairPlanCounts,
  migrateLocalPlansToFirestore,
  syncDirtyPlans,
};
