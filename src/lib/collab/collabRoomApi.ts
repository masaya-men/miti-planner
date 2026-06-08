// src/lib/collab/collabRoomApi.ts
// 共同編集⑤-3a: オーナー用ルーム管理 API(/api/collab/room)のクライアントヘルパー。
// apiFetch が ID トークン(Authorization: Bearer)を自動付与する。サーバの検証/所有者照合は
// /api/collab/room(⑤-2a)が担うため、ここは body 組み立てとレスポンス整形だけを行う。
import { apiFetch } from '../apiClient';

/** create/set-max/reissue の成功レスポンス。 */
export interface RoomInfo {
  roomToken: string;
  maxParticipants: number;
  revoked: false;
}

/** revoke の成功レスポンス。 */
export interface RoomRevoked {
  revoked: true;
}

/** サーバが返したエラーコードを保持する例外。UI はこれで文言を出し分けできる。 */
// erasableSyntaxOnly 有効のためパラメータプロパティ(public code 等)は使えない。フィールドを明示して代入する。
export class CollabRoomError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(`collab room error: ${code} (${status})`);
    this.name = 'CollabRoomError';
    this.code = code;
    this.status = status;
  }
}

type Action = 'create' | 'set-max' | 'revoke' | 'reissue';

async function post(body: Record<string, unknown>): Promise<any> {
  const res = await apiFetch('/api/collab/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CollabRoomError((data?.error as string) ?? 'unknown', res.status);
  return data;
}

/** リンク発行(冪等: 既存があれば同 roomToken を再利用)。maxParticipants 省略時はサーバ既定(8)。 */
export function createRoom(planId: string, maxParticipants?: number): Promise<RoomInfo> {
  const body: Record<string, unknown> = { action: 'create' as Action, planId };
  if (maxParticipants !== undefined) body.maxParticipants = maxParticipants;
  return post(body);
}

/** 入れる人数を変更(サーバが [1, SYSTEM_MAX] にクランプして返す)。 */
export function setMaxParticipants(planId: string, maxParticipants: number): Promise<RoomInfo> {
  return post({ action: 'set-max' as Action, planId, maxParticipants });
}

/** リンクを失効(以後 load/save 拒否=実質停止)。 */
export function revokeRoom(planId: string): Promise<RoomRevoked> {
  return post({ action: 'revoke' as Action, planId });
}

/** 旧リンクを失効し新しい roomToken を発行。 */
export function reissueRoom(planId: string): Promise<RoomInfo> {
  return post({ action: 'reissue' as Action, planId });
}
