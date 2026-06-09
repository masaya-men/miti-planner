// 共同編集⑤-2a: /api/collab/room の入力検証 純ロジック。firebase-admin 非依存。
// トークン生成(nanoid)・Firestore 読み書き・所有者照合はハンドラ(room.ts)が行い、
// ここは「リクエスト body が正しい形か」だけを決定的に判定する(③/⑤-1 と同じ純関数分離方針)。

/** ルーム管理アクション。create=発行(冪等) / revoke=失効 / reissue=再発行 / set-max=上限変更。 */
export type RoomAction = 'create' | 'revoke' | 'reissue' | 'set-max';

/** 受理可能なアクション一覧(検証と一覧表示の単一の真実)。 */
export const ROOM_ACTIONS: RoomAction[] = ['create', 'revoke', 'reissue', 'set-max'];

export type RoomManageRequest =
  | { action: 'create'; planId: string; maxParticipants?: number; label?: string }
  | { action: 'revoke'; planId: string }
  | { action: 'reissue'; planId: string; label?: string }
  | { action: 'set-max'; planId: string; maxParticipants: number };

export type ParseResult =
  | { ok: true; req: RoomManageRequest }
  | { ok: false; error: 'invalid_body' | 'invalid_action' | 'invalid_planId' | 'invalid_maxParticipants' | 'invalid_label' };

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

  // label は create/reissue のみ任意。文字列・trim・40 文字以内。空白のみは未設定。
  let label: string | undefined;
  if (b.label !== undefined) {
    if (typeof b.label !== 'string' || b.label.length > 40) return { ok: false, error: 'invalid_label' };
    const trimmed = b.label.trim();
    label = trimmed.length === 0 ? undefined : trimmed;
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
    const req: { action: 'create'; planId: string; maxParticipants?: number; label?: string } = { action: 'create', planId };
    if (typeof b.maxParticipants === 'number') req.maxParticipants = b.maxParticipants;
    if (label !== undefined) req.label = label;
    return { ok: true, req };
  }
  // revoke / reissue は maxParticipants を取らない(あっても無視)。reissue だけ label を載せる。
  if (action === 'reissue') {
    const req: { action: 'reissue'; planId: string; label?: string } = { action: 'reissue', planId };
    if (label !== undefined) req.label = label;
    return { ok: true, req };
  }
  return { ok: true, req: { action: 'revoke', planId } };
}
