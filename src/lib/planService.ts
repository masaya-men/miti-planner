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
  getDocsFromServer,
  getDocFromServer,
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

/** ユーザーの全プランを取得（サーバー優先、オフライン時のみキャッシュ） */
async function fetchUserPlans(uid: string): Promise<SavedPlan[]> {
  const q = query(
    collection(db, COLLECTIONS.PLANS),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc'),
  );
  let snap;
  try {
    snap = await getDocsFromServer(q);
  } catch {
    // オフライン時はキャッシュにフォールバック
    snap = await getDocs(q);
  }
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
): Promise<'updated' | 'skipped_newer_remote'> {
  const planRef = doc(db, COLLECTIONS.PLANS, plan.id);
  // サーバーから直接読み取り（キャッシュの古いデータで削除済みドキュメントを誤検出しないため）
  try {
    let snap;
    try {
      snap = await getDocFromServer(planRef);
    } catch {
      // オフライン時はキャッシュにフォールバック
      snap = await getDoc(planRef);
    }
    if (!snap.exists()) {
      throw new Error('NOT_EXISTS');
    }
    const current = snap.data() as FirestorePlan;
    // ownerIdが自分のものか確認
    if (current.ownerId !== uid) {
      throw new Error('NOT_OWNER');
    }
    // タイムスタンプ比較: リモートがローカルより新しければスキップ
    const remoteUpdatedAt = current.updatedAt instanceof Timestamp
      ? current.updatedAt.toMillis()
      : 0;
    if (remoteUpdatedAt > plan.updatedAt) {
      return 'skipped_newer_remote';
    }
    await setDoc(planRef, toFirestoreUpdate(plan, current.version), { merge: true });
    return 'updated';
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
 * Firestoreから最新データを取得し、ローカルデータとマージする（PULL操作）
 *
 * マージ戦略（Last Writer Wins）:
 * - 両方に存在: updatedAt が新しい方を採用
 * - リモートのみ: ローカルに追加（他端末で作成されたプラン）
 * - ローカルのみ + ownerId='local': 未アップロード → 残す
 * - ローカルのみ + ownerId=uid: リモートで削除された → ローカルからも除去
 */
async function fetchAndMerge(
  localPlans: SavedPlan[],
  uid: string,
): Promise<{ merged: SavedPlan[]; changed: boolean }> {
  const remotePlans = await fetchUserPlans(uid);
  const remoteMap = new Map(remotePlans.map((p) => [p.id, p]));
  const localMap = new Map(localPlans.map((p) => [p.id, p]));

  const merged: SavedPlan[] = [];
  let changed = false;

  // ローカルプランを処理
  for (const local of localPlans) {
    const remote = remoteMap.get(local.id);
    if (remote) {
      if (remote.updatedAt > local.updatedAt) {
        merged.push(remote);
        changed = true;
      } else {
        merged.push(local);
      }
    } else if (local.ownerId === 'local') {
      merged.push(local);
    } else {
      // リモートで削除された → ローカルからも除去
      changed = true;
    }
  }

  // リモートのみのプラン（他端末で作成）
  for (const remote of remotePlans) {
    if (!localMap.has(remote.id)) {
      merged.push(remote);
      changed = true;
    }
  }

  merged.sort((a, b) => b.updatedAt - a.updatedAt);
  return { merged, changed };
}

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
      console.error('プランのアップロードに失敗:', err);
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
): Promise<{ deletedRemotely: string[]; conflicted: SavedPlan[] }> {
  const deletedRemotely: string[] = [];
  const conflicted: SavedPlan[] = []; // 競合が発生したローカルプラン
  if (dirtyPlanIds.size === 0) return { deletedRemotely, conflicted };

  const plansToSync = plans.filter((p) => dirtyPlanIds.has(p.id));

  // 全プランを並列に同期（ログアウト時の速度改善）
  const results = await Promise.allSettled(
    plansToSync.map(async (plan) => {
      if (plan.ownerId === 'local' || plan.ownerId === uid) {
        try {
          const result = await updatePlan(plan, uid);
          if (result === 'skipped_newer_remote') {
            // 競合: リモートの方が新しい → ローカル版を競合コピーとして保存
            conflicted.push(plan);
            return;
          }
        } catch {
          // ownerId=uid のプランがFirestoreに存在しない → 別端末で削除された
          // ownerId='local' のプランはまだ未アップロードなので削除判定しない
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

  for (const [, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error('Firestore同期エラー:', result.reason);
    }
  }

  return { deletedRemotely, conflicted };
}

// ========================================
// エクスポート
// ========================================

export const planService = {
  fetchUserPlans,
  fetchAndMerge,
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
