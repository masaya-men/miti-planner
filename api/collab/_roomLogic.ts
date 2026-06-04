// 共同編集⑤: ルームトークン → プラン解決の純ロジック。
// collabRooms/{roomToken} doc を planId/最大人数/失効に解釈する。firebase-admin 非依存
// (handler が wrap する)。③ の _logic.ts と同じ「純関数を分離して決定的にテスト」方針。

/** 既定の最大人数 = 零式/絶のフルパーティ1組。オーナー未設定時に適用。 */
export const DEFAULT_MAX_PARTICIPANTS = 8;
/** システム上限。設計書 §3 の「編集8席 + 閲覧20席」= 28 を v1 は総参加数の単一上限として扱う。 */
export const SYSTEM_MAX_PARTICIPANTS = 28;

/** collabRooms/{roomToken} ドキュメントの必要フィールドだけを表す型。 */
export interface CollabRoomDoc {
  planId?: string;
  ownerId?: string;
  maxParticipants?: number;
  revoked?: boolean;
}

export type RoomResolution =
  | { ok: true; planId: string; maxParticipants: number }
  | { ok: false; reason: 'not-found' | 'revoked' };

/** オーナー設定の最大人数を [1, SYSTEM_MAX] に丸める。未指定/非数は既定 8。小数は切り捨て。 */
export function clampMaxParticipants(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_MAX_PARTICIPANTS;
  return Math.max(1, Math.min(SYSTEM_MAX_PARTICIPANTS, Math.floor(n)));
}

/**
 * collabRooms doc(または null=不存在)から解決結果を決める。失効/planId 欠落は入室不可。
 * 失効判定を planId 欠落より優先する: 一度 revoked にした部屋は(planId が消えても)
 * 「失効」として扱い、管理者の失効意図を取りこぼさない。
 */
export function resolveRoom(room: CollabRoomDoc | null): RoomResolution {
  if (!room) return { ok: false, reason: 'not-found' };
  if (room.revoked === true) return { ok: false, reason: 'revoked' };
  if (!room.planId) return { ok: false, reason: 'not-found' };
  return { ok: true, planId: room.planId, maxParticipants: clampMaxParticipants(room.maxParticipants) };
}

/** 緊急停止スイッチ: 環境変数 COLLAB_DISABLED==='1' で共同編集を全停止する。 */
export function isCollabDisabled(env: { COLLAB_DISABLED?: string }): boolean {
  return env.COLLAB_DISABLED === '1';
}
