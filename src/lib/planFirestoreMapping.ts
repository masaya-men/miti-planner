/**
 * プラン <-> Firestore ドキュメントの型変換
 */

import { serverTimestamp, Timestamp } from 'firebase/firestore';
import type { FirestorePlan } from '../types/firebase';
import type { SavedPlan } from '../types';


// ========================================
// 型変換ヘルパー
// ========================================

/** SavedPlan → Firestore書き込み用オブジェクト（新規作成） */
export function toFirestoreCreate(
  plan: SavedPlan,
  uid: string,
  displayName: string,
): Record<string, unknown> {
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
export function toFirestoreUpdate(
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
    category: (data as FirestorePlan & { category?: SavedPlan['category'] }).category ?? undefined,
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
