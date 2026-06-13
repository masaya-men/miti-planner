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
import { mergePlans } from './mergePlans';
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

/** Firestoreドキュメント → SavedPlan (マッピングをテストするため export) */
export function fromFirestore(docId: string, data: FirestorePlan): SavedPlan {
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
    // 墓標フラグ (true のときのみ持たせる。live プランには付けない)
    ...(data.deleted === true ? { deleted: true as const } : {}),
    // 共同編集 ON のルームトークン (ある時のみ。ON/OFF バッジ・自動接続の判定に使う)
    ...(data.activeCollabRoomToken ? { activeCollabRoomToken: data.activeCollabRoomToken } : {}),
    // #6: 部屋の現在の入れる人数 (ある時のみ。リロード/再接続後に既定 8 でなく実値を出す)
    ...(typeof data.collabMaxParticipants === 'number' ? { collabMaxParticipants: data.collabMaxParticipants } : {}),
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

/**
 * プラン上限チェック（クライアント側の事前チェック）
 *
 * 上限到達時は reason / current / max を返し、UI 側で具体的件数を表示できるようにする。
 * createPlan 内では `PLAN_LIMIT_${reason}|current=${n}|max=${m}` 形式の Error メッセージで
 * 投げるので、`parsePlanLimitError` でパースして表示文言を組み立てる。
 */
async function checkPlanLimits(
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

// ========================================
// CRUD 操作
// ========================================

/**
 * ユーザーの全プラン doc を取得 (live + 墓標)。マージ用の低レベル取得。
 * - live: deleted でないプラン (表示・カウント対象)
 * - tombstoneIds: deleted:true のプラン ID (= 削除済みの明示シグナル)
 *
 * 注意: クエリ自体は ownerId==uid の単一 where + updatedAt orderBy のまま
 * (= 既存の複合インデックスで動く)。墓標の除外はクライアント側で行うので
 * 新しい複合インデックスは不要。
 */
async function fetchPlansAndTombstones(
  uid: string,
): Promise<{ live: SavedPlan[]; tombstoneIds: Set<string> }> {
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
  const all = snap.docs.map((d) => fromFirestore(d.id, d.data() as FirestorePlan));
  const live: SavedPlan[] = [];
  const tombstoneIds = new Set<string>();
  for (const p of all) {
    if (p.deleted) tombstoneIds.add(p.id);
    else live.push(p);
  }
  return { live, tombstoneIds };
}

/** ユーザーの live プランを取得（墓標は除外。サーバー優先、オフライン時のみキャッシュ） */
async function fetchUserPlans(uid: string): Promise<SavedPlan[]> {
  const { live } = await fetchPlansAndTombstones(uid);
  return live;
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
    // 件数情報をパイプ区切りで埋め込む。UI 側で parsePlanLimitError で抽出する
    throw new Error(
      `PLAN_LIMIT_${limitCheck.reason}|current=${limitCheck.current}|max=${limitCheck.max}`
    );
  }

  // プラン本体は単体 setDoc、 counter は別バッチで更新。
  // counter 更新が失敗してもプラン本体は既に書き込み済みなので throw しない (repairPlanCounts でリカバリ)。
  const planRef = doc(db, COLLECTIONS.PLANS, plan.id);
  const planData = toFirestoreCreate(plan, uid, displayName);
  await setDoc(planRef, planData);

  const countRef = doc(db, COLLECTIONS.USER_PLAN_COUNTS, uid);
  const countUpdate: Record<string, any> = {
    total: increment(1),
    updatedAt: serverTimestamp(),
  };
  if (contentId) {
    countUpdate[`byContent.${contentId}`] = increment(1);
  }
  try {
    const counterBatch = writeBatch(db);
    counterBatch.update(countRef, countUpdate);
    await counterBatch.commit();
  } catch {
    // counter 失敗時は無視 (plan 本体は書き込み済み、 repairPlanCounts でリカバリ)
  }
}

/** プランを Firestore で更新（存在しない場合はエラーをthrow → 呼び出し側でcreateにフォールバック） */
async function updatePlan(
  plan: SavedPlan,
  uid: string,
): Promise<'updated' | 'skipped_newer_remote' | 'deleted_remotely'> {
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
    // 墓標 (他端末で削除済み) を上書きしない。復活させず「削除された」と呼び出し側に伝える。
    if (current.deleted === true) {
      return 'deleted_remotely';
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

/**
 * プランを Firestore から削除（ソフトデリート = 墓標化）
 *
 * 物理削除はしない。`deleted:true + deletedAt` を立てて doc を残すことで、
 * 「未同期」と「他端末で削除」をマージ時に区別できるようにする (= 復活/消失の根治)。
 * 古い墓標は安全期間後に GC cron で物理削除する (後続タスク)。
 *
 * バッチ: プラン墓標化 + カウンター減算。
 */
async function deletePlan(
  planId: string,
  uid: string,
  contentId: string | null,
): Promise<void> {
  const batch = writeBatch(db);

  // プランを墓標化 (物理削除しない)。version をインクリメントして楽観ロックを満たす。
  const planRef = doc(db, COLLECTIONS.PLANS, planId);
  batch.update(planRef, {
    deleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    version: increment(1),
  });

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
 * マージ戦略は純粋関数 `mergePlans` に委譲 (墓標ベース):
 * - 両方に存在: updatedAt が新しい方を採用
 * - リモートのみ live: ローカルに追加（他端末で作成されたプラン）
 * - ローカルのみ + 墓標無し: 未同期 → 残す (drop しない / 次回キューで再送)
 * - 墓標あり: 削除確定 → ローカルからも除去・復活させない
 *
 * @param localDeletedIds 端末側で削除済みと分かっている ID (_deletedPlanIds)。
 *   サーバ墓標がまだ伝播していない/キャッシュ越しで live に見える瞬間でも復活させないため、
 *   サーバ墓標と合流させて除外する (= 「一瞬復活」ちらつきの根治)。
 */
async function fetchAndMerge(
  localPlans: SavedPlan[],
  uid: string,
  localDeletedIds?: Set<string>,
): Promise<{ merged: SavedPlan[]; changed: boolean }> {
  const { live, tombstoneIds } = await fetchPlansAndTombstones(uid);
  const excludeIds = localDeletedIds && localDeletedIds.size > 0
    ? new Set<string>([...tombstoneIds, ...localDeletedIds])
    : tombstoneIds;
  return mergePlans(localPlans, live, excludeIds);
}

/**
 * ログイン時のデータマイグレーション (Revision 3)
 *
 * Firestore を正として扱い、ローカル + リモートをマージするだけ。
 * **`ownerId='local'` のプランのアップロードはここでは行わない** (Rev2 までの silent upload は撤去)。
 * 取り込みは LocalImportDialog から `usePlanStore.executeLocalImport` 経由で明示的に行う。
 *
 * - 両方に存在 + ローカルが新しい → Firestore に書き戻し（端末間同期の要）
 * - 両方に存在 + リモートが新しい → リモート採用
 * - 墓標あり → 削除確定: ローカルからも除去・復活させない
 * - ローカルのみ + 墓標無し + `ownerId='local'` → ローカルに残す（取り込み候補・自動 upload しない）
 * - ローカルのみ + 墓標無し + `ownerId=uid` → 未同期 → 残す + dirty に積んで再 upload (旧実装はここで消していた=消失バグ)
 * - リモートのみ live → 追加（他端末で作成されたプラン）
 *
 * @param localDeletedIds 端末側で削除済みと分かっている ID (_deletedPlanIds)。
 *   サーバ墓標がまだ無い (削除が未同期) 場合でも復活させないために除外する。
 * @returns { merged, dirtyIds } — マージ済みプラン + 次回 sync で (再)upload すべきプランID
 */
async function migrateLocalPlansToFirestore(
  localPlans: SavedPlan[],
  uid: string,
  localDeletedIds?: Set<string>,
): Promise<{ merged: SavedPlan[]; dirtyIds: string[] }> {
  // カウンターを実データから修復（過去の同期失敗で壊れている可能性があるため）
  try {
    await repairPlanCounts(uid);
  } catch (err) {
    console.error('カウンター修復エラー（続行）:', err);
  }

  // Firestoreから既存プランを取得 (live + 墓標)
  const { live: remotePlans, tombstoneIds: serverTombstoneIds } = await fetchPlansAndTombstones(uid);
  // サーバ墓標 ∪ ローカル既知削除 = 復活させない ID 集合
  const tombstoneIds = localDeletedIds && localDeletedIds.size > 0
    ? new Set<string>([...serverTombstoneIds, ...localDeletedIds])
    : serverTombstoneIds;
  const remoteMap = new Map(remotePlans.map((p) => [p.id, p]));

  // マージ + ローカルが新しいプランをFirestoreに書き戻し
  const merged: SavedPlan[] = [];
  const dirtyIds: string[] = []; // 次回 sync で (再)upload すべきプランID

  for (const local of localPlans) {
    // 墓標が最優先: 他端末で削除された → ローカルからも除去
    if (tombstoneIds.has(local.id)) {
      continue;
    }
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
      // ローカルのみ & 未ログイン作成 → ownerId='local' のまま残す (取り込み候補・自動 upload しない)
      merged.push(local);
    } else {
      // ローカルのみ & ownerId=uid & 墓標無し = 未同期 (ログイン中作成→未 upload で閉じた)。
      // 旧実装は「別端末で削除」と推測して drop していた (= 消失バグ)。
      // 墓標が無い以上それは未同期なので、残して dirty に積み、次回 sync で再 upload する。
      merged.push(local);
      dirtyIds.push(local.id);
    }
  }

  // リモートにのみ存在する live プランを追加 (除外集合にあるものは復活させない)
  const localIds = new Set(localPlans.map((p) => p.id));
  const remoteOnly = remotePlans.filter((p) => !localIds.has(p.id) && !tombstoneIds.has(p.id));
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
          if (result === 'deleted_remotely') {
            // 他端末で削除済み (墓標) → 復活させずローカルからも除去
            deletedRemotely.push(plan.id);
            return;
          }
        } catch {
          // updatePlan が NOT_EXISTS (リモートに doc が無い)。
          // ソフトデリート導入後、削除は必ず墓標として doc が残るので
          // 「doc が無い = まだ一度も upload していない (未同期)」を意味する。
          // → 消さずに createPlan で upload する (旧実装の「無い=削除」消失バグの根治)。
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
