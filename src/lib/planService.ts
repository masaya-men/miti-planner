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
 * localStorageにあってFirestoreにないプランをアップロードする
 */
async function migrateLocalPlansToFirestore(
  localPlans: SavedPlan[],
  uid: string,
  displayName: string,
): Promise<SavedPlan[]> {
  // Firestoreから既存プランを取得
  const remotePlans = await fetchUserPlans(uid);
  const remoteIds = new Set(remotePlans.map((p) => p.id));

  // ローカルにしかないプランをアップロード
  const localOnly = localPlans.filter((p) => !remoteIds.has(p.id));
  for (const plan of localOnly) {
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

  // リモートにしかないプランもマージ
  const localIds = new Set(localPlans.map((p) => p.id));
  const remoteOnly = remotePlans.filter((p) => !localIds.has(p.id));

  // 両方にあるプランは updatedAt が新しい方を採用
  const merged: SavedPlan[] = [];
  for (const local of localPlans) {
    const remote = remotePlans.find((r) => r.id === local.id);
    if (remote && remote.updatedAt > local.updatedAt) {
      merged.push(remote);
    } else {
      merged.push(local);
    }
  }
  // リモートにのみ存在するプランを追加
  merged.push(...remoteOnly);

  // updatedAt降順でソート
  merged.sort((a, b) => b.updatedAt - a.updatedAt);

  return merged;
}

/**
 * dirtyなプランをまとめて Firestore に同期
 * Layout.tsx の自動保存から呼ばれる
 */
async function syncDirtyPlans(
  dirtyPlanIds: Set<string>,
  plans: SavedPlan[],
  uid: string,
  displayName: string,
): Promise<void> {
  if (dirtyPlanIds.size === 0) return;

  const plansToSync = plans.filter((p) => dirtyPlanIds.has(p.id));

  for (const plan of plansToSync) {
    try {
      if (plan.ownerId === 'local' || plan.ownerId === uid) {
        // ownerId=localはまだFirestoreに保存されていない新規プラン
        // ownerId=uidは既存プランだが、更新か新規かをtry/catchで判定
        try {
          await updatePlan(plan, uid);
        } catch {
          // updateが失敗（ドキュメント未作成など）→ 新規作成
          await createPlan(plan, uid, displayName);
        }
      }
    } catch (err) {
      console.error('Firestore同期エラー:', plan.id, err);
    }
  }
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
  ensurePlanCounts,
  migrateLocalPlansToFirestore,
  syncDirtyPlans,
};
