// 共同編集⑤-2a: /api/collab/room の入力検証 純ロジック。firebase-admin 非依存。
// トークン生成(nanoid)・Firestore 読み書き・所有者照合はハンドラ(room.ts)が行い、
// ここは「リクエスト body が正しい形か」だけを決定的に判定する(③/⑤-1 と同じ純関数分離方針)。

/** ルーム管理アクション。create=発行(冪等) / revoke=失効 / reissue=再発行 / set-max=上限変更。 */
export type RoomAction = 'create' | 'revoke' | 'reissue' | 'set-max';

/** 受理可能なアクション一覧(検証と一覧表示の単一の真実)。 */
export const ROOM_ACTIONS: RoomAction[] = ['create', 'revoke', 'reissue', 'set-max'];

export type RoomManageRequest =
  | { action: 'create'; planId: string; maxParticipants?: number }
  | { action: 'revoke'; planId: string }
  | { action: 'reissue'; planId: string }
  | { action: 'set-max'; planId: string; maxParticipants: number };

export type ParseResult =
  | { ok: true; req: RoomManageRequest }
  | { ok: false; error: 'invalid_body' | 'invalid_action' | 'invalid_planId' | 'invalid_maxParticipants' };

/** リクエスト body を RoomManageRequest に検証する。不正は理由付きで弾く。 */
export function parseRoomManageRequest(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const b = body as Record<string, unknown>;

  const action = b.action;
  if (typeof action !== 'string' || !ROOM_ACTIONS.includes(action as RoomAction)) {
    return { ok: false, error: 'invalid_action' };
  }
  const planId = b.planId;
  if (typeof planId !== 'string' || planId.length === 0) {
    return { ok: false, error: 'invalid_planId' };
  }

  if (action === 'set-max') {
    // set-max は新しい上限が必須。
    if (typeof b.maxParticipants !== 'number') return { ok: false, error: 'invalid_maxParticipants' };
    return { ok: true, req: { action: 'set-max', planId, maxParticipants: b.maxParticipants } };
  }
  if (action === 'create') {
    // create は省略可(省略時はハンドラが既定 8)。指定するなら数値であること。
    if (b.maxParticipants !== undefined && typeof b.maxParticipants !== 'number') {
      return { ok: false, error: 'invalid_maxParticipants' };
    }
    const req: { action: 'create'; planId: string; maxParticipants?: number } = { action: 'create', planId };
    if (typeof b.maxParticipants === 'number') req.maxParticipants = b.maxParticipants;
    return { ok: true, req };
  }
  // revoke / reissue は maxParticipants を取らない(あっても無視)。
  return { ok: true, req: { action: action as 'revoke' | 'reissue', planId } };
}
