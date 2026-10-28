/**
 * Firestore からのプラン取得（live + 墓標）
 */

import { collection, getDocs, getDocsFromServer, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { fromFirestore } from './planFirestoreMapping';
import { COLLECTIONS } from '../types/firebase';
import type { FirestorePlan } from '../types/firebase';
import type { SavedPlan } from '../types';

/**
 * ユーザーの全プラン doc を取得 (live + 墓標)。マージ用の低レベル取得。
 * - live: deleted でないプラン (表示・カウント対象)
 * - tombstoneIds: deleted:true のプラン ID (= 削除済みの明示シグナル)
 *
 * 注意: クエリ自体は ownerId==uid の単一 where + updatedAt orderBy のまま
 * (= 既存の複合インデックスで動く)。墓標の除外はクライアント側で行うので
 * 新しい複合インデックスは不要。
 */
export async function fetchPlansAndTombstones(
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
export async function fetchUserPlans(uid: string): Promise<SavedPlan[]> {
  const { live } = await fetchPlansAndTombstones(uid);
  return live;
}

/**
 * プランを Firestore に新規作成（バッチ書き込み: プラン + カウンター）
 * planId は SavedPlan.id をそのまま使う（localStorageと一致させるため）
 */
