// ④-a: 接続者の編集権をサーバ側で確かめるためのグルー。
// (1) 受付係 verify を叩く純関数, (2) worker→DO 信頼ヘッダ定数, (3) 接続認可, (4) editor 判定。
// Firebase Admin は Workers 非対応のため検証は Vercel(verify)へ委譲(③ と同型)。

const SECRET_HEADER = "x-collab-secret";

/** worker→DO へ「この接続は編集者(uid)」を伝える信頼ヘッダ。クライアントは WS で付けられない。 */
export const EDITOR_UID_HEADER = "x-collab-uid";
/** クライアントが ID トークンを載せるクエリパラメータ名(provider params)。 */
export const TOKEN_PARAM = "token";

/**
 * 受付係 verify を叩き、正規ログイン本人なら uid を返す。
 * 不正/障害/到達不能/空トークン → null(呼び出し側は fail-closed で viewer 扱い)。
 */
export async function verifyToken(
  base: string,
  secret: string,
  token: string,
): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${base}/api/collab/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: secret },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { valid?: boolean; uid?: string };
    return body.valid && typeof body.uid === "string" ? body.uid : null;
  } catch {
    return null;
  }
}

/** verify 関数の型(本番=verifyToken の部分適用 / テスト=モック)。 */
export type VerifyFn = (token: string) => Promise<string | null>;

/**
 * 接続要求を認可し、DO へ転送する Request を返す。
 * - クライアント由来の信頼ヘッダは必ず除去(詐称防止)。
 * - クエリの token を verifyFn で検証し、正規本人なら EDITOR_UID_HEADER を付与。
 * - 検証失敗/トークン無し → ヘッダ無し(viewer・fail-closed)。接続自体は常に許可(閲覧は誰でも可)。
 */
export async function authorizeConnection(req: Request, verifyFn: VerifyFn): Promise<Request> {
  // WS upgrade を落とさないよう、既存 index.ts と同じ「コピー後に header を in-place 操作」方式。
  const out = new Request(req);
  out.headers.delete(EDITOR_UID_HEADER); // 詐称防止: クライアントの偽ヘッダを落とす
  const token = new URL(req.url).searchParams.get(TOKEN_PARAM) ?? "";
  if (token) {
    const uid = await verifyFn(token);
    if (uid) out.headers.set(EDITOR_UID_HEADER, uid);
  }
  return out;
}

/** DO 接続 state が編集者か。`isReadOnly` の反転に使う。 */
export function isEditorState(state: unknown): boolean {
  return typeof (state as { collabEditor?: unknown } | undefined)?.collabEditor === "string";
}
